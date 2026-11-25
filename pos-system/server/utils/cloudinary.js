const { v2: cloudinary } = require("cloudinary");

const FOLDER = "pos-products";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

const isConfigured = () =>
    Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );

function uploadImage(buffer) {
    if (!isConfigured()) {
        const err = new Error("Image uploads are not configured on the server");
        err.status = 500;
        return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: FOLDER,
                resource_type: "image",
                transformation: [
                    {
                        width: 800,
                        height: 800,
                        crop: "fill",
                        gravity: "auto",
                        quality: "auto"
                    }
                ]
            },
            (error, result) => {
                if (error) {
                    console.error("Cloudinary upload error:", error);
                    const err = new Error(
                        `Cloudinary upload failed: ${error.message || "unknown error"}`
                    );
                    err.status = 502;
                    return reject(err);
                }
                resolve(result.secure_url);
            }
        );

        stream.end(buffer);
    });
}

function publicIdFromUrl(url) {
    if (!url || !isConfigured()) return null;

    const prefix = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
    if (!url.startsWith(prefix)) return null;

    const rest = url
        .slice(prefix.length)
        .split("?")[0]
        .replace(/^(?:[^/]+\/)*?v\d+\//, ""); 

    const withoutExt = rest.replace(/\.[^/.]+$/, "");

    return withoutExt.startsWith(`${FOLDER}/`) ? withoutExt : null;
}

async function deleteImageByUrl(url) {
    const publicId = publicIdFromUrl(url);
    if (!publicId) return;

    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    } catch (error) {
        console.error("Cloudinary delete failed:", error.message);
    }
}

module.exports = { uploadImage, deleteImageByUrl, isConfigured };