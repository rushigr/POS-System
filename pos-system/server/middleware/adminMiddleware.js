// Kept so existing `require("../middleware/adminMiddleware")` imports keep working.
// Identity now comes from a signed login token (see authMiddleware.js),
// not from the old, forgeable x-username header.
const { requireAdmin } = require("./authMiddleware");

module.exports = requireAdmin;