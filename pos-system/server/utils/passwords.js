const bcrypt = require("bcryptjs");

const ROUNDS = 10;

// bcrypt hashes always start with $2a$, $2b$ or $2y$.
const isHashed = (value) => typeof value === "string" && /^\$2[aby]\$/.test(value);

const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);

/**
 * Check a login password. Accounts created before hashing was added still
 * hold plain text; those are compared as-is and `needsUpgrade` tells the
 * caller to re-save the password as a hash.
 */
async function verifyPassword(plain, stored) {
    if (typeof plain !== "string" || typeof stored !== "string") {
        return { ok: false, needsUpgrade: false };
    }

    if (isHashed(stored)) {
        return { ok: await bcrypt.compare(plain, stored), needsUpgrade: false };
    }

    return { ok: plain === stored, needsUpgrade: plain === stored };
}

module.exports = { hashPassword, verifyPassword, isHashed };