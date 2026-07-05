// backend/middleware/aiCoordinatorMiddleware.js
const { AIAgentCoordinator } = require('../services/aiAgentCoordinator');

// Initialize coordinator
const coordinator = new AIAgentCoordinator();

/**
 * Middleware to handle AI agent actions through coordinator
 */
async function aiCoordinatorMiddleware(req, res, next) {
    try {
        const { action, data } = req.body;
        const agentId = req.headers['x-agent-id'] || req.user?.id || 'anonymous';

        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'Action is required'
            });
        }

        // Get agent priority
        const userRole = req.user?.role || 'guest';
        const priorityMap = {
            admin: 100,
            supervisor: 80,
            merchant: 60,
            customer: 40,
            guest: 20
        };
        const priority = priorityMap[userRole] || 20;

        // Set agent session
        coordinator.agentSessions.set(agentId, {
            priority,
            count: 0,
            lastAction: new Date()
        });

        // Submit action to coordinator
        const result = await coordinator.submitAction(
            agentId,
            action,
            data,
            { userRole, ip: req.ip, userAgent: req.headers['user-agent'] }
        );

        // Return response
        res.json({
            success: true,
            data: result,
            coordinatorStatus: coordinator.getStatus()
        });

    } catch (error) {
        console.error('Coordinator middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Agent coordination failed',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Handle approval decisions
 */
async function handleApproval(req, res) {
    try {
        const { approvalId } = req.params;
        const { decision, notes } = req.body;
        const approverId = req.user?.id || 'system';

        if (!approvalId || !decision) {
            return res.status(400).json({
                success: false,
                error: 'Approval ID and decision are required'
            });
        }

        let result;
        if (decision === 'approve') {
            result = await coordinator.approveAction(approvalId, approverId, notes);
        } else if (decision === 'reject') {
            result = await coordinator.rejectAction(approvalId, approverId, notes);
        } else {
            return res.status(400).json({
                success: false,
                error: 'Decision must be "approve" or "reject"'
            });
        }

        res.json({
            success: true,
            message: `Action ${decision}d successfully`,
            data: result
        });

    } catch (error) {
        console.error('Approval handling error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process approval'
        });
    }
}

/**
 * Get coordinator status (admin only)
 */
async function getCoordinatorStatus(req, res) {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const status = {
            coordinator: coordinator.getStatus(),
            metrics: coordinator.getMetrics(),
            activeActions: await coordinator.getActiveActions(),
            pendingApprovals: await coordinator.getPendingApprovals()
        };

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get coordinator status'
        });
    }
}

module.exports = {
    aiCoordinatorMiddleware,
    handleApproval,
    getCoordinatorStatus,
    coordinator
};