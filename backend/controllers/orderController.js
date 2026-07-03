const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const orderController = require("../controllers/orderController");
const { safeArray, safeNumber, sanitizeString } = require("../utils/helpers");

// Validate order ID
router.param("id", (req, res, next, id) => {
    const parsedId = parseInt(id, 10);
    if (!parsedId || parsedId < 1) {
        return res.status(400).json({
            success: false,
            message: "Invalid order ID"
        });
    }
    req.orderId = parsedId;
    next();
});

// Order API status
router.get("/status/check", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Order API running"
    });
});

// Validate order data (NEW - Public)
router.post("/validate", orderController.validateOrder);

// Create order
router.post("/", authMiddleware, (req, res, next) => {
    const { items, total, paymentMethod } = req.body;

    // Validate items
    if (!safeArray(items).length) {
        return res.status(400).json({
            success: false,
            message: "Order items are required"
        });
    }

    // Validate total
    if (safeNumber(total) <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid order total"
        });
    }

    // Validate payment method
    const allowedPayments = ["card", "cod", "upi", "paypal"];
    if (!allowedPayments.includes(sanitizeString(paymentMethod).toLowerCase())) {
        return res.status(400).json({
            success: false,
            message: "Invalid payment method"
        });
    }

    next();
}, orderController.createOrder);

// Get current user orders (with pagination & filtering)
router.get("/my-orders", authMiddleware, orderController.getUserOrders);

// Get order summary (NEW)
router.get("/:id/summary", authMiddleware, orderController.getOrderSummary);

// Get single order
router.get("/:id", authMiddleware, orderController.getOrderById);

// Get all orders (admin) with filters
router.get("/", authMiddleware, authorizeRoles("admin", "support"), (req, res, next) => {
    // Optional: Add additional validation for query params
    if (req.query.status) {
        const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
        if (!validStatuses.includes(sanitizeString(req.query.status).toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid status filter"
            });
        }
    }
    next();
}, orderController.getAllOrders);

// Update order status (with reason)
router.put("/:id/status", authMiddleware, authorizeRoles("admin", "support"), (req, res, next) => {
    const { status } = req.body;
    const allowedStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];

    if (!allowedStatuses.includes(sanitizeString(status).toLowerCase())) {
        return res.status(400).json({
            success: false,
            message: "Invalid order status"
        });
    }
    next();
}, orderController.updateOrderStatus);

// Cancel order (user) with reason
router.patch("/:id/cancel", authMiddleware, (req, res, next) => {
    // Optional: Validate cancellation reason
    if (req.body.reason && req.body.reason.length > 500) {
        return res.status(400).json({
            success: false,
            message: "Cancellation reason cannot exceed 500 characters"
        });
    }
    next();
}, orderController.cancelUserOrder);

// Route fallback
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Order route not found"
    });
});

module.exports = router;