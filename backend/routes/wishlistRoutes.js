// backend/routes/wishlist.routes.js

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const wishlistController = require("../controllers/wishlistController");
const { safeNumber, safeInteger } = require("../utils/helpers");

// ==================== VALIDATION MIDDLEWARE ====================
const validateProductId = (req, res, next) => {
  const productId = safeNumber(req.params.productId || req.body.productId);
  if (!productId || productId < 1) {
    return res.status(400).json({
      success: false,
      message: "Valid product ID is required",
    });
  }
  req.validatedProductId = productId;
  next();
};

const validateBatchProducts = (req, res, next) => {
  const { productIds } = req.body;
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Product IDs array is required",
    });
  }
  if (productIds.length > 50) {
    return res.status(400).json({
      success: false,
      message: "Maximum 50 products per batch operation",
    });
  }
  for (const id of productIds) {
    if (!safeNumber(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: `Invalid product ID: ${id}`,
      });
    }
  }
  next();
};

// ==================== PUBLIC ROUTES ====================
// Get shared wishlist by token (No auth required)
router.get("/share/:token", wishlistController.getSharedWishlist);

// ==================== PROTECTED ROUTES (User Only) ====================

// Get wishlist with pagination
router.get("/", authMiddleware, wishlistController.getUserWishlist);

// Check if product is in wishlist (Issue #777)
router.get("/status/:productId", authMiddleware, wishlistController.checkWishlistStatus);

// Add to wishlist
router.post(
  "/add",
  authMiddleware,
  validateProductId,
  wishlistController.addToWishlist,
);

// Batch add to wishlist
router.post(
  "/batch/add",
  authMiddleware,
  validateBatchProducts,
  wishlistController.batchAddToWishlist,
);

// Generate share link
router.post("/share", authMiddleware, wishlistController.generateShareLink);

// Sync wishlist (replace entire wishlist)
router.post("/sync", authMiddleware, wishlistController.syncWishlist);

// Remove from wishlist (using body)
router.post(
  "/remove",
  authMiddleware,
  validateProductId,
  wishlistController.removeFromWishlist,
);

// ==================== DELETE ROUTES ====================

// Remove from wishlist (using params - DELETE method)
router.delete(
  "/:productId",
  authMiddleware,
  validateProductId,
  wishlistController.removeFromWishlist,
);

// Batch remove from wishlist
router.delete(
  "/batch/remove",
  authMiddleware,
  validateBatchProducts,
  wishlistController.batchRemoveFromWishlist,
);

// Clear entire wishlist
router.delete("/clear/all", authMiddleware, wishlistController.clearWishlist);

// Clear wishlist cache
router.delete("/cache", authMiddleware, wishlistController.clearWishlistCache);

// ==================== ADMIN ROUTES ====================
// Get any user's wishlist (Admin only)
router.get(
  "/admin/:userId",
  authMiddleware,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const userId = safeInteger(req.params.userId);
      if (!userId || userId < 1) {
        return res.status(400).json({
          success: false,
          message: "Valid user ID is required",
        });
      }

      const [rows] = await require("../config/db").query(
        `
                SELECT 
                    p.id, 
                    p.name, 
                    p.price, 
                    p.image, 
                    p.brand, 
                    p.stock,
                    w.created_at as added_at,
                    u.name as user_name,
                    u.email as user_email
                FROM wishlist_items w
                JOIN products p ON w.product_id = p.id
                JOIN users u ON w.user_id = u.id
                WHERE w.user_id = ?
                ORDER BY w.created_at DESC
            `,
        [userId],
      );

      return res.status(200).json({
        success: true,
        data: rows,
      });
    } catch (error) {
      console.error("ADMIN GET WISHLIST ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch user wishlist",
      });
    }
  },
);

// Get wishlist stats (Admin only)
router.get(
  "/admin/stats/all",
  authMiddleware,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const db = require("../config/db");

      // Get total wishlist items across all users
      const [totalItems] = await db.query(
        "SELECT COUNT(*) as total FROM wishlist_items",
      );

      // Get unique users with wishlist
      const [uniqueUsers] = await db.query(
        "SELECT COUNT(DISTINCT user_id) as users FROM wishlist_items",
      );

      // Get most wishlisted products
      const [topProducts] = await db.query(`
                SELECT p.id, p.name, COUNT(*) as wishlist_count
                FROM wishlist_items w
                JOIN products p ON w.product_id = p.id
                GROUP BY p.id
                ORDER BY wishlist_count DESC
                LIMIT 10
            `);

      // Get recent activity
      const [recentActivity] = await db.query(`
                SELECT w.*, p.name as product_name, u.name as user_name
                FROM wishlist_items w
                JOIN products p ON w.product_id = p.id
                JOIN users u ON w.user_id = u.id
                ORDER BY w.created_at DESC
                LIMIT 20
            `);

      return res.status(200).json({
        success: true,
        data: {
          totalItems: totalItems[0]?.total || 0,
          uniqueUsers: uniqueUsers[0]?.users || 0,
          topProducts: topProducts,
          recentActivity: recentActivity,
        },
      });
    } catch (error) {
      console.error("WISHLIST STATS ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch wishlist stats",
      });
    }
  },
);

// ==================== ROUTE FALLBACK ====================
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Wishlist route not found",
  });
});

module.exports = router;