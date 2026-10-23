const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    transactionNumber: {
        type: String,
        required: true,
        unique: true
    },

    cashier: {
        type: String,
        required: true
    },

    // The account that made the sale. Set by the server from the login token.
    // Older transactions have none and are matched by the `cashier` name.
    cashierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true
    },

    // Associates the sale with the login session that created it.
    // Optional for backwards compatibility with older transactions.
    sessionId: {
        type: String,
        default: null,
        index: true
    },

    items: [
        {
            name: {
                type: String,
                required: true
            },

            price: {
                type: Number,
                required: true
            },

            quantity: {
                type: Number,
                required: true,
                min: 1
            },

            notes: {
                type: String,
                trim: true,
                maxlength: 300,
                default: ""
            }
        }
    ],

    subtotal: {
        type: Number,
        required: true,
        min: 0
    },

    discountType: {
        type: String,
        enum: ["none", "senior_citizen", "pwd", "custom"],
        default: "none"
    },

    discountRate: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },

    discountAmount: {
        type: Number,
        min: 0,
        default: 0
    },

    total: {
        type: Number,
        required: true,
        min: 0
    },

    amountPaid: {
        type: Number,
        required: true,
        min: 0
    },

    change: {
        type: Number,
        required: true,
        min: 0
    },

    paymentMethod: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    },

    // Voiding keeps the record (for audit/reporting) but removes it from sales totals.
    // Older documents have no status; treat a missing status as "completed".
    status: {
        type: String,
        enum: ["completed", "voided"],
        default: "completed"
    },
    voidedAt: { type: Date },
    voidedBy: { type: String },
    voidReason: { type: String, maxlength: 200 }
}, {
    collection: "Transaction"
});

module.exports = mongoose.model("Transaction", transactionSchema);