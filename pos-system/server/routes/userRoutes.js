const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/", adminOnly, async (req, res) => {
    try {
        const users = await User.find().select("-password");
        res.json(users);
    } catch (error) {
        res.status(500).json({
            message: "Failed to get users"
        });
    }
});

router.post("/", adminOnly, async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!username?.trim() || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        if (!["admin", "cashier"].includes(role)) {
            return res.status(400).json({
                message: "Invalid user role"
            });
        }

        const existingUser = await User.findOne({
            username: username.trim()
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Username already exists"
            });
        }

        const user = await User.create({
            username: username.trim(),
            password,
            role
        });

        res.status(201).json({
            message: "User created successfully",
            user: {
                _id: user._id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to create user"
        });
    }
});

router.put("/:id", adminOnly, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        const { username, password, role } = req.body;

        if (!username?.trim()) {
            return res.status(400).json({
                message: "Username is required"
            });
        }

        if (!["admin", "cashier"].includes(role)) {
            return res.status(400).json({
                message: "Invalid user role"
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const duplicate = await User.findOne({
            username: username.trim(),
            _id: { $ne: user._id }
        });

        if (duplicate) {
            return res.status(409).json({
                message: "Username already exists"
            });
        }

        user.username = username.trim();
        user.role = role;

        // leave password unchanged if blank.
        if (password?.trim()) {
            user.password = password;
        }

        await user.save();

        res.json({
            message: "User updated successfully",
            user: {
                _id: user._id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to update user"
        });
    }
});

router.delete("/:id", adminOnly, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        const currentUser = await User.findOne({
            username: req.headers["x-username"]
        });

        if (!currentUser) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        // prevents self delete lol
        if (currentUser._id.toString() === req.params.id) {
            return res.status(400).json({
                message: "You cannot delete your own account"
            });
        }

        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: "User deleted successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to delete user"
        });
    }
});

module.exports = router;