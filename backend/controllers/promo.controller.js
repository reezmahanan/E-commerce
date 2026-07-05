const { validatePromo, calculateDiscount } = require("../services/promo.service");
const { safeNumber, sanitizeString } = require("../utils/helpers");

const rateLimiter = new Map();
const promoCache = new Map();
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS = 10;
const CACHE_TTL = 300000;

const validatePromoCode = async (req, res) => {
    try {
        const promoCode = sanitizeString(req.body.promoCode);
        const cartTotal = safeNumber(req.body.cartTotal);
        const userId = req.user ? req.user.id : 'guest';

        const rateKey = `promo_${userId}`;
        const now = Date.now();
        if (!rateLimiter.has(rateKey)) {
            rateLimiter.set(rateKey, [now]);
        } else {
            const requests = rateLimiter.get(rateKey).filter(time => now - time < RATE_LIMIT_WINDOW);
            if (requests.length >= MAX_REQUESTS) {
                return res.status(429).json({
                    success: false,
                    message: "Too many promo validation requests. Please try again later."
                });
            }
            requests.push(now);
            rateLimiter.set(rateKey, requests);
        }

        if (!promoCode) {
            return res.status(400).json({
                success: false,
                message: "Promo code is required"
            });
        }

        const promoRegex = /^[A-Za-z0-9\-_]{3,30}$/;
        if (!promoRegex.test(promoCode)) {
            return res.status(400).json({
                success: false,
                message: "Invalid promo code format. Use 3-30 alphanumeric characters, hyphens, or underscores"
            });
        }

        if (cartTotal === null || cartTotal <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid cart total. Must be a positive number"
            });
        }

        const cacheKey = `promo_${promoCode}`;
        if (promoCache.has(cacheKey)) {
            const cached = promoCache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                const result = cached.data;
                return res.status(200).json({
                    success: true,
                    data: {
                        promoCode: result.promoCode || promoCode,
                        discount: result.discount || 0,
                        discountType: result.discountType || 'percentage',
                        maxDiscount: result.maxDiscount || null,
                        minCartValue: result.minCartValue || 0,
                        valid: result.valid || true,
                        expiresAt: result.expiresAt || null,
                        usageLimit: result.usageLimit || null,
                        usedCount: result.usedCount || 0,
                        remainingUses: result.remainingUses || null,
                        finalAmount: result.finalAmount || cartTotal
                    },
                    cached: true
                });
            }
        }

        const validation = await validatePromo(promoCode, cartTotal);
        if (!validation.valid) {
            promoCache.set(cacheKey, {
                timestamp: Date.now(),
                data: { valid: false, error: validation.message }
            });
            return res.status(400).json({
                success: false,
                message: validation.message
            });
        }

        const discount = calculateDiscount(validation.promo, cartTotal);
        const finalAmount = Number((cartTotal - discount).toFixed(2));

        const promoData = {
            promoCode: validation.promo.code,
            discountType: validation.promo.discount_type || 'percentage',
            discountValue: validation.promo.discount_value || 0,
            maxDiscount: validation.promo.max_discount || null,
            minCartValue: validation.promo.min_cart_value || 0,
            expiresAt: validation.promo.expires_at || null,
            usageLimit: validation.promo.usage_limit || null,
            usedCount: validation.promo.used_count || 0,
            remainingUses: validation.promo.usage_limit ? 
                (validation.promo.usage_limit - (validation.promo.used_count || 0)) : null,
            valid: true,
            discount: discount,
            finalAmount: finalAmount
        };

        promoCache.set(cacheKey, {
            timestamp: Date.now(),
            data: promoData
        });

        console.log(`[AUDIT] Promo ${promoCode} validated by user ${userId} - Discount: ${discount}`);

        return res.status(200).json({
            success: true,
            data: promoData,
            cached: false
        });

    } catch (error) {
        console.error("PROMO VALIDATION ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to validate promo code",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const applyMultiplePromos = async (req, res) => {
    try {
        const { promoCodes, cartTotal } = req.body;
        const userId = req.user ? req.user.id : 'guest';

        if (!promoCodes || !Array.isArray(promoCodes) || promoCodes.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one promo code is required"
            });
        }

        if (promoCodes.length > 3) {
            return res.status(400).json({
                success: false,
                message: "Maximum 3 promo codes allowed"
            });
        }

        const total = safeNumber(cartTotal);
        if (total === null || total <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid cart total"
            });
        }

        const promoRegex = /^[A-Za-z0-9\-_]{3,30}$/;
        for (const code of promoCodes) {
            if (!promoRegex.test(code)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid promo code format: ${code}`
                });
            }
        }

        const results = [];
        let remainingTotal = total;

        for (const code of promoCodes) {
            const validation = await validatePromo(code, remainingTotal);
            if (!validation.valid) {
                results.push({
                    promoCode: code,
                    valid: false,
                    message: validation.message
                });
                continue;
            }

            const discount = calculateDiscount(validation.promo, remainingTotal);
            const discountApplied = Number(discount.toFixed(2));
            remainingTotal = Number((remainingTotal - discountApplied).toFixed(2));

            results.push({
                promoCode: code,
                valid: true,
                discountApplied: discountApplied,
                remainingTotal: remainingTotal,
                message: "Promo applied successfully"
            });
        }

        console.log(`[AUDIT] Multiple promos applied by user ${userId}: ${promoCodes.join(', ')} - Final: ${remainingTotal}`);

        return res.status(200).json({
            success: true,
            data: {
                originalTotal: total,
                finalTotal: remainingTotal,
                totalDiscount: Number((total - remainingTotal).toFixed(2)),
                appliedPromos: results
            }
        });

    } catch (error) {
        console.error("APPLY MULTIPLE PROMOS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to apply multiple promo codes",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const clearPromoCache = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            console.log(`[AUDIT] Unauthorized cache clear attempt by user ${req.user.id}`);
            return res.status(403).json({
                success: false,
                message: "Unauthorized: Only admins can clear promo cache"
            });
        }

        const cacheSize = promoCache.size;
        promoCache.clear();
        rateLimiter.clear();

        console.log(`[AUDIT] Admin ${req.user.id} cleared promo cache (${cacheSize} entries)`);

        return res.status(200).json({
            success: true,
            message: `Promo cache cleared successfully (${cacheSize} entries removed)`
        });

    } catch (error) {
        console.error("CLEAR PROMO CACHE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to clear promo cache"
        });
    }
};

module.exports = {
    validatePromoCode,
    applyMultiplePromos,
    clearPromoCache
};