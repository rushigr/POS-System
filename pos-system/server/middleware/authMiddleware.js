const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getJwtSecret } = require("../utils/jwtSecret");

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

function signToken(user, sessionId) {
    return jwt.sign(
        { sub: String(user._id), sid: sessionId ? String(sessionId) : undefined },
        getJwtSecret(),
        { expiresIn: EXPIRES_IN }
    );
}

/**
 * Verifies the "Authorization: Bearer <token>" header, then loads the user
 * from the database so a deleted account or a changed role takes effect
 * immediately instead of when the token expires.
 *
 * Sets req.user = { id, username, role, isRoot }.
 */
const requireAuth = async (req, res, next) => {
    try {
        const header = req.headers.authorization || "";
        const [scheme, token] = header.split(" ");

        if (scheme !== "Bearer" || !token) {
            return res.status(401).json({ message: "Authentication required" });
        }

        let payload;
        try {
            payload = jwt.verify(token, getJwtSecret());
        } catch {
            return res.status(401).json({
                message: "Your session has expired. Please log in again."
            });
        }

        const user = await User.findById(payload.sub);

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        req.user = {
            id: user._id,
            username: user.username,
            role: user.role,
            isRoot: user.isRoot === true
        };

        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Authorization failed" });
    }
};

// Admins, and the root account (which is an admin).
const requireAdmin = (req, res, next) =>
    requireAuth(req, res, () => {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }
        next();
    });

// The root account only.
const requireRoot = (req, res, next) =>
    requireAuth(req, res, () => {
        if (!req.user.isRoot) {
            return res.status(403).json({ message: "Root access required" });
        }
        next();
    });

module.exports = { signToken, requireAuth, requireAdmin, requireRoot };