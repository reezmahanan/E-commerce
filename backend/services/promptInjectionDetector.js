// backend/services/promptInjectionDetector.js

// ============================================
// CONFIGURATION
// ============================================

const INJECTION_PATTERNS = {
    // System override patterns
    system_override: [
        /ignore (?:all|previous|above|below|the above|the previous|the system) instructions/i,
        /you are now (?:acting as|role playing|pretending to be)/i,
        /forget (?:all|everything|previous|the previous) instructions/i,
        /new (?:role|mission|task|goal) for you/i,
        /i am your (?:new|real|actual|true) (?:creator|master|owner|user)/i,
        /the (?:admin|system|owner) said/i,
        /(?:fake|false|pretend) (?:employee|supplier|partner|staff)/i,
        /(?:ceo|cfo|founder|director|executive) (?:approved|authorized|allowed|said)/i
    ],
    
    // Authority impersonation
    authority_impersonation: [
        /i am (?:the|your) (?:ceo|founder|admin|owner|manager|executive)/i,
        /i (?:work|am) (?:from|with) (?:the|our) (?:company|organization|team)/i,
        /my (?:role|position|job title|designation) is/i,
        /i represent (?:the|our) (?:company|organization|brand)/i,
        /as (?:the|a) (?:admin|manager|supervisor|executive)/i
    ],
    
    // Request manipulation
    request_manipulation: [
        /ignore (?:the|all) (?:rules|guidelines|policies|restrictions)/i,
        /give me (?:free|unlimited|infinite|all|max) (?:access|products|discounts)/i,
        /grant (?:me|everyone) (?:free|unlimited|max) (?:discounts|products|access)/i,
        /bypass (?:the|our) (?:system|security|validation|check)/i,
        /override (?:the|our) (?:system|security|validation|check)/i
    ],
    
    // Social engineering
    social_engineering: [
        /urgent (?:request|need|help|action) (?:from|for)/i,
        /this is (?:critical|urgent|important|emergency)/i,
        /don't tell (?:anyone|anybody|others)/i,
        /keep this (?:between us|confidential|secret)/i,
        /trust me (?:on|about) this/i,
        /i have (?:special|exclusive|insider) (?:access|knowledge)/i
    ],
    
    // Suspicious entities
    suspicious_entities: [
        /(?:fake|false|made-up|imaginary) (?:employee|staff|person|person)/i,
        /(?:invented|created|made) (?:company|organization|business)/i,
        /(?:fictional|nonexistent) (?:product|service|offer)/i
    ]
};

// ============================================
// INTENT ANALYSIS
// ============================================

async function analyzeUserIntent(prompt, userId, context = {}) {
    const results = {
        safe: true,
        riskScore: 0,
        riskLevel: 'low',
        detectedPatterns: [],
        sanitizedPrompt: prompt,
        suspiciousEntities: [],
        requiresConfirmation: false
    };

    // Check each pattern category
    for (const [category, patterns] of Object.entries(INJECTION_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(prompt)) {
                results.detectedPatterns.push({
                    category,
                    pattern: pattern.toString(),
                    match: prompt.match(pattern)[0]
                });
                results.riskScore += 1;
            }
        }
    }

    // Check for suspicious entities
    const entities = extractEntities(prompt);
    results.suspiciousEntities = entities.filter(e => 
        INJECTION_PATTERNS.suspicious_entities.some(p => p.test(e))
    );

    // Calculate risk level
    if (results.riskScore >= 5) {
        results.riskLevel = 'critical';
        results.requiresConfirmation = true;
        results.safe = false;
    } else if (results.riskScore >= 3) {
        results.riskLevel = 'high';
        results.requiresConfirmation = true;
        results.safe = false;
    } else if (results.riskScore >= 1) {
        results.riskLevel = 'medium';
        results.requiresConfirmation = true;
    }

    // Sanitize prompt
    results.sanitizedPrompt = sanitizePrompt(prompt);

    // Log for monitoring
    await logPromptAnalysis(userId, results, context);

    return results;
}

// ============================================
// EXTRACT ENTITIES
// ============================================

function extractEntities(text) {
    // Extract potential entities (names, companies, roles)
    const entities = [];
    
    // Name patterns (Sarah, John, etc.)
    const namePattern = /\b[A-Z][a-z]+ (?:[A-Z][a-z]+ )*(?:from|at|of) [A-Z][a-z]+/g;
    const matches = text.match(namePattern) || [];
    entities.push(...matches);

    // Company/Organization patterns
    const companyPattern = /\b[A-Z][a-z]+ (?:Inc|Labs|Corp|Company|LLC|Ltd)\b/g;
    const companyMatches = text.match(companyPattern) || [];
    entities.push(...companyMatches);

    // Role patterns
    const rolePattern = /\b(?:CEO|CFO|COO|CTO|Founder|Director|Manager|Executive|Admin|Owner)\b/gi;
    const roleMatches = text.match(rolePattern) || [];
    entities.push(...roleMatches);

    return entities;
}

// ============================================
// SANITIZE PROMPT
// ============================================

function sanitizePrompt(prompt) {
    let sanitized = prompt;
    
    // Remove command-like patterns
    sanitized = sanitized.replace(/```[\s\S]*?```/g, '[CODE_BLOCK_REMOVED]');
    sanitized = sanitized.replace(/`[^`]*`/g, '[INLINE_CODE_REMOVED]');
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '[COMMENT_REMOVED]');
    
    // Remove excessive punctuation
    sanitized = sanitized.replace(/[.!?]{3,}/g, '...');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
}

// ============================================
// AUTHORIZATION CONFIRMATION
// ============================================

async function requestAuthorization(userId, action, data) {
    try {
        // Create authorization request
        const authId = await createAuthRequest(userId, action, data);
        
        // Return pending status
        return {
            status: 'pending_authorization',
            authId,
            message: 'This action requires authorization confirmation'
        };
    } catch (error) {
        console.error('Authorization request error:', error);
        throw error;
    }
}

async function createAuthRequest(userId, action, data) {
    // Implementation - store in database
    const db = require('../config/db').promise;
    const [result] = await db.query(
        `INSERT INTO ai_authorization_requests 
         (user_id, action, data, status, created_at)
         VALUES (?, ?, ?, 'pending', NOW())`,
        [userId, action, JSON.stringify(data)]
    );
    return result.insertId;
}

async function confirmAuthorization(authId, adminId, decision, notes) {
    const db = require('../config/db').promise;
    await db.query(
        `UPDATE ai_authorization_requests 
         SET status = ?, 
             admin_id = ?, 
             admin_notes = ?,
             confirmed_at = NOW()
         WHERE id = ?`,
        [decision ? 'confirmed' : 'rejected', adminId, notes, authId]
    );
}

// ============================================
// ROLE-BASED ACCESS CONTROL
// ============================================

const RBAC_RULES = {
    admin: {
        canExecute: true,
        maxDiscount: 50,
        maxOrderValue: 100000,
        requireAuth: false
    },
    merchant: {
        canExecute: true,
        maxDiscount: 30,
        maxOrderValue: 50000,
        requireAuth: true
    },
    customer: {
        canExecute: true,
        maxDiscount: 20,
        maxOrderValue: 25000,
        requireAuth: true
    },
    guest: {
        canExecute: false,
        maxDiscount: 0,
        maxOrderValue: 0,
        requireAuth: true
    }
};

function checkRBAC(userRole, action, data) {
    const rules = RBAC_RULES[userRole] || RBAC_RULES.guest;
    
    if (!rules.canExecute) {
        return { allowed: false, reason: 'Insufficient permissions' };
    }

    // Check discount limits
    if (data.discount && data.discount > rules.maxDiscount) {
        return { 
            allowed: false, 
            reason: `Discount exceeds ${rules.maxDiscount}% limit for ${userRole}` 
        };
    }

    // Check order value limits
    if (data.orderTotal && data.orderTotal > rules.maxOrderValue) {
        return { 
            allowed: false, 
            reason: `Order value exceeds ₹${rules.maxOrderValue} limit for ${userRole}` 
        };
    }

    return { allowed: true };
}

// ============================================
// LOGGING
// ============================================

async function logPromptAnalysis(userId, results, context) {
    try {
        const db = require('../config/db').promise;
        await db.query(
            `INSERT INTO ai_prompt_analytics 
             (user_id, risk_score, risk_level, detected_patterns, 
              suspicious_entities, sanitized_prompt, context, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                userId,
                results.riskScore,
                results.riskLevel,
                JSON.stringify(results.detectedPatterns),
                JSON.stringify(results.suspiciousEntities),
                results.sanitizedPrompt,
                JSON.stringify(context)
            ]
        );
    } catch (error) {
        console.error('Error logging prompt analysis:', error);
    }
}

// ============================================
// MIDDLEWARE
// ============================================

async function promptInjectionGuard(req, res, next) {
    try {
        const { prompt, action, data } = req.body;
        const userId = req.user?.id || 'anonymous';
        const userRole = req.user?.role || 'guest';

        // Skip if no prompt
        if (!prompt) {
            return next();
        }

        // Analyze intent
        const analysis = await analyzeUserIntent(prompt, userId, {
            action,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Check RBAC
        const rbacCheck = checkRBAC(userRole, action, data);
        if (!rbacCheck.allowed) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                reason: rbacCheck.reason
            });
        }

        // Block if critical risk
        if (analysis.riskLevel === 'critical') {
            return res.status(403).json({
                success: false,
                error: 'Prompt detected as potentially malicious',
                riskLevel: analysis.riskLevel,
                detectedPatterns: analysis.detectedPatterns
            });
        }

        // Require confirmation for medium/high risk
        if (analysis.requiresConfirmation && analysis.riskLevel !== 'low') {
            const authRequest = await requestAuthorization(userId, action, data);
            return res.status(202).json({
                success: true,
                message: 'Prompt requires authorization confirmation',
                riskLevel: analysis.riskLevel,
                authId: authRequest.authId,
                detectedPatterns: analysis.detectedPatterns
            });
        }

        // Attach sanitized prompt
        req.sanitizedPrompt = analysis.sanitizedPrompt;
        req.promptAnalysis = analysis;
        next();
    } catch (error) {
        console.error('Prompt injection guard error:', error);
        return res.status(500).json({
            success: false,
            error: 'Prompt validation failed'
        });
    }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    promptInjectionGuard,
    analyzeUserIntent,
    confirmAuthorization,
    checkRBAC,
    INJECTION_PATTERNS,
    RBAC_RULES
};