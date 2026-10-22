const mongoose = require("mongoose");

const userSessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        username: {
            type: String,
            required: true,
            index: true
        },
        role: {
            type: String,
            enum: ["admin", "cashier"],
            required: true
        },
        loginAt: {
            type: Date,
            default: Date.now,
            required: true
        },
        lastSeenAt: {
            type: Date,
            default: Date.now,
            required: true,
            index: true
        },
        offlineAt: {
            type: Date,
            default: null,
            index: true
        },
        endedBy: {
            type: String,
            enum: ["logout", "inactivity", null],
            default: null
        }
    },
    {
        collection: "UserSession",
        versionKey: false
    }
);

module.exports = mongoose.model("UserSession", userSessionSchema);
