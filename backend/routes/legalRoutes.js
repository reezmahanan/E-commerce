const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    createNegotiation,
    getNegotiation,
    getAuditTrail,
    issueCertificate,
    verifyCertificate,
    checkCompliance,
    generateComplianceReport,
    exportAuditTrail,
    markAuditReady
} = require('../controllers/legalController');

const {
    checkLegalCompliance,
    requireCertificate,
    logLegalEvent,
    enforceAuditTrail
} = require('../middleware/legalCompliance');

// Protected routes
router.post('/negotiation', protect, createNegotiation);
router.get('/negotiation/:negotiationId', protect, getNegotiation);
router.get('/negotiation/:negotiationId/audit', protect, getAuditTrail);
router.get('/negotiation/:negotiationId/audit/export', protect, exportAuditTrail);
router.post('/negotiation/:negotiationId/certificate', protect, issueCertificate);
router.get('/certificate/:certificateId/verify', protect, verifyCertificate);
router.get('/negotiation/:negotiationId/compliance', protect, checkCompliance);
router.get('/negotiation/:negotiationId/compliance/report', protect, generateComplianceReport);
router.post('/negotiation/:negotiationId/audit-ready', protect, authorize('admin'), markAuditReady);

// Routes with compliance checks
router.post('/negotiation/:negotiationId/action', 
    protect,
    logLegalEvent,
    checkLegalCompliance,
    requireCertificate,
    enforceAuditTrail,
    (req, res) => {
        res.status(200).json({
            success: true,
            message: 'Action executed with legal compliance'
        });
    }
);

module.exports = router;