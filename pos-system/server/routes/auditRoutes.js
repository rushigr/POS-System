const express = require("express");
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const adminOnly = require("../middleware/adminMiddleware");
const { requireRoot } = require("../middleware/authMiddleware");
const { logAudit } = require("../utils/audit");

const router = express.Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ENTITY_TYPES = ["Product", "User", "Transaction", "Log"];

// Builds the Mongo filter from { entityType, actor } (query string or body).
function buildFilter(source = {}) {
    const filter = {};

    if (typeof source.entityType === "string" &&
        ENTITY_TYPES.includes(source.entityType)) {
        filter.entityType = source.entityType;
    }

    if (typeof source.actor === "string" && source.actor.trim()) {
        filter.actor = new RegExp(escapeRegex(source.actor.trim()), "i");
    }

    return filter;
}

// Admins can read the log; nobody can edit an entry.
router.get("/", adminOnly, async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 25, 1),
            100
        );

        const filter = buildFilter(req.query);

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

// Root only: delete every entry that matches the current filter.
// The body must contain { confirm: "DELETE" }. One summary entry is written
// afterwards recording who did it and how many entries were removed.
router.delete("/", requireRoot, async (req, res) => {
    try {
        if (req.body?.confirm !== "DELETE") {
            return res.status(400).json({
                message: 'Send { "confirm": "DELETE" } to delete log entries'
            });
        }

        const filter = buildFilter(req.body);
        const result = await AuditLog.deleteMany(filter);

        const scope = [
            req.body?.entityType && ENTITY_TYPES.includes(req.body.entityType)
                ? `type: ${req.body.entityType}`
                : null,
            typeof req.body?.actor === "string" && req.body.actor.trim()
                ? `admin: ${req.body.actor.trim()}`
                : null
        ].filter(Boolean).join(", ") || "all entries";

        await logAudit(req, {
            action: "AUDIT_CLEAR",
            entityType: "Log",
            entityName: "Audit log",
            changes: [
                { field: "entries deleted", from: result.deletedCount, to: 0 },
                { field: "scope", from: scope, to: null }
            ]
        });

        res.json({
            message: `Deleted ${result.deletedCount} log entr${result.deletedCount === 1 ? "y" : "ies"}.`,
            deleted: result.deletedCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete audit log entries" });
    }
});

// Root only: delete one entry.
router.delete("/:id", requireRoot, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid log entry ID" });
        }

        const entry = await AuditLog.findByIdAndDelete(req.params.id);

        if (!entry) {
            return res.status(404).json({ message: "Log entry not found" });
        }

        await logAudit(req, {
            action: "AUDIT_ENTRY_DELETE",
            entityType: "Log",
            entityName: `${entry.action} by ${entry.actor}`,
            changes: [
                {
                    field: "entry from",
                    from: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
                    to: null
                }
            ]
        });

        res.json({ message: "Log entry deleted." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete log entry" });
    }
});

module.exports = router;