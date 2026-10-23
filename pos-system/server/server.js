const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const userRoutes = require("./routes/userRoutes");
const auditRoutes = require("./routes/auditRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const { ensureRootAccount } = require("./utils/rootAccount");
const { initJwtSecret } = require("./utils/jwtSecret");

const app = express();

const corsOptions = {
    origin: "https://pos-system-ten-lac.vercel.app",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization"
    ],
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options("/api/users", cors(corsOptions));

app.use(express.json());

app.get("/", (req, res) => {
    res.json({ message: "POS Backend is running" });
});

app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/sessions", sessionRoutes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        await initJwtSecret();
        await ensureRootAccount();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();