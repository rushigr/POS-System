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
            }
        }
    ],

    subtotal: {
        type: Number,
        required: true,
        min: 0
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