const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const adminOnly = require("../middleware/adminMiddleware");
const { logAudit, diffFields } = require("../utils/audit");
const { validatePassword } = require("../utils/passwordStrength");
const { hashPassword } = require("../utils/passwords");

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
        const { username, password, role } = req.body || {};

        if (typeof username !== "string" || !username.trim() ||
            typeof password !== "string" || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        // The root account cannot be created here, only "admin" or "cashier".
        if (!["admin", "cashier"].includes(role)) {
            return res.status(400).json({
                message: "Invalid user role"
            });
        }

        const passwordProblem = validatePassword(password, username.trim());

        if (passwordProblem) {
            return res.status(400).json({ message: passwordProblem });
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
            password: await hashPassword(password),
            role
        });

        await logAudit(req, {
            action: "USER_CREATE",
            entityType: "User",
            entityId: user._id,
            entityName: user.username,
            changes: [
                { field: "username", from: null, to: user.username },
                { field: "role", from: null, to: user.role }
            ]
        });

        res.status(201).json({
            message: "User created successfully",
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                isRoot: false
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

        const { username, password, role } = req.body || {};

        if (typeof username !== "string" || !username.trim()) {
            return res.status(400).json({
                message: "Username is required"
            });
        }

        if (!["admin", "cashier"].includes(role)) {
            return res.status(400).json({
                message: "Invalid user role"
            });
        }

        // An empty/missing password means "leave it unchanged".
        const passwordProvided = typeof password === "string" && password.length > 0;

        if (passwordProvided) {
            const passwordProblem = validatePassword(password, username.trim());

            if (passwordProblem) {
                return res.status(400).json({ message: passwordProblem });
            }
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // The root account is protected: only root can change it, and then
        // only its password. Otherwise any admin could reset root's password
        // and take it over.
        if (user.isRoot) {
            if (!req.user.isRoot) {
                return res.status(403).json({
                    message: "Only the root account can modify itself"
                });
            }

            if (username.trim() !== user.username || role !== user.role) {
                return res.status(400).json({
                    message: "The root account's username and role cannot be changed"
                });
            }
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

        const before = { username: user.username, role: user.role };

        // Older sales are linked to a cashier only by name. Pin them to this
        // account before the name changes so a cashier keeps seeing their own.
        if (before.username !== username.trim()) {
            await Transaction.updateMany(
                { cashier: before.username, cashierId: null },
                { $set: { cashierId: user._id } }
            );
        }

        user.username = username.trim();
        user.role = role;

        if (passwordProvided) {
            user.password = await hashPassword(password);
        }

        await user.save();

        const changes = diffFields(
            before,
            { username: user.username, role: user.role },
            ["username", "role"]
        );

        // record THAT the password changed, never the value
        if (passwordProvided) {
            changes.push({ field: "password", from: "[hidden]", to: "[changed]" });
        }

        if (changes.length > 0) {
            await logAudit(req, {
                action: "USER_UPDATE",
                entityType: "User",
                entityId: user._id,
                entityName: user.username,
                changes
            });
        }

        res.json({
            message: "User updated successfully",
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                isRoot: user.isRoot === true
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

        // prevents self delete lol
        if (String(req.user.id) === req.params.id) {
            return res.status(400).json({
                message: "You cannot delete your own account"
            });
        }

        // The filter itself excludes root, so the root account can never be
        // removed by this route, whoever asks.
        const user = await User.findOneAndDelete({
            _id: req.params.id,
            isRoot: { $ne: true }
        });

        if (!user) {
            const target = await User.findById(req.params.id).select("isRoot");

            if (target?.isRoot) {
                return res.status(403).json({
                    message: "The root account cannot be deleted"
                });
            }

            return res.status(404).json({
                message: "User not found"
            });
        }

        await logAudit(req, {
            action: "USER_DELETE",
            entityType: "User",
            entityId: user._id,
            entityName: user.username,
            changes: [
                { field: "username", from: user.username, to: null },
                { field: "role", from: user.role, to: null }
            ]
        });

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