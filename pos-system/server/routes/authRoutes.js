const express = require("express");
const User = require("../models/User");
const UserSession = require("../models/UserSession");
const { signToken } = require("../middleware/authMiddleware");
const { hashPassword, verifyPassword } = require("../utils/passwords");

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};

        // Must be plain strings: an object here (e.g. {"$ne": null}) would be
        // treated by MongoDB as a query operator.
        if (typeof username !== "string" || typeof password !== "string" ||
            !username.trim() || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        const user = await User.findOne({ username: username.trim() });

        const { ok, needsUpgrade } = user
            ? await verifyPassword(password, user.password)
            : { ok: false, needsUpgrade: false };

        if (!ok) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        // Accounts made before hashing existed are upgraded on their next login.
        if (needsUpgrade) {
            user.password = await hashPassword(password);
            await user.save();
        }

        const now = new Date();
        const session = await UserSession.create({
            userId: user._id,
            username: user.username,
            role: user.role,
            loginAt: now,
            lastSeenAt: now,
            offlineAt: null,
            endedBy: null
        });

        res.json({
            message: "Login successful",
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                isRoot: user.isRoot === true,
                sessionId: String(session._id),
                token: signToken(user, session._id)
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Server error"
        });
    }
});

module.exports = router;