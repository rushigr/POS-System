const crypto = require("crypto");
const Setting = require("../models/Setting");

let secret = null;

/**
 * Loads the secret used to sign login tokens. No configuration needed:
 *  - JWT_SECRET (32+ chars), if you choose to set it, is used as-is.
 *  - Otherwise a random secret is generated on first start and saved in the
 *    database, so tokens survive restarts and every server instance agrees.
 */
async function initJwtSecret() {
    const fromEnv = process.env.JWT_SECRET;

    if (fromEnv && fromEnv.length >= 32) {
        secret = fromEnv;
        return;
    }

    // Atomic upsert: if two instances start at once, both end up with the same value.
    const doc = await Setting.findOneAndUpdate(
        { key: "jwtSecret" },
        { $setOnInsert: { value: crypto.randomBytes(48).toString("hex") } },
        { upsert: true, new: true }
    );

    secret = doc.value;
}

function getJwtSecret() {
    if (!secret) throw new Error("JWT secret not initialised");
    return secret;
}

module.exports = { initJwtSecret, getJwtSecret };