const express = require("express");
const router = express.Router();

const {
    getProducts,
    getSingleProduct,
    createProduct,
    updateProduct,
    DeleteeProduct,
    getProductSuggestions
} = require("../controllers/productController");
<<<<<<< HEAD
const {
    getProductReviews,
    createProductReview,
    deleteProductReview
} = require("../controllers/reviewController");
=======

>>>>>>> 76d9fb2a590eb1302b4a3cd0c621f7d1a65492c4
const authMiddleware = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { validateCreateProduct, validateUpdateProduct } = require("../middleware/validators/productValidator");

// --------------------------------------------------------------
// Validate product ID
// --------------------------------------------------------------
router.param("id", (req, res, next, id) => {
    const parsedId = parseInt(id, 10);
    if (!parsedId || parsedId < 1) {
        return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    req.productId = parsedId;
    next();
});

// --------------------------------------------------------------
// Routes
// --------------------------------------------------------------
router.get("/status/check", (req, res) => {
    res.status(200).json({ success: true, message: "Product API running" });
});

router.get("/search-suggestions", getProductSuggestions);
router.get("/", getProducts);
<<<<<<< HEAD
router.get("/search-suggestions", getProductSuggestions);
router.get("/:id/reviews", getProductReviews);
router.post("/:id/review", authMiddleware, createProductReview);
router.delete(
    "/:id/reviews/:reviewId",
    authMiddleware,
    authorizeRoles("admin"),
    deleteProductReview
);
router.get("/:id", getSingleProduct);
=======
router.get("/:id", getSingleProduct);

router.post("/", authMiddleware, authorizeRoles("admin"), validateCreateProduct, createProduct);
>>>>>>> 76d9fb2a590eb1302b4a3cd0c621f7d1a65492c4

router.put("/:id", authMiddleware, authorizeRoles("admin"), validateUpdateProduct, updateProduct);

<<<<<<< HEAD
router.put("/:id", authMiddleware, authorizeRoles("admin"), (req, res, next) => {
    const { name, category, price, stock } = req.body;
    if (name !== undefined && !sanitizeString(name)) {
        return res.status(400).json({ success: false, message: "Product name cannot be empty" });
    }
    if (category !== undefined && !sanitizeString(category)) {
        return res.status(400).json({ success: false, message: "Category cannot be empty" });
    }
    if (price !== undefined && safeNumber(price) < 0) {
        return res.status(400).json({ success: false, message: "Price cannot be negative" });
    }
    if (stock !== undefined && safeNumber(stock) < 0) {
        return res.status(400).json({ success: false, message: "Stock cannot be negative" });
    }
    next();
}, updateProduct);

=======
>>>>>>> 76d9fb2a590eb1302b4a3cd0c621f7d1a65492c4
router.delete("/:id", authMiddleware, authorizeRoles("admin"), DeleteeProduct);

// Fallback
router.use((req, res) => {
    res.status(404).json({ success: false, message: "Product route not found" });
});

module.exports = router;