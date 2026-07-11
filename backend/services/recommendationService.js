const db = require("../config/db");
const { INTERACTION_TYPES } = require("../constants/interactionTypes");
const NodeCache = require('node-cache');

const config = {
    cacheTTL: parseInt(process.env.RECOMMENDATION_CACHE_TTL) || 300,
    interactionLimit: parseInt(process.env.INTERACTION_LIMIT) || 100,
    defaultLimit: parseInt(process.env.DEFAULT_LIMIT) || 8,
    maxLimit: parseInt(process.env.MAX_LIMIT) || 50,
    weights: {
        [INTERACTION_TYPES.PURCHASE]: parseInt(process.env.WEIGHT_PURCHASE) || 5,
        [INTERACTION_TYPES.CART_ADD]: parseInt(process.env.WEIGHT_CART) || 3,
        [INTERACTION_TYPES.WISHLIST_ADD]: parseInt(process.env.WEIGHT_WISHLIST) || 2,
        [INTERACTION_TYPES.VIEW]: parseInt(process.env.WEIGHT_VIEW) || 1
    }
};

const cache = new NodeCache({
    stdTTL: config.cacheTTL,
    checkperiod: 60
});

function validateUserId(userId) {
    if (!userId || isNaN(parseInt(userId))) {
        throw new Error('Invalid user ID');
    }
    return parseInt(userId);
}

function validateLimit(limit) {
    const parsed = parseInt(limit) || config.defaultLimit;
    if (parsed < 1) {
        throw new Error('Limit must be greater than 0');
    }
    if (parsed > config.maxLimit) {
        throw new Error(`Limit cannot exceed ${config.maxLimit}`);
    }
    return parsed;
}

function validateOffset(offset) {
    const parsed = parseInt(offset) || 0;
    if (parsed < 0) {
        throw new Error('Offset must be greater than or equal to 0');
    }
    return parsed;
}

function getCacheKey(userId, limit, offset) {
    return `recommendations_${userId}_${limit}_${offset}`;
}

const recommendationService = {
    getRecommendations: async (userId, limit = config.defaultLimit, offset = 0) => {
        try {
            const validUserId = validateUserId(userId);
            const validLimit = validateLimit(limit);
            const validOffset = validateOffset(offset);

            const cacheKey = getCacheKey(validUserId, validLimit, validOffset);
            const cached = cache.get(cacheKey);
            if (cached) {
                console.log(`Cache hit for user ${validUserId}`);
                return cached;
            }

            const [interactions] = await db.query(
                `
                SELECT ui.interaction_type, p.category, ui.product_id
                FROM user_interactions ui
                JOIN products p ON ui.product_id = p.id
                WHERE ui.user_id = ?
                ORDER BY ui.created_at DESC
                LIMIT ?
                `,
                [validUserId, config.interactionLimit]
            );

            if (!interactions || interactions.length === 0) {
                const fallback = await getFallbackRecommendations(validLimit);
                cache.set(cacheKey, fallback);
                return fallback;
            }

            const weights = config.weights;
            const categoryScores = {};
            interactions.forEach((item) => {
                if (!item.category) return;
                const weight = weights[item.interaction_type] || 1;
                categoryScores[item.category] =
                    (categoryScores[item.category] || 0) + weight;
            });

            const topCategories = Object.entries(categoryScores)
                .sort((a, b) => b[1] - a[1])
                .map((entry) => entry[0]);

            if (topCategories.length === 0) {
                const fallback = await getFallbackRecommendations(validLimit);
                cache.set(cacheKey, fallback);
                return fallback;
            }

            const [purchased] = await db.query(
                `
                SELECT product_id
                FROM user_interactions
                WHERE user_id = ? AND interaction_type = ?
                `,
                [validUserId, INTERACTION_TYPES.PURCHASE]
            );

            const purchasedIds = purchased.map((p) => p.product_id);
            const categoryPlaceholders = topCategories.map(() => "?").join(",");

            let query = `
                SELECT * FROM products
                WHERE category IN (${categoryPlaceholders})
                AND stock > 0
                AND status = 'active'
            `;

            const queryParams = [...topCategories];

            if (purchasedIds.length > 0) {
                const idPlaceholders = purchasedIds.map(() => "?").join(",");
                query += ` AND id NOT IN (${idPlaceholders})`;
                queryParams.push(...purchasedIds);
            }

            query += ` ORDER BY rating DESC, num_reviews DESC LIMIT ? OFFSET ?`;
            queryParams.push(validLimit, validOffset);

            const [recommendedProducts] = await db.query(query, queryParams);

            const result = {
                data: recommendedProducts,
                pagination: {
                    limit: validLimit,
                    offset: validOffset,
                    total: recommendedProducts.length
                }
            };

            cache.set(cacheKey, result);

            console.log(`Recommendations generated for user ${validUserId}: ${recommendedProducts.length} products`);

            return result;

        } catch (error) {
            console.error("Error generating recommendations:", error);
            throw error;
        }
    },

    getTrendingRecommendations: async (limit = config.defaultLimit) => {
        try {
            const validLimit = validateLimit(limit);

            const [products] = await db.query(
                `
                SELECT p.*, 
                       COUNT(ui.id) as interaction_count,
                       AVG(ui.rating) as avg_rating
                FROM products p
                LEFT JOIN user_interactions ui ON p.id = ui.product_id
                WHERE p.stock > 0 AND p.status = 'active'
                GROUP BY p.id
                ORDER BY interaction_count DESC, avg_rating DESC
                LIMIT ?
                `,
                [validLimit]
            );

            return {
                data: products,
                pagination: {
                    limit: validLimit,
                    total: products.length
                }
            };
        } catch (error) {
            console.error("Error getting trending recommendations:", error);
            throw error;
        }
    },

    getSimilarProducts: async (productId, limit = config.defaultLimit) => {
        try {
            const validLimit = validateLimit(limit);

            const [product] = await db.query(
                'SELECT category FROM products WHERE id = ? AND status = "active"',
                [productId]
            );

            if (!product || product.length === 0) {
                throw new Error('Product not found');
            }

            const category = product[0].category;

            const [similar] = await db.query(
                `
                SELECT * FROM products
                WHERE category = ?
                AND id != ?
                AND stock > 0
                AND status = 'active'
                ORDER BY rating DESC
                LIMIT ?
                `,
                [category, productId, validLimit]
            );

            return {
                data: similar,
                pagination: {
                    limit: validLimit,
                    total: similar.length
                }
            };
        } catch (error) {
            console.error("Error getting similar products:", error);
            throw error;
        }
    },

    clearCache: async (userId = null) => {
        try {
            if (userId) {
                const keys = cache.keys();
                const userKeys = keys.filter(key => key.includes(`_${userId}_`));
                userKeys.forEach(key => cache.del(key));
                console.log(`Cleared cache for user ${userId}: ${userKeys.length} entries`);
                return { cleared: userKeys.length };
            } else {
                cache.flushAll();
                console.log('Cleared all recommendation cache');
                return { cleared: 'all' };
            }
        } catch (error) {
            console.error("Error clearing cache:", error);
            throw error;
        }
    }
};

async function getFallbackRecommendations(limit) {
    const [fallbackProducts] = await db.query(
        `
        SELECT * FROM products
        WHERE stock > 0 AND status = 'active'
        ORDER BY rating DESC, num_reviews DESC
        LIMIT ?
        `,
        [limit]
    );
    return {
        data: fallbackProducts,
        pagination: {
            limit: limit,
            total: fallbackProducts.length
        }
    };
}

module.exports = recommendationService;