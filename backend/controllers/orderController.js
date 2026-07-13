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

// ========================================
// GET ORDER STATUS (Issue #778)
// ========================================
const getOrderStatus = async (req, res) => {
    const orderId = safeInteger(req.params.id);

    if (!orderId) {
        return res.status(400).json({
            success: false,
            message: "Invalid order ID"
        });
    }

    try {
        // Check if order exists and belongs to user
        let query = `
            SELECT o.id, o.total, o.created_at, o.status, o.shipping_address,
                   o.estimated_delivery, o.tracking_number,
                   o.customer_name, o.customer_email, o.payment_method
            FROM orders o
            WHERE o.id = ?
        `;
        const queryParams = [orderId];

        if (req.user.role !== "admin") {
            query += ` AND o.user_id = ?`;
            queryParams.push(req.user.id);
        }

        const [orderRows] = await db.query(query, queryParams);

        if (!safeArray(orderRows).length) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const order = orderRows[0];

        // Get order items
        const [items] = await db.query(
            `SELECT product_name, quantity, price
             FROM order_items
             WHERE order_id = ?`,
            [orderId]
        );

        // Status timeline
        const statuses = ['pending', 'processing', 'shipped', 'delivered'];
        const currentStatusIndex = statuses.indexOf(order.status.toLowerCase());
        const timeline = statuses.map((status, index) => ({
            status: status,
            completed: index <= currentStatusIndex,
            active: index === currentStatusIndex,
            label: status.charAt(0).toUpperCase() + status.slice(1),
            date: index === currentStatusIndex ? order.created_at : null
        }));

        // Check if each status has a timestamp
        // For now, we'll use created_at as the date for all completed statuses
        // In real scenario, you'd have separate columns for each status timestamp
        const statusTimestamps = {
            pending: order.created_at,
            processing: order.processing_at || (currentStatusIndex >= 1 ? order.created_at : null),
            shipped: order.shipped_at || (currentStatusIndex >= 2 ? order.created_at : null),
            delivered: order.delivered_at || (currentStatusIndex >= 3 ? order.created_at : null)
        };

        res.json({
            success: true,
            data: {
                id: order.id,
                total: order.total,
                created_at: order.created_at,
                status: order.status,
                shipping_address: order.shipping_address || 'Not available',
                estimated_delivery: order.estimated_delivery || 'Not available',
                tracking_number: order.tracking_number || 'Not available',
                customer_name: order.customer_name,
                customer_email: order.customer_email,
                payment_method: order.payment_method,
                items: safeArray(items).map(item => ({
                    product_name: item.product_name,
                    quantity: item.quantity,
                    price: item.price
                })),
                timeline: timeline.map(t => ({
                    ...t,
                    date: statusTimestamps[t.status] || null
                }))
            }
        });
    } catch (error) {
        console.error("Get order status error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// shared helper for updating order status and managing inventory
const performOrderStatusUpdate = async (connection, id, currentStatus, newStatus) => {
    // if cancelling a previously un-cancelled order, restore stock
    if (newStatus === "cancelled" && currentStatus !== "cancelled") {
        const [items] = await connection.query(
            "SELECT product_id, qty FROM order_items WHERE order_id = ?",
            [id]
        );

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
};

module.exports = {
    createOrder,
    getAllOrders,
    getUserOrders,
    getOrderById,
    getOrderStatus,
    updateOrderStatus,
    cancelUserOrder
};
