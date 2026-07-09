// backend/services/aiAuditTrailService.js
const db = require('../config/db').promise;
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const AUDIT_CONFIG = {
    version: '1.0.0',
    algorithm: 'sha256',
    encoding: 'hex',
    logLevels: ['info', 'warning', 'error', 'critical'],
    retentionDays: 365 * 7 // 7 years
};

// ============================================
// AUDIT TRAIL CLASS
// ============================================

class AIAuditTrail {
    constructor() {
        this.auditLogs = [];
        this.certificates = [];
        this.sessionId = null;
    }

    /**
     * Start a new audit session
     */
    startSession(agentId, userId, context = {}) {
        this.sessionId = this.generateSessionId();
        this.auditLogs = [];
        
        const session = {
            sessionId: this.sessionId,
            agentId,
            userId,
            context,
            startTime: new Date().toISOString(),
            status: 'active'
        };

        this.log({
            type: 'session_start',
            data: session,
            level: 'info'
        });

        return this.sessionId;
    }

    /**
     * Log a negotiation step
     */
    logNegotiationStep(step, data, metadata = {}) {
        const logEntry = {
            sessionId: this.sessionId,
            step,
            data,
            metadata,
            timestamp: new Date().toISOString(),
            hash: this.generateHash({ step, data, metadata, timestamp: new Date().toISOString() })
        };

        this.auditLogs.push(logEntry);

        this.log({
            type: 'negotiation_step',
            data: logEntry,
            level: 'info'
        });

        return logEntry;
    }

    /**
     * Log decision point
     */
    logDecision(decision, rationale, options) {
        const decisionEntry = {
            sessionId: this.sessionId,
            decision,
            rationale,
            options,
            timestamp: new Date().toISOString(),
            hash: this.generateHash({ decision, rationale, options, timestamp: new Date().toISOString() })
        };

        this.auditLogs.push(decisionEntry);

        this.log({
            type: 'decision_point',
            data: decisionEntry,
            level: 'info'
        });

        return decisionEntry;
    }

    /**
     * Log change tracking
     */
    logChange(field, oldValue, newValue, reason) {
        const changeEntry = {
            sessionId: this.sessionId,
            field,
            oldValue,
            newValue,
            reason,
            timestamp: new Date().toISOString(),
            hash: this.generateHash({ field, oldValue, newValue, reason, timestamp: new Date().toISOString() })
        };

        this.auditLogs.push(changeEntry);

        this.log({
            type: 'change_tracking',
            data: changeEntry,
            level: 'info'
        });

        return changeEntry;
    }

    /**
     * Create Certificate of Action
     */
    async createCertificate(action, details) {
        const certificate = {
            id: this.generateCertificateId(),
            sessionId: this.sessionId,
            action,
            details,
            timestamp: new Date().toISOString(),
            hash: this.generateHash({ action, details, timestamp: new Date().toISOString() }),
            signature: await this.generateSignature({ action, details, timestamp: new Date().toISOString() }),
            status: 'active',
            version: AUDIT_CONFIG.version
        };

        this.certificates.push(certificate);

        // Store in database
        await this.storeCertificate(certificate);

        this.log({
            type: 'certificate_created',
            data: certificate,
            level: 'info'
        });

        return certificate;
    }

    /**
     * Generate Certificate ID
     */
    generateCertificateId() {
        return `CERT_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    /**
     * Generate Session ID
     */
    generateSessionId() {
        return `SESS_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    /**
     * Generate Hash
     */
    generateHash(data) {
        return crypto
            .createHash(AUDIT_CONFIG.algorithm)
            .update(JSON.stringify(data))
            .digest(AUDIT_CONFIG.encoding);
    }

    /**
     * Generate Signature
     */
    async generateSignature(data) {
        const privateKey = process.env.AI_PRIVATE_KEY || 'default_private_key';
        const signature = crypto
            .createHmac(AUDIT_CONFIG.algorithm, privateKey)
            .update(JSON.stringify(data))
            .digest(AUDIT_CONFIG.encoding);
        return signature;
    }

    /**
     * Verify Certificate
     */
    async verifyCertificate(certificate) {
        try {
            const { action, details, timestamp, signature } = certificate;
            const expectedSignature = await this.generateSignature({ action, details, timestamp });
            
            if (signature !== expectedSignature) {
                return { valid: false, reason: 'Invalid signature' };
            }

            // Check if certificate exists in database
            const [existing] = await db.query(
                'SELECT * FROM ai_certificates WHERE id = ?',
                [certificate.id]
            );

            if (existing.length === 0) {
                return { valid: false, reason: 'Certificate not found in database' };
            }

            if (existing[0].status === 'revoked') {
                return { valid: false, reason: 'Certificate has been revoked' };
            }

            return { valid: true };
        } catch (error) {
            console.error('Certificate verification error:', error);
            return { valid: false, reason: error.message };
        }
    }

    /**
     * Store Certificate in Database
     */
    async storeCertificate(certificate) {
        try {
            await db.query(
                `INSERT INTO ai_certificates 
                 (id, session_id, action, details, timestamp, hash, signature, status, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    certificate.id,
                    certificate.sessionId,
                    certificate.action,
                    JSON.stringify(certificate.details),
                    certificate.timestamp,
                    certificate.hash,
                    certificate.signature,
                    certificate.status,
                    certificate.version
                ]
            );
            console.log(`✅ Certificate stored: ${certificate.id}`);
        } catch (error) {
            console.error('Error storing certificate:', error);
            throw error;
        }
    }

    /**
     * Get Audit Trail
     */
    getAuditTrail() {
        return {
            sessionId: this.sessionId,
            logs: this.auditLogs,
            certificates: this.certificates,
            count: this.auditLogs.length
        };
    }

    /**
     * Get Certificate
     */
    getCertificate(certificateId) {
        return this.certificates.find(c => c.id === certificateId) || null;
    }

    /**
     * Revoke Certificate
     */
    async revokeCertificate(certificateId, reason) {
        const certificate = this.getCertificate(certificateId);
        if (!certificate) {
            throw new Error('Certificate not found');
        }

        certificate.status = 'revoked';
        certificate.revokedAt = new Date().toISOString();
        certificate.revocationReason = reason;

        await db.query(
            `UPDATE ai_certificates 
             SET status = ?, revoked_at = ?, revocation_reason = ? 
             WHERE id = ?`,
            ['revoked', certificate.revokedAt, reason, certificateId]
        );

        this.log({
            type: 'certificate_revoked',
            data: certificate,
            level: 'error'
        });

        return certificate;
    }

    /**
     * Log to database
     */
    async log(entry) {
        try {
            await db.query(
                `INSERT INTO ai_audit_logs 
                 (session_id, type, data, level, timestamp)
                 VALUES (?, ?, ?, ?, NOW())`,
                [
                    this.sessionId || entry.sessionId || 'unknown',
                    entry.type,
                    JSON.stringify(entry.data),
                    entry.level || 'info'
                ]
            );
        } catch (error) {
            console.error('Error logging audit entry:', error);
        }
    }

    /**
     * Export Audit Report
     */
    async exportReport(startDate, endDate) {
        try {
            const [logs] = await db.query(
                `SELECT * FROM ai_audit_logs 
                 WHERE timestamp BETWEEN ? AND ? 
                 ORDER BY timestamp ASC`,
                [startDate, endDate]
            );

            const [certificates] = await db.query(
                `SELECT * FROM ai_certificates 
                 WHERE timestamp BETWEEN ? AND ?`,
                [startDate, endDate]
            );

            return {
                period: { startDate, endDate },
                logs: logs,
                certificates: certificates,
                summary: {
                    totalLogs: logs.length,
                    totalCertificates: certificates.length,
                    exportedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Export error:', error);
            throw error;
        }
    }

    /**
     * Check Regulatory Compliance
     */
    async checkCompliance(sessionId) {
        try {
            const [logs] = await db.query(
                `SELECT * FROM ai_audit_logs 
                 WHERE session_id = ? 
                 ORDER BY timestamp ASC`,
                [sessionId]
            );

            const complianceChecks = {
                hasStart: false,
                hasDecision: false,
                hasCertificate: false,
                hasValidSignature: false,
                isComplete: false
            };

            // Check for required steps
            complianceChecks.hasStart = logs.some(l => l.type === 'session_start');
            complianceChecks.hasDecision = logs.some(l => l.type === 'decision_point');
            
            const [certificates] = await db.query(
                `SELECT * FROM ai_certificates 
                 WHERE session_id = ?`,
                [sessionId]
            );
            complianceChecks.hasCertificate = certificates.length > 0;

            if (certificates.length > 0) {
                const verified = await this.verifyCertificate(certificates[0]);
                complianceChecks.hasValidSignature = verified.valid;
            }

            // Check if all steps are complete
            const requiredSteps = ['session_start', 'negotiation_step', 'decision_point', 'certificate_created'];
            const presentSteps = new Set(logs.map(l => l.type));
            complianceChecks.isComplete = requiredSteps.every(s => presentSteps.has(s));

            // Calculate compliance score
            const complianceScore = Object.values(complianceChecks).filter(v => v === true).length;
            const totalChecks = Object.values(complianceChecks).length;
            const score = (complianceScore / totalChecks) * 100;

            return {
                sessionId,
                complianceChecks,
                score: Math.round(score),
                isCompliant: score >= 80,
                recommendations: this.generateRecommendations(complianceChecks)
            };
        } catch (error) {
            console.error('Compliance check error:', error);
            throw error;
        }
    }

    /**
     * Generate Compliance Recommendations
     */
    generateRecommendations(checks) {
        const recommendations = [];

        if (!checks.hasStart) {
            recommendations.push('Start an audit session before any negotiation');
        }
        if (!checks.hasDecision) {
            recommendations.push('Log all decision points during negotiation');
        }
        if (!checks.hasCertificate) {
            recommendations.push('Create a Certificate of Action after completion');
        }
        if (!checks.hasValidSignature) {
            recommendations.push('Ensure certificates are properly signed and verified');
        }
        if (!checks.isComplete) {
            recommendations.push('Complete all required audit steps');
        }

        return recommendations;
    }

    /**
     * Get Audit Statistics
     */
    async getStatistics() {
        try {
            const [stats] = await db.query(
                `SELECT 
                    COUNT(*) as total_logs,
                    COUNT(DISTINCT session_id) as total_sessions,
                    COUNT(DISTINCT CASE WHEN type = 'certificate_created' THEN session_id END) as certified_sessions,
                    SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as errors,
                    SUM(CASE WHEN level = 'warning' THEN 1 ELSE 0 END) as warnings,
                    DATE(MIN(timestamp)) as first_log,
                    DATE(MAX(timestamp)) as last_log
                 FROM ai_audit_logs
                 WHERE timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)`
            );

            return {
                ...stats[0],
                auditRetention: AUDIT_CONFIG.retentionDays,
                version: AUDIT_CONFIG.version
            };
        } catch (error) {
            console.error('Stats error:', error);
            throw error;
        }
    }
}

// ============================================
// EXPORT
// ============================================

module.exports = new AIAuditTrail();