const express = require("express");
const Product = require("../models/Product");
const adminOnly = require("../middleware/adminMiddleware");
const { logAudit, diffFields } = require("../utils/audit");

const router = express.Router();

const TRACKED = ["name", "category", "price", "image"];

const snapshot = (p) => ({
    name: p.name,
    category: p.category,
    price: p.price,
    image: p.image || ""
});

//GET all products
router.get("/", async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Failed to get products" });
    }
});

//GET one product
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Failed to get product" });
    }
});

//ADD product
router.post("/", adminOnly, async (req, res) => {
    try {
        const { name, category, price, image } = req.body;

        const product = await Product.create({ name, category, price, image });

        await logAudit(req, {
            action: "PRODUCT_CREATE",
            entityType: "Product",
            entityId: product._id,
            entityName: product.name,
            changes: TRACKED.map((field) => ({
                field,
                from: null,
                to: snapshot(product)[field]
            }))
        });

        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ message: "Failed to add product" });
    }
});

//UPDATE product
router.put("/:id", adminOnly, async (req, res) => {
    try {
        const existing = await Product.findById(req.params.id);

        if (!existing) {
            return res.status(404).json({ message: "Product not found" });
        }

        const before = snapshot(existing);
        const { name, category, price, image } = req.body;

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { name, category, price, image },
            { new: true, runValidators: true }
        );

        const changes = diffFields(before, snapshot(product), TRACKED);

        if (changes.length > 0) {
            await logAudit(req, {
                action: "PRODUCT_UPDATE",
                entityType: "Product",
                entityId: product._id,
                entityName: product.name,
                changes
            });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Failed to update product" });
    }
});

//DELETE product
router.delete("/:id", adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        await logAudit(req, {
            action: "PRODUCT_DELETE",
            entityType: "Product",
            entityId: product._id,
            entityName: product.name,
            changes: TRACKED.map((field) => ({
                field,
                from: snapshot(product)[field],
                to: null
            }))
        });

        res.json({ message: "Product deleted" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete product" });
    }
});

module.exports = router;