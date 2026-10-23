const express = require("express");
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const DeletionLog = require("../models/DeletionLog");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

const MAX_DELETE_PER_REQUEST = 100;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePaging = (query) => ({
    page: Math.max(parseInt(query.page, 10) || 1, 1),
    limit: Math.min(Math.max(parseInt(query.limit, 10) || 25, 1), 100)
});

// "asc" = oldest first, anything else = newest first. _id breaks ties so
// pages stay stable when entries share a timestamp.
const parseSort = (query) => {
    const dir = query.sort === "asc" ? 1 : -1;
    return { createdAt: dir, _id: dir };
};

const sortName = (query) => (query.sort === "asc" ? "asc" : "desc");

// Optional ?from=&to= (ISO timestamps). Returns { error } or a Mongo
// createdAt condition (null when no range was given).
const parseRange = (query) => {
    const range = {};

    for (const key of ["from", "to"]) {
        const raw = query[key];
        if (typeof raw !== "string" || !raw) continue;

        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
            return { error: `Invalid "${key}" date` };
        }
        range[key] = date;
    }

    if (range.from && range.to && range.from > range.to) {
        return { error: "The 'from' date must be on or before the 'to' date" };
    }

    if (!range.from && !range.to) return { condition: null };

    const condition = {};
    if (range.from) condition.$gte = range.from;
    if (range.to) condition.$lte = range.to;
    return { condition };
};

// List audit entries.
router.get("/", adminOnly, async (req, res) => {
    try {
        const { page, limit } = parsePaging(req.query);

        const range = parseRange(req.query);
        if (range.error) {
            return res.status(400).json({ message: range.error });
        }

        const filter = {};
        if (range.condition) filter.createdAt = range.condition;

        if (typeof req.query.entityType === "string" &&
            ["Product", "User", "Transaction"].includes(req.query.entityType)) {
            filter.entityType = req.query.entityType;
        }

        if (typeof req.query.actor === "string" && req.query.actor.trim()) {
            filter.actor = new RegExp(escapeRegex(req.query.actor.trim()), "i");
        }

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort(parseSort(req.query))
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            AuditLog.countDocuments(filter)
        ]);

        res.json({
            logs,
            total,
            sort: sortName(req.query),
            page,
            pages: Math.max(Math.ceil(total / limit), 1)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to get audit log" });
    }
});

// Delete selected audit entries. A reason is required, and a permanent
// copy of every deleted entry goes into the separate DeletionLog.
// (POST instead of DELETE because it carries a body with the ids.)
router.post("/delete", adminOnly, async (req, res) => {
    try {
        const { ids, reason: rawReason } = req.body || {};

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "Select at least one entry to delete" });
        }
        if (ids.length > MAX_DELETE_PER_REQUEST) {
            return res.status(400).json({
                message: `You can delete at most ${MAX_DELETE_PER_REQUEST} entries at a time`
            });
        }
        // strings only: blocks operator objects like { "$ne": null }
        if (!ids.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))) {
            return res.status(400).json({ message: "Invalid entry ID" });
        }

        const reason = typeof rawReason === "string" ? rawReason.trim() : "";

        if (!reason) {
            return res.status(400).json({ message: "A reason for deleting is required" });
        }
        if (reason.length > 200) {
            return res.status(400).json({ message: "Reason must be 200 characters or fewer" });
        }

        const uniqueIds = [...new Set(ids)];
        const entries = await AuditLog.find({ _id: { $in: uniqueIds } }).lean();

        if (entries.length === 0) {
            return res.status(404).json({ message: "Those entries no longer exist" });
        }

        // 1) Record the deletion FIRST. If this fails, nothing is deleted,
        //    so an entry can never vanish without a trace.
        const deletion = await DeletionLog.create({
            actor: req.user.username,
            actorRole: req.user.role,
            reason,
            deletedCount: entries.length,
            entries: entries.map((e) => ({
                originalId: String(e._id),
                actor: e.actor,
                actorRole: e.actorRole,
                action: e.action,
                entityType: e.entityType,
                entityId: e.entityId,
                entityName: e.entityName,
                changes: e.changes || [],
                createdAt: e.createdAt
            }))
        });

        // 2) Delete the entries.
        try {
            await AuditLog.deleteMany({ _id: { $in: entries.map((e) => e._id) } });
        } catch (deleteError) {
            // roll back the record so the log doesn't claim something that
            // didn't happen (native call bypasses the append-only guard)
            await DeletionLog.collection
                .deleteOne({ _id: deletion._id })
                .catch((e) => console.error("Rollback of deletion log failed:", e));
            throw deleteError;
        }

        res.json({
            message: `${entries.length} audit entr${entries.length === 1 ? "y" : "ies"} deleted`,
            deletedCount: entries.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete audit entries" });
    }
});

// Read-only on purpose: nothing in the app can edit or delete these records.
router.get("/deletions", adminOnly, async (req, res) => {
    try {
        const { page, limit } = parsePaging(req.query);

        const range = parseRange(req.query);
        if (range.error) {
            return res.status(400).json({ message: range.error });
        }

        const filter = {};
        if (range.condition) filter.createdAt = range.condition;

        if (typeof req.query.actor === "string" && req.query.actor.trim()) {
            filter.actor = new RegExp(escapeRegex(req.query.actor.trim()), "i");
        }

        const [deletions, total] = await Promise.all([
            DeletionLog.find(filter)
                .sort(parseSort(req.query))
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            DeletionLog.countDocuments(filter)
        ]);

        res.json({
            deletions,
            total,
            sort: sortName(req.query),
            page,
            pages: Math.max(Math.ceil(total / limit), 1)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to get deletion log" });
    }
});

module.exports = router;