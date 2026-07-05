// backend/services/aiPromptService.js
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../config/db').promise;

// ============================================
// CONFIGURATION
// ============================================

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Pricing (Claude 3 Sonnet)
const COST_PER_INPUT_TOKEN = 0.00003;   // $0.00003 per input token
const COST_PER_OUTPUT_TOKEN = 0.00015;  // $0.00015 per output token

// ============================================
// STATIC SYSTEM PROMPT (CACHED)
// ============================================

const STATIC_SYSTEM_PROMPT = {
    type: "text",
    text: `You are an e-commerce shopping assistant for AnthropicBots E-commerce.

Rules:
- Always recommend products from our catalog
- Never suggest external products
- Stay within the price range of ₹500-₹50,000
- Provide honest product comparisons
- Ask clarifying questions before recommending
- Be friendly, helpful, and professional

Product Categories:
- Electronics (Smartphones, Laptops, Accessories)
- Fashion (Mens, Womens, Accessories)
- Home & Living (Furniture, Decor, Kitchen)
- Beauty (Skincare, Makeup, Fragrances)

Response Guidelines:
- Keep responses concise (max 200 words)
- Always include product names and prices
- Suggest alternatives when available
- Ask follow-up questions to understand user needs`,
    cache_control: { type: "ephemeral" }  // ✅ Enables caching!
};

// ============================================
// DYNAMIC CONTEXT (NOT CACHED)
// ============================================

function buildDynamicContext(req) {
    const user = req.user || {};
    const session = req.session || {};
    
    return {
        type: "text",
        text: `Current User Context:
- User ID: ${user.id || 'anonymous'}
- User Name: ${user.name || 'Guest'}
- User Email: ${user.email || 'Not provided'}
- User Role: ${user.role || 'customer'}
- Session ID: ${session.id || 'N/A'}
- Timestamp: ${new Date().toISOString()}
- IP Address: ${req.ip || 'Unknown'}`
    };
}

// ============================================
// AI RESPONSE FUNCTIONS
// ============================================

/**
 * Get AI recommendation with prompt caching
 */
async function getAIRecommendation(userQuery, contextData = {}) {
    try {
        const response = await anthropic.messages.create({
            model: "claude-3-sonnet-20241022",
            system: [
                STATIC_SYSTEM_PROMPT,  // ✅ Cached after first request
                {
                    type: "text",
                    text: `Additional Context:
${JSON.stringify(contextData, null, 2)}`  // ❌ Not cached
                }
            ],
            messages: [
                {
                    role: "user",
                    content: userQuery  // ❌ Not cached
                }
            ],
            max_tokens: 1024,
            temperature: 0.7,
            // ✅ Enable prompt caching
            headers: {
                'anthropic-version': '2023-06-01'
            }
        });

        // Calculate cost savings
        const savings = calculateCostSavings(response);
        
        // Log for analytics
        await logAICostSavings({
            userId: contextData.userId || 'anonymous',
            endpoint: 'getAIRecommendation',
            ...savings
        });

        return {
            success: true,
            data: response.content[0].text,
            usage: response.usage,
            savings
        };
    } catch (error) {
        console.error('❌ AI Recommendation Error:', error);
        throw error;
    }
}

/**
 * Get AI product recommendation with caching
 */
async function getAIProductRecommendation(userId, productId, userQuery) {
    try {
        // Get user context
        const [user] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );

        const contextData = {
            userId: userId,
            userEmail: user[0]?.email || 'unknown',
            productId: productId,
            query: userQuery,
            timestamp: new Date().toISOString()
        };

        const systemPrompt = {
            type: "text",
            text: `You are a product recommendation expert for AnthropicBots.

User Context:
- User ID: ${userId}
- User Email: ${user[0]?.email || 'unknown'}

Recommendation Guidelines:
1. Analyze the product details
2. Suggest similar products
3. Provide personalized recommendations
4. Include pricing information
5. Highlight key features`,
            cache_control: { type: "ephemeral" }  // ✅ Cached
        };

        const response = await anthropic.messages.create({
            model: "claude-3-sonnet-20241022",
            system: [
                systemPrompt,  // ✅ Cached
                {
                    type: "text",
                    text: `Current Request Context:
${JSON.stringify(contextData, null, 2)}`  // ❌ Not cached
                }
            ],
            messages: [
                {
                    role: "user",
                    content: `Recommend products similar to product ID ${productId}. User query: ${userQuery}`
                }
            ],
            max_tokens: 1024,
            temperature: 0.8,
            headers: {
                'anthropic-version': '2023-06-01'
            }
        });

        const savings = calculateCostSavings(response);
        
        await logAICostSavings({
            userId,
            endpoint: 'getAIProductRecommendation',
            ...savings
        });

        return {
            success: true,
            data: response.content[0].text,
            usage: response.usage,
            savings
        };
    } catch (error) {
        console.error('❌ Product Recommendation Error:', error);
        throw error;
    }
}

/**
 * Get AI product description generator with caching
 */
async function getAIProductDescription(productData, keywords) {
    try {
        const systemPrompt = {
            type: "text",
            text: `You are a professional e-commerce copywriter.

Writing Guidelines:
1. Create compelling product descriptions
2. Highlight key features and benefits
3. Use persuasive language
4. Include SEO keywords naturally
5. Keep it between 100-150 words
6. Focus on customer benefits

Style Guide:
- Professional yet friendly tone
- Use active voice
- Include emotional benefits
- Address customer pain points`,
            cache_control: { type: "ephemeral" }  // ✅ Cached
        };

        const response = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",  // Cheaper model for copywriting
            system: [
                systemPrompt,  // ✅ Cached
                {
                    type: "text",
                    text: `Product Data:
${JSON.stringify(productData, null, 2)}

Keywords: ${keywords.join(', ')}`
                }
            ],
            messages: [
                {
                    role: "user",
                    content: `Write a product description for the above product using these keywords: ${keywords.join(', ')}`
                }
            ],
            max_tokens: 500,
            temperature: 0.8,
            headers: {
                'anthropic-version': '2023-06-01'
            }
        });

        const savings = calculateCostSavings(response);
        
        return {
            success: true,
            data: response.content[0].text,
            usage: response.usage,
            savings
        };
    } catch (error) {
        console.error('❌ Product Description Error:', error);
        throw error;
    }
}

// ============================================
// COST CALCULATION
// ============================================

function calculateCostSavings(response) {
    const totalTokens = response.usage.input_tokens || 0;
    const cachedTokens = response.usage.cache_creation_input_tokens || 0;
    const outputTokens = response.usage.output_tokens || 0;
    
    // Calculate original cost (without caching)
    const originalCost = (totalTokens * COST_PER_INPUT_TOKEN) + 
                        (outputTokens * COST_PER_OUTPUT_TOKEN);
    
    // Calculate actual cost (with caching)
    const nonCachedTokens = totalTokens - cachedTokens;
    const actualCost = (nonCachedTokens * COST_PER_INPUT_TOKEN) + 
                       (outputTokens * COST_PER_OUTPUT_TOKEN);
    
    const savingsAmount = originalCost - actualCost;
    const savingsPercentage = originalCost > 0 ? 
        ((savingsAmount / originalCost) * 100) : 0;

    const result = {
        totalTokens,
        cachedTokens,
        nonCachedTokens,
        outputTokens,
        originalCost: parseFloat(originalCost.toFixed(6)),
        actualCost: parseFloat(actualCost.toFixed(6)),
        savingsAmount: parseFloat(savingsAmount.toFixed(6)),
        savingsPercentage: parseFloat(savingsPercentage.toFixed(2))
    };

    console.log(`💸 Cost Savings: ${result.savingsPercentage}%`);
    console.log(`💰 Original: $${result.originalCost} → Actual: $${result.actualCost}`);
    console.log(`📊 Cached Tokens: ${result.cachedTokens}/${result.totalTokens} (${((result.cachedTokens/result.totalTokens)*100).toFixed(1)}%)`);

    return result;
}

// ============================================
// DATABASE LOGGING
// ============================================

async function logAICostSavings({ userId, endpoint, originalCost, actualCost, savingsPercentage, totalTokens, outputTokens, cachedTokens }) {
    try {
        await db.query(
            `INSERT INTO ai_cost_analytics 
             (user_id, endpoint, original_cost, actual_cost, 
              savings_percentage, input_tokens, output_tokens, cached_tokens, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                userId,
                endpoint,
                originalCost,
                actualCost,
                savingsPercentage,
                totalTokens,
                outputTokens,
                cachedTokens
            ]
        );
        
        console.log(`✅ Cost savings logged for user ${userId}: ${savingsPercentage}% savings`);
    } catch (error) {
        console.error('Error logging cost savings:', error);
    }
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

async function getCostSavingsAnalytics(timeRange = '30d') {
    try {
        let dateCondition;
        switch(timeRange) {
            case '7d': dateCondition = "INTERVAL 7 DAY"; break;
            case '30d': dateCondition = "INTERVAL 30 DAY"; break;
            case '90d': dateCondition = "INTERVAL 90 DAY"; break;
            default: dateCondition = "INTERVAL 30 DAY";
        }

        const [results] = await db.query(`
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as total_requests,
                SUM(original_cost) as total_original_cost,
                SUM(actual_cost) as total_actual_cost,
                AVG(savings_percentage) as avg_savings,
                SUM(input_tokens) as total_input_tokens,
                SUM(cached_tokens) as total_cached_tokens,
                SUM(output_tokens) as total_output_tokens
            FROM ai_cost_analytics
            WHERE timestamp > DATE_SUB(NOW(), ${dateCondition})
            GROUP BY DATE(timestamp)
            ORDER BY date DESC
        `);

        return {
            success: true,
            data: results,
            summary: {
                total_requests: results.reduce((sum, r) => sum + r.total_requests, 0),
                total_savings: results.reduce((sum, r) => sum + (r.total_original_cost - r.total_actual_cost), 0),
                avg_savings: results.reduce((sum, r) => sum + r.avg_savings, 0) / (results.length || 1),
                total_cached_tokens: results.reduce((sum, r) => sum + r.total_cached_tokens, 0),
                total_input_tokens: results.reduce((sum, r) => sum + r.total_input_tokens, 0)
            }
        };
    } catch (error) {
        console.error('Error getting analytics:', error);
        throw error;
    }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    getAIRecommendation,
    getAIProductRecommendation,
    getAIProductDescription,
    calculateCostSavings,
    logAICostSavings,
    getCostSavingsAnalytics,
    STATIC_SYSTEM_PROMPT
};