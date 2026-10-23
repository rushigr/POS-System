const express = require("express");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const UserSession = require("../models/UserSession");
const adminOnly = require("../middleware/adminMiddleware");
const { requireAuth } = require("../middleware/authMiddleware");
const { logAudit } = require("../utils/audit");

const router = express.Router();

// Which transactions this account may see.
//  - admins (and root): all of them
//  - cashiers: only the ones made by their own account. Newer sales are matched
//    by account ID. Older sales have no ID, so they fall back to the cashier
//    name (and get an ID stamped on them if the account is ever renamed).
const visibleTo = (user) => {
    if (user.role === "admin") return {};

    return {
        $or: [
            { cashierId: user.id },
            { cashier: user.username, cashierId: null }
        ]
    };
};

//GET transactions (own sales for cashiers, everything for admins)
router.get("/", requireAuth, async (req, res) => {
    try {
        const transactions = await Transaction.find(visibleTo(req.user))
            .sort({ createdAt: -1 });

        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to get transactions"
        });
    }
});

//CREATE transaction
router.post("/", requireAuth, async (req, res) => {
    try {
        const body = req.body || {};

        // Only these fields are accepted from the client. The cashier is always
        // the logged-in account, and a sale can never arrive already voided.
        const data = {
            transactionNumber: body.transactionNumber,
            items: body.items,
            subtotal: body.subtotal,
            discountType: body.discountType,
            discountRate: body.discountRate,
            discountAmount: body.discountAmount,
            total: body.total,
            amountPaid: body.amountPaid,
            change: body.change,
            paymentMethod: body.paymentMethod,
            cashier: req.user.username,
            cashierId: req.user.id,
            sessionId: null
        };

        // Only link the sale to a session that belongs to this account.
        if (typeof body.sessionId === "string" &&
            mongoose.isValidObjectId(body.sessionId) &&
            await UserSession.exists({ _id: body.sessionId, userId: req.user.id })) {
            data.sessionId = body.sessionId;
        }

        const transaction = await Transaction.create(data);

        res.status(201).json(transaction);
    } catch (error) {
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: "Invalid transaction data" });
        }

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