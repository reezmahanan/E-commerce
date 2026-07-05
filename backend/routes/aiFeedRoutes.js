// backend/routes/aiFeedRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db').promise;
const structuredData = require('../services/structuredDataService');

/**
 * GET /api/ai-feed/products
 * Get product feed for AI agents
 */
router.get('/products', async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const [products] = await db.query(
            `SELECT * FROM products 
             WHERE stock > 0 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [parseInt(limit), parseInt(offset)]
        );

        const feed = structuredData.generateAIFeed(products);

        res.json({
            success: true,
            data: feed,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: products.length
            },
            timestamp: new Date().toISOString(),
            version: '2.0.0'
        });
    } catch (error) {
        console.error('AI Feed error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate AI feed'
        });
    }
});

/**
 * GET /api/ai-feed/product/:id
 * Get single product for AI agents
 */
router.get('/product/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [products] = await db.query(
            `SELECT * FROM products WHERE id = ?`,
            [id]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        const product = products[0];
        const schema = structuredData.generateProductSchema(product);

        res.json({
            success: true,
            data: product,
            structuredData: schema,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Product feed error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get product'
        });
    }
});

/**
 * GET /api/ai-feed/sitemap
 * Get sitemap for AI agents
 */
router.get('/sitemap', async (req, res) => {
    try {
        const [products] = await db.query(
            `SELECT id, updated_at FROM products WHERE stock > 0`
        );

        const sitemap = structuredData.generateSitemap(products);

        res.json({
            success: true,
            data: sitemap,
            count: sitemap.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Sitemap error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate sitemap'
        });
    }
});

/**
 * GET /api/ai-feed/categories
 * Get categories for AI agents
 */
router.get('/categories', async (req, res) => {
    try {
        const [categories] = await db.query(
            `SELECT DISTINCT category, COUNT(*) as product_count 
             FROM products 
             WHERE stock > 0 
             GROUP BY category`
        );

        res.json({
            success: true,
            data: categories,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get categories'
        });
    }
});

module.exports = router;