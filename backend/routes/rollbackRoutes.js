const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    initiateRollback,
    executeRollback,
    getRollbackStatus,
    canRollback
} = require('../controllers/rollbackController');

// Protected routes
router.post('/:transactionId/initiate', protect, initiateRollback);
router.post('/:transactionId/execute', protect, authorize('admin'), executeRollback);
router.get('/:transactionId/status', protect, getRollbackStatus);
router.get('/:transactionId/can-rollback', protect, canRollback);

module.exports = router;