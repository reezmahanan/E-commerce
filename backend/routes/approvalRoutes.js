const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    requestApproval,
    approveTransaction,
    rejectTransaction,
    getPendingApprovals,
    addCheckpoint,
    verifyCheckpoint,
    escalateApproval
} = require('../controllers/approvalController');

// Protected routes
router.post('/request', protect, requestApproval);
router.post('/:approvalId/approve', protect, approveTransaction);
router.post('/:approvalId/reject', protect, rejectTransaction);
router.get('/pending', protect, getPendingApprovals);
router.post('/:approvalId/checkpoint', protect, addCheckpoint);
router.post('/:approvalId/verify', protect, verifyCheckpoint);
router.post('/:approvalId/escalate', protect, authorize('admin'), escalateApproval);

module.exports = router;