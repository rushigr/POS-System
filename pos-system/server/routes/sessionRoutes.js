const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const UserSession = require("../models/UserSession");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

// The browser sends a heartbeat every 20 seconds. A session is considered
// offline after 90 seconds without a heartbeat to account for background-tab
// timer throttling. Unexpected-disconnect times are estimated from lastSeenAt.
const INACTIVITY_TIMEOUT_MS = 90 * 1000;

async function createSessionForUser(user, now = new Date()) {
    return UserSession.create({
        userId: user._id,
        username: user.username,
        role: user.role,
        loginAt: now,
        lastSeenAt: now,
        offlineAt: null,
        endedBy: null
    });
}

// Called automatically by the client while the user is signed in.
router.post("/heartbeat", async (req, res) => {
    try {
        const username = String(req.headers["x-username"] || "").trim();
        const sessionId = req.body?.sessionId;

        if (!username || !sessionId || !mongoose.isValidObjectId(sessionId)) {
            return res.status(401).json({
                message: "Session missing. Please log out and log in again."
            });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        const now = new Date();
        const session = await UserSession.findOne({
            _id: sessionId,
            userId: user._id,
            username: user.username
        });

        if (!session) {
            return res.status(401).json({
                message: "Session not found. Please log in again."
            });
        }

        const lastSeenAt = new Date(session.lastSeenAt).getTime();
        const timedOut = now.getTime() - lastSeenAt >= INACTIVITY_TIMEOUT_MS;

        // An old/closed session remains in history. A returning client starts
        // a new session instead of erasing the earlier offline time.
        if (session.offlineAt || timedOut) {
            if (!session.offlineAt) {
                session.offlineAt = new Date(lastSeenAt + INACTIVITY_TIMEOUT_MS);
                session.endedBy = "inactivity";
                await session.save();
            }

            const newSession = await createSessionForUser(user, now);
            return res.json({
                sessionId: String(newSession._id),
                restarted: true
            });
        }

        session.lastSeenAt = now;
        // Preserve the role/user name as they were when this session was made.
        await session.save();

        return res.json({
            sessionId: String(session._id),
            restarted: false
        });
    } catch (error) {
        console.error("Session heartbeat failed:", error);
        return res.status(500).json({ message: "Unable to update session activity" });
    }
});

// Called when the user clicks Logout. This timestamp is exact to the server's
// receipt of the logout request. Closing a browser is detected by timeout.
router.post("/logout", async (req, res) => {
    try {
        const username = String(req.headers["x-username"] || "").trim();
        const sessionId = req.body?.sessionId;

        if (username && sessionId && mongoose.isValidObjectId(sessionId)) {
            await UserSession.updateOne(
                {
                    _id: sessionId,
                    username,
                    offlineAt: null
                },
                {
                    $set: {
                        offlineAt: new Date(),
                        endedBy: "logout"
                    }
                }
            );
        }

        // Do not make logout fail if there is no session ID (older client).
        return res.json({ message: "Session ended" });
    } catch (error) {
        console.error("Session logout failed:", error);
        return res.status(500).json({ message: "Unable to end session" });
    }
});

// Admin-only session history. Stale online records are marked offline before
// returning every active session plus the latest 100 offline sessions. Inactivity-based offline times are estimates.
router.get("/", adminOnly, async (req, res) => {
    try {
        const now = new Date();
        const cutoff = new Date(now.getTime() - INACTIVITY_TIMEOUT_MS);

        const staleSessions = await UserSession.find({
            offlineAt: null,
            lastSeenAt: { $lte: cutoff }
        }).select("_id lastSeenAt").lean();

        if (staleSessions.length > 0) {
            await UserSession.bulkWrite(
                staleSessions.map((session) => ({
                    updateOne: {
                        // Match lastSeenAt too, so a concurrent heartbeat does
                        // not accidentally close a session that just became active.
                        filter: {
                            _id: session._id,
                            lastSeenAt: session.lastSeenAt,
                            offlineAt: null
                        },
                        update: {
                            $set: {
                                offlineAt: new Date(
                                    new Date(session.lastSeenAt).getTime() + INACTIVITY_TIMEOUT_MS
                                ),
                                endedBy: "inactivity"
                            }
                        }
                    }
                }))
            );
        }

        const activeRecords = await UserSession.find({
            offlineAt: null,
            lastSeenAt: { $gt: cutoff }
        }).sort({ loginAt: -1 }).lean();

        const offlineRecords = await UserSession.find({
            $or: [
                { offlineAt: { $ne: null } },
                { lastSeenAt: { $lte: cutoff } }
            ]
        }).sort({ loginAt: -1 }).limit(100).lean();

        const records = [...activeRecords, ...offlineRecords].sort(
            (a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime()
        );

        const sessions = records.map((session) => {
            const lastSeen = new Date(session.lastSeenAt).getTime();
            const isActive = !session.offlineAt && lastSeen > cutoff.getTime();
            const offlineAt = session.offlineAt || (
                isActive
                    ? null
                    : new Date(lastSeen + INACTIVITY_TIMEOUT_MS)
            );

            return {
                _id: String(session._id),
                userId: String(session.userId),
                username: session.username,
                role: session.role,
                loginAt: session.loginAt,
                lastSeenAt: session.lastSeenAt,
                offlineAt,
                endedBy: session.endedBy || (isActive ? null : "inactivity"),
                status: isActive ? "active" : "offline"
            };
        });

        return res.json({
            sessions,
            checkedAt: now,
            inactivityTimeoutSeconds: INACTIVITY_TIMEOUT_MS / 1000
        });
    } catch (error) {
        console.error("Failed to load sessions:", error);
        return res.status(500).json({ message: "Failed to load user sessions" });
    }
});

module.exports = router;
