const express = require("express");
const Transaction = require("../models/Transaction");

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
        const transaction = await Transaction.create(req.body);

        res.status(201).json(transaction);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create transaction"
        });
    }
});

module.exports = router;