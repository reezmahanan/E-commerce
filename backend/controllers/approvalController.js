const RollbackService = require('../services/rollbackService');
const Transaction = require('../models/Transaction');

/**
 * Initiate rollback
 */
exports.initiateRollback = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;

        const result = await RollbackService.initiateRollback(
            transactionId,
            reason || 'Manual rollback initiated',
            userId
        );

        res.status(200).json({
            success: true,
            data: result,
            message: 'Rollback initiated'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Execute rollback
 */
exports.executeRollback = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const userId = req.user.id;

        const transaction = await RollbackService.executeRollback(
            transactionId,
            userId
        );

        res.status(200).json({
            success: true,
            data: transaction,
            message: 'Rollback executed successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Get rollback status
 */
exports.getRollbackStatus = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const status = await RollbackService.getRollbackStatus(transactionId);

        res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Check if rollback is possible
 */
exports.canRollback = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({
                error: 'Transaction not found'
            });
        }

        const possible = RollbackService.canRollback(transaction);

        res.status(200).json({
            success: true,
            data: {
                transactionId: transaction.transactionId,
                canRollback: possible,
                currentStatus: transaction.status,
                rollbackStatus: transaction.rollback?.status || 'not_started'
            }
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

const ApprovalService = require('../services/approvalService');

// Request approval
exports.requestApproval = async (req, res) => {
    try {
        const { transactionId, requiredApprovals, context } = req.body;
        const result = await ApprovalService.requestApproval(
            transactionId,
            requiredApprovals,
            context
        );
        res.status(201).json({
            success: true,
            data: result,
            message: 'Approval requested'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Approve transaction
exports.approveTransaction = async (req, res) => {
    try {
        const { approvalId } = req.params;
        const { comment } = req.body;
        const userId = req.user.id;
        const result = await ApprovalService.approveTransaction(
            approvalId,
            userId,
            comment
        );
        res.status(200).json({
            success: true,
            data: result,
            message: 'Transaction approved'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Reject transaction
exports.rejectTransaction = async (req, res) => {
    try {
        const { approvalId } = req.params;
        const { comment } = req.body;
        const userId = req.user.id;
        const result = await ApprovalService.rejectTransaction(
            approvalId,
            userId,
            comment
        );
        res.status(200).json({
            success: true,
            data: result,
            message: 'Transaction rejected'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get pending approvals
exports.getPendingApprovals = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit } = req.query;
        const result = await ApprovalService.getPendingApprovals(
            userId,
            limit ? parseInt(limit, 10) : undefined
        );
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Add verification checkpoint
exports.addCheckpoint = async (req, res) => {
    try {
        const { approvalId } = req.params;
        const { checkpointName, metadata } = req.body;
        const result = await ApprovalService.addVerificationCheckpoint(
            approvalId,
            checkpointName,
            metadata
        );
        res.status(201).json({
            success: true,
            data: result,
            message: 'Checkpoint added'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Verify checkpoint
exports.verifyCheckpoint = async (req, res) => {
    try {
        const { approvalId } = req.params;
        const { checkpointName } = req.body;
        const userId = req.user.id;
        const result = await ApprovalService.verifyCheckpoint(
            approvalId,
            checkpointName,
            userId
        );
        res.status(200).json({
            success: true,
            data: result,
            message: 'Checkpoint verified'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Escalate approval
exports.escalateApproval = async (req, res) => {
    try {
        const { approvalId } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;
        const result = await ApprovalService.escalateApproval(
            approvalId,
            userId,
            reason
        );
        res.status(200).json({
            success: true,
            data: result,
            message: 'Approval escalated'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};