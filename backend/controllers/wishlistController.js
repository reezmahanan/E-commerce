const promisePool = require("../config/db");
const { safeNumber } = require("../utils/helpers");

const wishlistController = {
    // Get user wishlist
    getUserWishlist: async (req, res) => {
        try {
            const userId = req.user.id;

            const [rows] = await promisePool.query(`
                SELECT 
                    p.id, 
                    p.name, 
                    p.price, 
                    p.image, 
                    p.brand, 
                    p.stock,
                    w.created_at as added_at
                FROM wishlist_items w
                JOIN products p ON w.product_id = p.id
                WHERE w.user_id = ?
                ORDER BY w.created_at DESC
            `, [userId]);

            return res.status(200).json({
                success: true,
                wishlist: rows
            });

        } catch (error) {
            console.error("GET WISHLIST ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch wishlist"
            });
        }
    },

    // Check if product is in user's wishlist (Issue #777)
    checkWishlistStatus: async (req, res) => {
        try {
            const userId = req.user.id;
            const productId = safeNumber(req.params.productId);

            if (!productId || productId < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Valid product ID is required"
                });
            }

            const [rows] = await promisePool.query(
                "SELECT id FROM wishlist_items WHERE user_id = ? AND product_id = ?",
                [userId, productId]
            );

            return res.status(200).json({
                success: true,
                inWishlist: rows.length > 0
            });

        } catch (error) {
            console.error("CHECK WISHLIST STATUS ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to check wishlist status"
            });
        }
    },

    // Add to wishlist
    addToWishlist: async (req, res) => {
        try {
            const userId = req.user.id;
            const productId = safeNumber(req.body.productId);

            if (!productId || productId < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Valid product ID is required"
                });
            }

            const [products] = await promisePool.query(
                "SELECT id FROM products WHERE id = ?",
                [productId]
            );

            if (!products.length) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            await promisePool.query(`
                INSERT IGNORE INTO wishlist_items (user_id, product_id)
                VALUES (?, ?)
            `, [userId, productId]);

            return res.status(200).json({
                success: true,
                message: "Added to wishlist",
                action: "added"
            });

        } catch (error) {
            console.error("ADD TO WISHLIST ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to add to wishlist"
            });
        }
    },

    // Remove from wishlist
    removeFromWishlist: async (req, res) => {
        try {
            const userId = req.user.id;
            const productId = safeNumber(req.body.productId);

            if (!productId || productId < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Valid product ID is required"
                });
            }

            const [result] = await promisePool.query(`
                DELETE FROM wishlist_items 
                WHERE user_id = ? AND product_id = ?
            `, [userId, productId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Item not found in wishlist"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Removed from wishlist",
                action: "removed"
            });

        } catch (error) {
            console.error("REMOVE FROM WISHLIST ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to remove from wishlist"
            });
        }
    }
};

module.exports = wishlistController;