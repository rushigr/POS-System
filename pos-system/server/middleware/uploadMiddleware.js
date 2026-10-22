const multer = require("multer");

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED.includes(file.mimetype)) {
            return cb(new Error("INVALID_TYPE"));
        }
        cb(null, true);
    }
});

// Wrapper so upload problems come back as clean 400s instead of 500s.
const uploadProductImage = (req, res, next) => {
    upload.single("imageFile")(req, res, (err) => {
        if (!err) return next();

        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "Image must be 2 MB or smaller" });
        }
        if (err.message === "INVALID_TYPE") {
            return res.status(400).json({ message: "Image must be a JPG, PNG or WebP file" });
        }
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: "Invalid image upload" });
        }

        console.error(err);
        res.status(500).json({ message: "Image upload failed" });
    });
};

module.exports = uploadProductImage;