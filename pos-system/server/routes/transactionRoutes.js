const express = require("express");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const adminOnly = require("../middleware/adminMiddleware");
const { logAudit } = require("../utils/audit");

const router = express.Router();

//GET transactions
router.get("/", async (req, res) => {
    try {
        const transactions = await Transaction.find()
            .sort({ createdAt: -1 });

        res.json(transactions);
    } catch (error) {
        res.status(500).json({
            message: "Failed to get transactions"
        });
    }
});

//CREATE transaction
router.post("/", async (req, res) => {
    try {
        // a new sale can never arrive already voided
        const {
            status,
            voidedAt,
            voidedBy,
            voidReason,
            ...data
        } = req.body;

        const transaction = await Transaction.create(data);

        res.status(201).json(transaction);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create transaction"
        });
    }
});

//VOID transaction (admin only; a reason is required)
router.post("/:id/void", adminOnly, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid transaction ID" });
        }

        const reason =
            typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

        if (!reason) {
            return res.status(400).json({ message: "A reason for voiding is required" });
        }
        if (reason.length > 200) {
            return res.status(400).json({ message: "Reason must be 200 characters or fewer" });
        }

        // Atomic: only flips a transaction that is not already voided,
        // so two admins clicking at once can't both succeed.
        const transaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, status: { $ne: "voided" } },
            {
                $set: {
                    status: "voided",
                    voidedAt: new Date(),
                    voidedBy: req.user.username,
                    voidReason: reason
                }
            },
            { new: true }
        );

        if (!transaction) {
            const exists = await Transaction.exists({ _id: req.params.id });

            return res.status(exists ? 409 : 404).json({
                message: exists
                    ? "Transaction is already voided"
                    : "Transaction not found"
            });
        }

        await logAudit(req, {
            action: "TRANSACTION_VOID",
            entityType: "Transaction",
            entityId: transaction._id,
            entityName: transaction.transactionNumber,
            changes: [
                { field: "status", from: "completed", to: "voided" },
                { field: "total", from: transaction.total, to: null },
                { field: "reason", from: null, to: reason }
            ]
        });

        res.json(transaction);
    } catch (error) {
        console.error(error);

        res.status(500).json({ message: "Failed to void transaction" });
    }
});

module.exports = router;
