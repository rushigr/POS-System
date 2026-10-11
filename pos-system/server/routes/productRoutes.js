const express = require("express");
const Product = require("../models/Product");
const adminOnly = require("../middleware/adminMiddleware");

const router = express.Router();

//GET all products
router.get("/", async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        res.status(500).json({
            message: "Failed to get products"
        });
    }
});

//GET one product
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({
            message: "Failed to get product"
        });
    }
});

//ADD product
router.post("/", adminOnly, async (req, res) => {
    try {
        const { name, category, price } = req.body;

        const product = await Product.create({
            name,
            category,
            price
        });

        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({
            message: "Failed to add product"
        });
    }
});

//UPDATE product
router.put("/:id", adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({
            message: "Failed to update product"
        });
    }
});

//DELETE product
router.delete("/:id", adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(
            req.params.id
        );

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json({
            message: "Product deleted"
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete product"
        });
    }
});

module.exports = router;