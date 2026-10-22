const User = require("../models/User");

const adminOnly = async (req, res, next) => {
    try {
        const username = req.headers["x-username"];

        if (!username) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({
                message: "User not found"
            });
        }

        if (user.role !== "admin") {
            return res.status(403).json({
                message: "Admin access required"
            });
        }

        // make the acting admin available to route handlers (audit log)
        req.user = { id: user._id, username: user.username, role: user.role };

        next();

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Authorization failed"
        });
    }
};

module.exports = adminOnly;