const express = require("express");
const AuditLog = require("../models/AuditLog");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Read-only on purpose: there is no POST/PUT/DELETE for audit entries.
router.get("/", adminOnly, async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 25, 1),
            100
        );

        const filter = {};

        if (typeof req.query.entityType === "string" &&
            ["Product", "User"].includes(req.query.entityType)) {
            filter.entityType = req.query.entityType;
        }

        if (typeof req.query.actor === "string" && req.query.actor.trim()) {
            filter.actor = new RegExp(escapeRegex(req.query.actor.trim()), "i");
        }

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            AuditLog.countDocuments(filter)
        ]);

        res.json({
            logs,
            total,
            page,
            pages: Math.max(Math.ceil(total / limit), 1)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to get audit log" });
    }
});

module.exports = router;