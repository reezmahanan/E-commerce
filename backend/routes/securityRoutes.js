const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    getAlerts,
    getAgentScore,
    getCardActivity,
    getVelocitySummary,
    blockUser,
    getFraudPatterns
} = require('../controllers/securityController');

// Admin only routes
router.get('/alerts', protect, authorize('admin'), getAlerts);
router.get('/agent/:userId', protect, authorize('admin'), getAgentScore);
router.get('/activity/:userId', protect, authorize('admin'), getCardActivity);
router.get('/velocity/:userId', protect, authorize('admin'), getVelocitySummary);
router.get('/fraud-patterns', protect, authorize('admin'), getFraudPatterns);
router.post('/block/:userId', protect, authorize('admin'), blockUser);

module.exports = router;