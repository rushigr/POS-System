const mongoose = require("mongoose");

const changeSchema = new mongoose.Schema({
    field: { type: String, required: true },
    from: { type: mongoose.Schema.Types.Mixed },
    to: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const auditLogSchema = new mongoose.Schema({
    // who did it
    actor: { type: String, required: true },
    actorRole: { type: String, required: true },

    // PRODUCT_UPDATE, USER_DELETE
    action: { type: String, required: true },

    // what it was done to
    entityType: {
        type: String,
        required: true,
        enum: ["Product", "User"]
    },
    entityId: { type: String },
    entityName: { type: String }, // snapshot, so it still reads well after deletion

    // field-level before/after values
    changes: { type: [changeSchema], default: [] },

    createdAt: { type: Date, default: Date.now, immutable: true }
}, {
    collection: "AuditLog"
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);