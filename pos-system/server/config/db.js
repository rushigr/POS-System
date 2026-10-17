const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected");
        console.log("Database:", mongoose.connection.name);
        console.log("Host:", mongoose.connection.host);

        console.log("Database:", User.db.name);
        console.log("Collection:", User.collection.name);
        console.log("Username received:", JSON.stringify(username));
        console.log("User count:", await User.countDocuments());
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;