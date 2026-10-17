const express = require("express");
const User = require("../models/User");

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        console.log("Database:", User.db.name);
        console.log("Collection:", User.collection.name);
        console.log("Username received:", JSON.stringify(username));
        console.log("User count:", await User.countDocuments());

        const user = await User.findOne({
            username: username.trim()
        });

        if (!user) {
            console.log("Login failed: username not found");
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        if (!user) {
            console.log("Login failed: username not found");
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        if (user.password !== password) {
            console.log("Login failed: password mismatch");
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        res.json({
            message: "Login successful",
            user: {
                id: user._id,
                username: user.username,
                role: user.role
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