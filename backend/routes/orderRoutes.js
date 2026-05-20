const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const orderController = require("../controllers/orderController");

// Create new order (protected)
router.post("/", authMiddleware, orderController.createOrder);

// Get all orders (admin only)
router.get("/", authMiddleware, adminMiddleware, orderController.getAllOrders);

// Get orders for current user
router.get("/my-orders", authMiddleware, orderController.getUserOrders);

// Update order status (admin only)
router.put("/:id/status", authMiddleware, adminMiddleware, orderController.updateOrderStatus);

module.exports = router;