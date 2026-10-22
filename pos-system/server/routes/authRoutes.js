const express = require("express");
const User = require("../models/User");
const UserSession = require("../models/UserSession");

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        if (user.password !== password) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
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
                sessionId: String(session._id)
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