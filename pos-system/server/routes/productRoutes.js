const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const adminOnly = require("../middleware/adminMiddleware");
const uploadProductImage = require("../middleware/uploadMiddleware");
const { logAudit, diffFields } = require("../utils/audit");
const { uploadImage, deleteImageByUrl } = require("../utils/cloudinary");

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

// Validates the text fields; returns { error } or { name, category, price }.
// Values arrive as strings because the form is sent as multipart/form-data.
const parseFields = (body) => {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const price = Number(body.price);

    if (!name) return { error: "Product name is required" };
    if (!category) return { error: "Category is required" };
    if (body.price === "" || body.price == null || Number.isNaN(price) || price < 0) {
        return { error: "Enter a valid price" };
    }

    return { name, category, price };
};

const isHttpUrl = (value) => /^https?:\/\//i.test(value);

//ADD product (multipart: name, category, price, optional imageFile or image URL)
router.post("/", adminOnly, uploadProductImage, async (req, res) => {
    let uploadedUrl = null;

    try {
        const fields = parseFields(req.body);
        if (fields.error) {
            return res.status(400).json({ message: fields.error });
        }

        let image = "";

        if (req.file) {
            uploadedUrl = await uploadImage(req.file.buffer);
            image = uploadedUrl;
        } else if (typeof req.body.image === "string" && req.body.image.trim()) {
            if (!isHttpUrl(req.body.image.trim())) {
                return res.status(400).json({ message: "Image URL must start with http:// or https://" });
            }
            image = req.body.image.trim();
        }

        const product = await Product.create({ ...fields, image });

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
        console.error(error);
        // don't leave an orphaned upload behind if saving failed
        if (uploadedUrl) await deleteImageByUrl(uploadedUrl);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Failed to add product"
        });
    }
});

//UPDATE product
router.put("/:id", adminOnly, uploadProductImage, async (req, res) => {
    let uploadedUrl = null;

    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid product ID" });
        }

        const existing = await Product.findById(req.params.id);

        if (!existing) {
            return res.status(404).json({ message: "Product not found" });
        }

        const fields = parseFields(req.body);
        if (fields.error) {
            return res.status(400).json({ message: fields.error });
        }

        const before = snapshot(existing);
        let image = existing.image || "";

        if (req.file) {
            // a new upload always wins
            uploadedUrl = await uploadImage(req.file.buffer);
            image = uploadedUrl;
        } else if (req.body.removeImage === "true") {
            image = "";
        } else if (typeof req.body.image === "string") {
            const url = req.body.image.trim();
            if (url && !isHttpUrl(url)) {
                return res.status(400).json({ message: "Image URL must start with http:// or https://" });
            }
            image = url;
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { ...fields, image },
            { new: true, runValidators: true }
        );

        // the old Cloudinary image is no longer used
        if (before.image && before.image !== image) {
            await deleteImageByUrl(before.image);
        }

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
        console.error(error);
        if (uploadedUrl) await deleteImageByUrl(uploadedUrl);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Failed to update product"
        });
    }
});

//DELETE product
router.delete("/:id", adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        await deleteImageByUrl(product.image);

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