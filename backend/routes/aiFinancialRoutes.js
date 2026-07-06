// backend/routes/aiFinancialRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    aiFinancialGuard,
    approveAIDecision,
    getPendingApprovals,
    getAIAuditLogs,
    FINANCIAL_LIMITS
} = require('../middleware/aiFinancialGuard');

/**
 * POST /api/ai/financial/action
 * Execute AI financial action with guard
 */
router.post('/action', authMiddleware, aiFinancialGuard, async (req, res) => {
    try {
        const { action } = req.body;
        const guardedAction = req.guardedAction;

        // Execute the guarded action
        const result = await executeAIAction(action, guardedAction, req.user.id);

        res.json({
            success: true,
            message: 'AI action executed with financial guard',
            action,
            guardApplied: guardedAction.guardApplied || false,
            result
        });
    } catch (error) {
        console.error('Action execution error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to execute AI action'
        });
    }
});

/**
 * POST /api/ai/financial/approve/:id
 * Approve pending AI decision (admin only)
 */
router.post('/approve/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const { id } = req.params;
        const { action, notes } = req.body;

        const approvedAction = await approveAIDecision(id, req.user.id, notes);

        if (!approvedAction) {
            return res.status(404).json({
                success: false,
                error: 'Approval request not found or already processed'
            });
        }

        res.json({
            success: true,
            message: 'AI decision approved',
            action: approvedAction
        });
    } catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve decision'
        });
    }
});

/**
 * GET /api/ai/financial/pending
 * Get pending approvals (admin only)
 */
router.get('/pending', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const pending = await getPendingApprovals();

        res.json({
            success: true,
            data: pending,
            count: pending.length
        });
    } catch (error) {
        console.error('Get pending error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get pending approvals'
        });
    }
});

/**
 * GET /api/ai/financial/audit
 * Get audit logs (admin only)
 */
router.get('/audit', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const { userId, status, fromDate, toDate } = req.query;
        const logs = await getAIAuditLogs({ userId, status, fromDate, toDate });

        res.json({
            success: true,
            data: logs,
            count: logs.length
        });
    } catch (error) {
        console.error('Audit error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get audit logs'
        });
    }
});

/**
 * GET /api/ai/financial/limits
 * Get financial limits configuration
 */
router.get('/limits', authMiddleware, (req, res) => {
    res.json({
        success: true,
        limits: FINANCIAL_LIMITS
    });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function executeAIAction(action, data, userId) {
    // Placeholder - implement actual action execution
    switch (action) {
        case 'apply_discount':
            return {
                action: 'discount_applied',
                discount: data.discount,
                orderTotal: data.orderTotal,
                userId
            };
        case 'process_order':
            return {
                action: 'order_processed',
                total: data.total,
                userId
            };
        default:
            return {
                action: 'unknown_action',
                data,
                userId
            };
    }
}

module.exports = router;