const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    registerAgent,
    verifyAgent,
    getAgent,
    getTrustScore,
    getReputation,
    getTransactions,
    suspendAgent,
    revokeAgent,
    listAgents,
    getCrossMerchantReputation,
    flagAgent
} = require('../controllers/agentController');

// Protected routes
router.post('/register', protect, registerAgent);
router.get('/my-agents', protect, listAgents);
router.get('/:agentId', protect, getAgent);
router.get('/:agentId/trust-score', protect, getTrustScore);
router.get('/:agentId/reputation', protect, getReputation);
router.get('/:agentId/transactions', protect, getTransactions);
router.get('/:agentId/cross-merchant', protect, authorize('admin'), getCrossMerchantReputation);

// Admin only routes
router.post('/:agentId/verify', protect, authorize('admin'), verifyAgent);
router.post('/:agentId/suspend', protect, authorize('admin'), suspendAgent);
router.post('/:agentId/revoke', protect, authorize('admin'), revokeAgent);
router.post('/:agentId/flag', protect, authorize('admin'), flagAgent);

module.exports = router;