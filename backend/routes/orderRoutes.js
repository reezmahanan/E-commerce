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

// ==================== NEW PUBLIC ENDPOINTS ====================

// Validate order data before submission (NEW)
router.post("/validate", orderController.validateOrder);

// ==================== USER ENDPOINTS ====================

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

// Get current user orders with pagination and filtering (ENHANCED)
router.get("/my-orders", authMiddleware, (req, res, next) => {
    // Validate status filter if provided
    if (req.query.status) {
        const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
        if (!validStatuses.includes(sanitizeString(req.query.status).toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid status filter"
            });
        }
    }
    
    // Validate page number
    if (req.query.page && (isNaN(req.query.page) || parseInt(req.query.page) < 1)) {
        return res.status(400).json({
            success: false,
            message: "Invalid page number"
        });
    }
    
    next();
}, orderController.getUserOrders);

// Get order summary (NEW)
router.get("/:id/summary", authMiddleware, orderController.getOrderSummary);

// Get single order with items (ENHANCED)
router.get("/:id", authMiddleware, orderController.getOrderById);

// Cancel order with reason (ENHANCED)
router.patch("/:id/cancel", authMiddleware, (req, res, next) => {
    // Validate cancellation reason
    if (req.body.reason && req.body.reason.length > 500) {
        return res.status(400).json({
            success: false,
            message: "Cancellation reason cannot exceed 500 characters"
        });
    }
    next();
}, orderController.cancelUserOrder);

// ==================== ADMIN ENDPOINTS ====================

// Get all orders with filters (ENHANCED)
router.get("/", authMiddleware, authorizeRoles("admin", "support"), (req, res, next) => {
    // Validate status filter
    if (req.query.status) {
        const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
        if (!validStatuses.includes(sanitizeString(req.query.status).toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid status filter"
            });
        }
    }
    
    // Validate date filters
    if (req.query.date_from && isNaN(Date.parse(req.query.date_from))) {
        return res.status(400).json({
            success: false,
            message: "Invalid date_from format"
        });
    }
    
    if (req.query.date_to && isNaN(Date.parse(req.query.date_to))) {
        return res.status(400).json({
            success: false,
            message: "Invalid date_to format"
        });
    }
    
    next();
}, orderController.getAllOrders);

// Update order status with reason (ENHANCED)
router.put("/:id/status", authMiddleware, authorizeRoles("admin", "support"), (req, res, next) => {
    const { status, reason } = req.body;
    
    const allowedStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    if (!allowedStatuses.includes(sanitizeString(status).toLowerCase())) {
        return res.status(400).json({
            success: false,
            message: "Invalid order status"
        });
    }
    
    // Validate reason length if provided
    if (reason && reason.length > 500) {
        return res.status(400).json({
            success: false,
            message: "Reason cannot exceed 500 characters"
        });
    }
    
    next();
}, orderController.updateOrderStatus);

// ==================== BULK OPERATIONS (Optional) ====================

// Bulk update order status (NEW - Admin only)
router.patch("/bulk/status", authMiddleware, authorizeRoles("admin"), async (req, res) => {
    try {
        const { orderIds, status } = req.body;
        
        if (!Array.isArray(orderIds) || !orderIds.length) {
            return res.status(400).json({
                success: false,
                message: "Order IDs are required"
            });
        }
        
        const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
        if (!validStatuses.includes(sanitizeString(status).toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status"
            });
        }
        
        const results = [];
        for (const orderId of orderIds) {
            try {
                const result = await orderController.updateOrderStatusService(
                    orderId, 
                    status, 
                    req.user.id
                );
                results.push({ orderId, success: true, result });
            } catch (error) {
                results.push({ orderId, success: false, error: error.message });
            }
        }
        
        res.status(200).json({
            success: true,
            message: "Bulk status update completed",
            results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Route fallback
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Order route not found"
    });
});

module.exports = router;