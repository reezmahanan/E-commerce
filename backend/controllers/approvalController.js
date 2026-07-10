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