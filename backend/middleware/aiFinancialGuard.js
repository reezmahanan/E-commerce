// backend/middleware/aiFinancialGuard.js
const db = require('../config/db').promise;

// ============================================
// HARD LIMITS CONFIGURATION
// ============================================

const FINANCIAL_LIMITS = {
    maxDiscountPercentage: 50,          // Max 50% discount from AI
    maxAbsoluteDiscount: 1000,          // Max ₹1000 discount
    maxOrderValue: 50000,               // Max ₹50,000 per order
    maxQuantityPerItem: 10,             // Max 10 items per product
    requireHumanApproval: true,         // All AI decisions need approval
    autoRollbackMinutes: 15,            // Auto-rollback if not approved in 15 min
    maxAIRequestsPerMinute: 5           // Rate limit AI financial decisions
};

// In-memory rate limiter for AI decisions
const aiDecisionRateLimiter = new Map();

// ============================================
// AI DECISION AUDIT LOG
// ============================================

async function logAIDecision({
    userId,
    actionType,
    proposedAction,
    approvedAction,
    reason,
    status,
    ipAddress
}) {
    try {
        await db.query(
            `INSERT INTO ai_financial_audit_logs 
             (user_id, action_type, proposed_action, approved_action, 
              reason, status, ip_address, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                userId,
                actionType,
                JSON.stringify(proposedAction),
                JSON.stringify(approvedAction),
                reason,
                status,
                ipAddress
            ]
        );
        console.log(`✅ AI Decision Logged: ${actionType} for user ${userId}`);
    } catch (error) {
        console.error('Error logging AI decision:', error);
    }
}

// ============================================
// HUMAN-IN-THE-LOOP APPROVAL
// ============================================

async function createApprovalRequest({
    userId,
    actionType,
    proposedAction,
    requiresApproval = true,
    autoRollbackMinutes = FINANCIAL_LIMITS.autoRollbackMinutes
}) {
    try {
        const [result] = await db.query(
            `INSERT INTO ai_approval_requests 
             (user_id, action_type, proposed_action, status, 
              auto_rollback_at, created_at)
             VALUES (?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())`,
            [userId, actionType, JSON.stringify(proposedAction), autoRollbackMinutes]
        );

        // Schedule auto-rollback
        setTimeout(async () => {
            await autoRollbackIfPending(result.insertId);
        }, autoRollbackMinutes * 60 * 1000);

        return result.insertId;
    } catch (error) {
        console.error('Error creating approval request:', error);
        throw error;
    }
}

async function autoRollbackIfPending(approvalId) {
    try {
        const [requests] = await db.query(
            `SELECT * FROM ai_approval_requests 
             WHERE id = ? AND status = 'pending'`,
            [approvalId]
        );

        if (requests.length > 0) {
            await db.query(
                `UPDATE ai_approval_requests 
                 SET status = 'auto_rolled_back', 
                     auto_rollback_reason = 'Approval timeout - automatically rolled back'
                 WHERE id = ?`,
                [approvalId]
            );
            console.log(`🔄 Auto-rolled back AI decision ${approvalId}`);
        }
    } catch (error) {
        console.error('Error auto-rolling back:', error);
    }
}

async function approveAIDecision(approvalId, adminId, notes) {
    try {
        await db.query(
            `UPDATE ai_approval_requests 
             SET status = 'approved', 
                 approved_by = ?, 
                 approved_notes = ?,
                 approved_at = NOW()
             WHERE id = ? AND status = 'pending'`,
            [adminId, notes, approvalId]
        );

        // Get the approved action
        const [requests] = await db.query(
            `SELECT * FROM ai_approval_requests WHERE id = ?`,
            [approvalId]
        );

        if (requests.length > 0) {
            console.log(`✅ AI Decision ${approvalId} approved by admin ${adminId}`);
            return JSON.parse(requests[0].proposed_action);
        }
        return null;
    } catch (error) {
        console.error('Error approving decision:', error);
        throw error;
    }
}

// ============================================
// MAIN MIDDLEWARE
// ============================================

async function aiFinancialGuard(req, res, next) {
    try {
        const { action, data } = req.body;
        const userId = req.user?.id || 'anonymous';
        const ipAddress = req.ip || req.connection.remoteAddress;

        // 1. Rate Limiting
        const rateKey = `${userId}:${ipAddress}`;
        const now = Date.now();
        const windowStart = now - 60000;

        if (!aiDecisionRateLimiter.has(rateKey)) {
            aiDecisionRateLimiter.set(rateKey, []);
        }

        const requests = aiDecisionRateLimiter.get(rateKey)
            .filter(time => time > windowStart);

        if (requests.length >= FINANCIAL_LIMITS.maxAIRequestsPerMinute) {
            return res.status(429).json({
                success: false,
                error: 'Too many AI financial decisions. Please slow down.',
                retryAfter: 60
            });
        }

        requests.push(now);
        aiDecisionRateLimiter.set(rateKey, requests);

        // 2. Validate the AI action
        const validationResult = await validateAIAction(action, data, userId);

        if (!validationResult.valid) {
            await logAIDecision({
                userId,
                actionType: action,
                proposedAction: data,
                approvedAction: null,
                reason: validationResult.reason,
                status: 'rejected',
                ipAddress
            });

            return res.status(400).json({
                success: false,
                error: 'AI action rejected by financial guard',
                reason: validationResult.reason,
                action: action
            });
        }

        // 3. Check if human approval is required
        if (FINANCIAL_LIMITS.requireHumanApproval) {
            const approvalId = await createApprovalRequest({
                userId,
                actionType: action,
                proposedAction: data,
                autoRollbackMinutes: FINANCIAL_LIMITS.autoRollbackMinutes
            });

            await logAIDecision({
                userId,
                actionType: action,
                proposedAction: data,
                approvedAction: null,
                reason: 'Pending human approval',
                status: 'pending_approval',
                ipAddress
            });

            return res.status(202).json({
                success: true,
                message: 'AI action requires human approval',
                approvalId,
                autoRollbackMinutes: FINANCIAL_LIMITS.autoRollbackMinutes,
                status: 'pending_approval'
            });
        }

        // 4. If no approval needed, execute with guard
        const guardedAction = applyFinancialGuards(action, data);
        req.guardedAction = guardedAction;

        await logAIDecision({
            userId,
            actionType: action,
            proposedAction: data,
            approvedAction: guardedAction,
            reason: 'Approved by AI financial guard',
            status: 'approved',
            ipAddress
        });

        next();
    } catch (error) {
        console.error('❌ AI Financial Guard Error:', error);
        return res.status(500).json({
            success: false,
            error: 'AI financial guard validation failed'
        });
    }
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

async function validateAIAction(action, data, userId) {
    const validation = { valid: true, reason: '' };

    switch (action) {
        case 'apply_discount':
            const discount = parseFloat(data.discount || 0);
            const orderTotal = parseFloat(data.orderTotal || 0);

            // Max percentage check
            const maxDiscountAmount = (orderTotal * FINANCIAL_LIMITS.maxDiscountPercentage) / 100;
            if (discount > maxDiscountAmount) {
                validation.valid = false;
                validation.reason = `Discount exceeds max ${FINANCIAL_LIMITS.maxDiscountPercentage}% limit`;
                return validation;
            }

            // Max absolute discount
            if (discount > FINANCIAL_LIMITS.maxAbsoluteDiscount) {
                validation.valid = false;
                validation.reason = `Discount exceeds max ₹${FINANCIAL_LIMITS.maxAbsoluteDiscount}`;
                return validation;
            }

            // Check user's recent discount usage
            const recentDiscounts = await getUserRecentDiscounts(userId);
            if (recentDiscounts > 3) {
                validation.valid = false;
                validation.reason = 'User has used too many discounts recently';
                return validation;
            }
            break;

        case 'process_order':
            const total = parseFloat(data.total || 0);
            if (total > FINANCIAL_LIMITS.maxOrderValue) {
                validation.valid = false;
                validation.reason = `Order total exceeds max ${FINANCIAL_LIMITS.maxOrderValue}`;
                return validation;
            }
            break;

        case 'update_inventory':
            const quantity = parseInt(data.quantity || 0);
            if (quantity > FINANCIAL_LIMITS.maxQuantityPerItem) {
                validation.valid = false;
                validation.reason = `Quantity exceeds max ${FINANCIAL_LIMITS.maxQuantityPerItem} per item`;
                return validation;
            }
            break;

        default:
            validation.valid = false;
            validation.reason = `Unknown action: ${action}`;
            return validation;
    }

    return validation;
}

async function getUserRecentDiscounts(userId) {
    try {
        const [rows] = await db.query(
            `SELECT COUNT(*) as count 
             FROM ai_financial_audit_logs 
             WHERE user_id = ? 
             AND action_type = 'apply_discount'
             AND timestamp > DATE_SUB(NOW(), INTERVAL 1 DAY)`,
            [userId]
        );
        return rows[0]?.count || 0;
    } catch (error) {
        console.error('Error getting user discounts:', error);
        return 0;
    }
}

function applyFinancialGuards(action, data) {
    const guarded = { ...data };

    switch (action) {
        case 'apply_discount':
            const orderTotal = parseFloat(data.orderTotal || 0);
            const requestedDiscount = parseFloat(data.discount || 0);
            const maxDiscount = (orderTotal * FINANCIAL_LIMITS.maxDiscountPercentage) / 100;
            guarded.discount = Math.min(requestedDiscount, maxDiscount, FINANCIAL_LIMITS.maxAbsoluteDiscount);
            guarded.guardApplied = guarded.discount !== requestedDiscount;
            break;

        case 'process_order':
            guarded.total = Math.min(data.total, FINANCIAL_LIMITS.maxOrderValue);
            guarded.guardApplied = guarded.total !== data.total;
            break;

        case 'update_inventory':
            guarded.quantity = Math.min(data.quantity, FINANCIAL_LIMITS.maxQuantityPerItem);
            guarded.guardApplied = guarded.quantity !== data.quantity;
            break;
    }

    return guarded;
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

async function getPendingApprovals() {
    try {
        const [rows] = await db.query(
            `SELECT a.*, u.name as user_name, u.email as user_email
             FROM ai_approval_requests a
             JOIN users u ON a.user_id = u.id
             WHERE a.status = 'pending'
             ORDER BY a.created_at ASC`
        );
        return rows;
    } catch (error) {
        console.error('Error getting pending approvals:', error);
        throw error;
    }
}

async function getAIAuditLogs(filters = {}) {
    try {
        let query = `
            SELECT a.*, u.name as user_name
            FROM ai_financial_audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.userId) {
            query += ' AND a.user_id = ?';
            params.push(filters.userId);
        }

        if (filters.status) {
            query += ' AND a.status = ?';
            params.push(filters.status);
        }

        if (filters.fromDate) {
            query += ' AND a.timestamp >= ?';
            params.push(filters.fromDate);
        }

        if (filters.toDate) {
            query += ' AND a.timestamp <= ?';
            params.push(filters.toDate);
        }

        query += ' ORDER BY a.timestamp DESC LIMIT 100';

        const [rows] = await db.query(query, params);
        return rows;
    } catch (error) {
        console.error('Error getting audit logs:', error);
        throw error;
    }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    aiFinancialGuard,
    approveAIDecision,
    getPendingApprovals,
    getAIAuditLogs,
    FINANCIAL_LIMITS,
    logAIDecision
};