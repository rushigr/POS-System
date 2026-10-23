const User = require("../models/User");
const { hashPassword } = require("./passwords");
const { validatePassword } = require("./passwordStrength");

/**
 * Makes sure the root account exists. Runs at every start-up and does nothing
 * once a root account is present. No configuration is required:
 *
 *  1. If ROOT_USERNAME and ROOT_PASSWORD are set (optional), that account is
 *     created, or promoted if the username already exists.
 *  2. Otherwise the OLDEST existing admin account becomes root and keeps its
 *     current password.
 *  3. If there are no admins yet, nothing happens until one exists.
 *
 * Root status can never be granted through the API, only here.
 */
async function ensureRootAccount() {
    if (await User.findOne({ isRoot: true })) return;

    const username = (process.env.ROOT_USERNAME || "").trim();
    const password = process.env.ROOT_PASSWORD || "";

    if (username && password) {
        const found = await User.findOne({ username });

        if (found) {
            found.isRoot = true;
            found.role = "admin";
            await found.save();
            console.log(`Existing user "${username}" was promoted to the root account.`);
            return;
        }

        const problem = validatePassword(password, username);
        if (!problem) {
            await User.create({
                username,
                password: await hashPassword(password),
                role: "admin",
                isRoot: true
            });
            console.log(`Root account "${username}" created.`);
            return;
        }

        console.error(`ROOT_PASSWORD was rejected: ${problem}. Falling back to the oldest admin.`);
    }

    // ObjectIds grow with creation time, so the lowest _id is the oldest account.
    const oldestAdmin = await User.findOne({ role: "admin" }).sort({ _id: 1 });

    if (!oldestAdmin) {
        console.warn("No root account yet: there is no admin account to promote.");
        return;
    }

    oldestAdmin.isRoot = true;
    await oldestAdmin.save();
    console.log(`The oldest admin account "${oldestAdmin.username}" is now the root account.`);
}

module.exports = { ensureRootAccount };