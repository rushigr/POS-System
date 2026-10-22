const AuditLog = require("../models/AuditLog");

/**
 * Compare two plain objects and return [{ field, from, to }] for every
 * listed field whose value changed.
 */
function diffFields(before, after, fields) {
    const changes = [];

    for (const field of fields) {
        const from = before[field];
        const to = after[field];

        if (String(from ?? "") !== String(to ?? "")) {
            changes.push({ field, from: from ?? null, to: to ?? null });
        }
    }

    return changes;
}

/**
 * Write one audit entry. Requires req.user (set by adminMiddleware).
 * A logging failure is reported to the console but never breaks the
 * admin's actual request.
 *
 * NEVER put passwords or other secrets in `changes`.
 */
async function logAudit(req, { action, entityType, entityId, entityName, changes = [] }) {
    try {
        await AuditLog.create({
            actor: req.user?.username || "unknown",
            actorRole: req.user?.role || "unknown",
            action,
            entityType,
            entityId: entityId ? String(entityId) : undefined,
            entityName,
            changes
        });
    } catch (error) {
        console.error("Audit log write failed:", error);
    }
}

module.exports = { logAudit, diffFields };