const mongoose = require("mongoose");

// Small key/value store for server-generated settings (e.g. the token secret).
const settingSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true },
        value: { type: String, required: true }
    },
    { collection: "Setting" }
);

module.exports = mongoose.model("Setting", settingSchema);