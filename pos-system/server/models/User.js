const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    role: {
        type: String,
        required: true,
        enum: ["admin", "cashier"]
    },

    // The root account is an admin that cannot be deleted, demoted or renamed,
    // and that alone can delete logs. It is created at server start-up from the
    // ROOT_USERNAME / ROOT_PASSWORD environment variables and can never be
    // set through the API.
    isRoot: {
        type: Boolean,
        default: false
    }
}, {
    collection: "User"
});

// At most one root account can exist.
userSchema.index(
    { isRoot: 1 },
    { unique: true, partialFilterExpression: { isRoot: true } }
);

module.exports = mongoose.model("User", userSchema);