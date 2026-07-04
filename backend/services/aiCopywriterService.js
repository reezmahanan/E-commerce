// backend/services/aiCopywriterService.js
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../config/db').promise;

// ============================================
// CONFIGURATION
// ============================================

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// STATIC COPYWRITER PROMPT (CACHED)
// ============================================

const COPYWRITER_SYSTEM_PROMPT = {
    type: "text",
    text: `You are an expert e-commerce product copywriter for AnthropicBots E-commerce.

Your task is to create compelling product listings that convert visitors into buyers.

Guidelines:
- Product Name: Max 8 words, attention-grabbing, include key benefit
- Product Description: Max 80 words, warm and appealing tone
- Highlight: Key features, benefits, and use cases
- Include: Emotional benefits alongside practical features
- Style: Professional, confident, yet approachable
- SEO: Include relevant keywords naturally
- Target Audience: General customers unless specified

Example Output Format:
{
    "name": "Premium Wireless Noise-Cancelling Headphones",
    "description": "Experience crystal-clear audio with our premium wireless headphones. Featuring advanced noise-cancelling technology, 40-hour battery life, and ultra-comfortable ear cushions. Perfect for professionals, travelers, and music enthusiasts who demand the best.",
    "shortDescription": "Premium wireless headphones with noise-cancelling and 40-hour battery life.",
    "bulletPoints": [
        "Advanced noise-cancelling technology",
        "40-hour battery life",
        "Ultra-comfortable ear cushions",
        "Crystal-clear audio quality",
        "Wireless Bluetooth 5.0 connectivity"
    ],
    "seoKeywords": ["wireless headphones", "noise cancelling", "premium audio", "Bluetooth headphones"]
}`,
    cache_control: { type: "ephemeral" }  // ✅ Enable caching
};

// ============================================
// COPYWRITER FUNCTIONS
// ============================================

/**
 * Generate AI product copy
 */
async function generateProductCopy({ keywords, category, targetAudience, tone }) {
    try {
        const response = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",  // Lower cost model
            system: [
                COPYWRITER_SYSTEM_PROMPT,
                {
                    type: "text",
                    text: `Context:
Keywords: ${keywords.join(', ')}
Category: ${category || 'General'}
Target Audience: ${targetAudience || 'General customers'}
Tone: ${tone || 'Professional, warm, and approachable'}

Generate product name and description based on the above context.`
                }
            ],
            messages: [
                {
                    role: "user",
                    content: `Generate a compelling product name and description for a product with these keywords: ${keywords.join(', ')}. 
Category: ${category || 'General'}
Target Audience: ${targetAudience || 'General customers'}
Tone: ${tone || 'Professional'}`
                }
            ],
            max_tokens: 500,
            temperature: 0.8,  // Higher for creativity
            headers: {
                'anthropic-version': '2023-06-01'
            }
        });

        // Parse the response
        let copyData;
        try {
            copyData = JSON.parse(response.content[0].text);
        } catch (parseError) {
            // If JSON parsing fails, try to extract from text
            const text = response.content[0].text;
            copyData = extractCopyFromText(text);
        }

        // Log the generation
        await logCopyGeneration({
            keywords,
            category,
            targetAudience,
            tone,
            generated: copyData
        });

        return {
            success: true,
            data: copyData,
            usage: response.usage
        };
    } catch (error) {
        console.error('❌ AI Copywriter Error:', error);
        throw error;
    }
}

/**
 * Generate multiple versions of product copy
 */
async function generateMultipleVersions({ keywords, category, count = 3 }) {
    try {
        const versions = [];
        const tones = ['Professional', 'Warm & Friendly', 'Luxury & Premium', 'Minimalist', 'Energetic'];
        
        // Select appropriate tones
        const selectedTones = tones.slice(0, Math.min(count, tones.length));
        
        for (const tone of selectedTones) {
            const result = await generateProductCopy({
                keywords,
                category,
                targetAudience: 'General customers',
                tone
            });
            versions.push({
                version: versions.length + 1,
                tone,
                ...result.data
            });
        }

        return {
            success: true,
            versions,
            count: versions.length
        };
    } catch (error) {
        console.error('❌ Multiple Versions Error:', error);
        throw error;
    }
}

/**
 * Generate multilingual product copy
 */
async function generateMultilingualCopy({ keywords, category, languages = ['en', 'hi', 'es'] }) {
    try {
        const translations = {};
        
        for (const lang of languages) {
            const result = await generateProductCopy({
                keywords,
                category,
                targetAudience: 'General customers',
                tone: 'Professional',
                language: lang
            });
            translations[lang] = result.data;
        }

        return {
            success: true,
            translations
        };
    } catch (error) {
        console.error('❌ Multilingual Copy Error:', error);
        throw error;
    }
}

/**
 * Extract copy from text if JSON parsing fails
 */
function extractCopyFromText(text) {
    // Try to find name
    const nameMatch = text.match(/["']?name["']?\s*[:=]\s*["']([^"']*)["']/i);
    const descriptionMatch = text.match(/["']?description["']?\s*[:=]\s*["']([^"']*)["']/i);
    
    return {
        name: nameMatch ? nameMatch[1] : 'Product Name',
        description: descriptionMatch ? descriptionMatch[1] : text.substring(0, 200),
        shortDescription: descriptionMatch ? descriptionMatch[1].substring(0, 100) : '',
        bulletPoints: [],
        seoKeywords: keywords
    };
}

// ============================================
// LOGGING
// ============================================

async function logCopyGeneration({ keywords, category, targetAudience, tone, generated }) {
    try {
        await db.query(
            `INSERT INTO ai_copy_generations 
             (keywords, category, target_audience, tone, 
              generated_name, generated_description, generated_short, 
              bullet_points, seo_keywords, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                JSON.stringify(keywords),
                category || 'General',
                targetAudience || 'General',
                tone || 'Professional',
                generated.name || '',
                generated.description || '',
                generated.shortDescription || '',
                JSON.stringify(generated.bulletPoints || []),
                JSON.stringify(generated.seoKeywords || [])
            ]
        );
        console.log('✅ Copy generation logged');
    } catch (error) {
        console.error('Error logging copy generation:', error);
    }
}

/**
 * Update copy usage statistics
 */
async function updateCopyUsage(copyId, productId) {
    try {
        await db.query(
            `UPDATE ai_copy_generations 
             SET was_used = TRUE, product_id = ? 
             WHERE id = ?`,
            [productId, copyId]
        );
        console.log('✅ Copy usage updated');
    } catch (error) {
        console.error('Error updating copy usage:', error);
    }
}

// ============================================
// ANALYTICS
// ============================================

async function getCopywriterAnalytics(timeRange = '30d') {
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
                COUNT(*) as total_generations,
                SUM(CASE WHEN was_used = TRUE THEN 1 ELSE 0 END) as used_count,
                (SUM(CASE WHEN was_used = TRUE THEN 1 ELSE 0 END) / COUNT(*)) * 100 as adoption_rate,
                GROUP_CONCAT(DISTINCT category) as categories
            FROM ai_copy_generations
            WHERE timestamp > DATE_SUB(NOW(), ${dateCondition})
            GROUP BY DATE(timestamp)
            ORDER BY date DESC
        `);

        return {
            success: true,
            data: results,
            summary: {
                total_generations: results.reduce((sum, r) => sum + r.total_generations, 0),
                total_used: results.reduce((sum, r) => sum + r.used_count, 0),
                avg_adoption_rate: results.reduce((sum, r) => sum + r.adoption_rate, 0) / (results.length || 1)
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
    generateProductCopy,
    generateMultipleVersions,
    generateMultilingualCopy,
    getCopywriterAnalytics,
    updateCopyUsage,
    logCopyGeneration
};