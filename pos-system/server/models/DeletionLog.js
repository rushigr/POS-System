const mongoose = require("mongoose");

// A frozen copy of one audit entry, saved at the moment it was deleted.
const deletedEntrySchema = new mongoose.Schema({
    originalId: { type: String, required: true },
    actor: { type: String },
    actorRole: { type: String },
    action: { type: String },
    entityType: { type: String },
    entityId: { type: String },
    entityName: { type: String },
    changes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdAt: { type: Date }
}, { _id: false });

const deletionLogSchema = new mongoose.Schema({
    // who deleted the entries
    actor: { type: String, required: true, immutable: true },
    actorRole: { type: String, required: true, immutable: true },

    reason: { type: String, required: true, maxlength: 200, immutable: true },

    deletedCount: { type: Number, required: true, immutable: true },

    // full snapshot of everything that was removed
    entries: { type: [deletedEntrySchema], default: [], immutable: true },

    createdAt: { type: Date, default: Date.now, immutable: true }
}, {
    collection: "DeletionLog"
});

deletionLogSchema.index({ createdAt: -1 });
deletionLogSchema.index({ actor: 1, createdAt: -1 });

// Append-only: once written, a deletion record can't be edited or removed
// through the app. (There are also no routes for it.)
const blocked = () => {
    throw new Error("Deletion log entries are permanent and cannot be modified");
};

deletionLogSchema.pre(
    [
        "updateOne", "updateMany", "replaceOne",
        "findOneAndUpdate", "findOneAndReplace", "findOneAndDelete",
        "deleteOne", "deleteMany"
    ],
    blocked
);
deletionLogSchema.pre("deleteOne", { document: true, query: false }, blocked);
deletionLogSchema.pre("save", function () {
    if (!this.isNew) blocked();
});

module.exports = mongoose.model("DeletionLog", deletionLogSchema);