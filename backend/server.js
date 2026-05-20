const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// CONFIG
dotenv.config();

// DATABASE
const db = require("./config/db");

// APP
const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ROUTES
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");

// API ROUTES
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);

// HOME ROUTE
app.get("/", (req, res) => {
    res.send("E-Commerce Backend Running 🚀");
});

// 404 HANDLER
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// SERVER START
const PORT = process.env.PORT || 5000;

// Start server only after DB connection is successful
db.connect((error) => {
  if (error) {
    console.error('Failed to connect to the database. Server not started.');
    console.error(error);
    process.exit(1);
  } else {
    console.log('Database connected successfully ✅');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  }
});