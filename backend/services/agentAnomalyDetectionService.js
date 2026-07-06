// backend/services/agentAnomalyDetectionService.js
const db = require('../config/db').promise;
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const ANOMALY_CONFIG = {
    // Behavioral baselining
    baselineWindow: 30, // days
    anomalyThreshold: 0.75, // 75% deviation triggers alert
    
    // Transaction limits
    maxTransactionAmount: 50000,
    maxTransactionsPerHour: 10,
    maxTransactionsPerDay: 50,
    
    // Agent permissions
    defaultPermissions: ['view', 'search'],
    elevatedPermissions: ['purchase', 'modify', 'delete'],
    
    // Conversation patterns
    maxConversationLength: 1000,
    suspiciousPatterns: [
        /urgent|immediate|asap/i,
        /bypass|override|ignore/i,
        /free|unlimited|unrestricted/i,
        /admin|ceo|founder|executive/i,
        /hack|exploit|vulnerability/i
    ]
};

// ============================================
// AGENT ANOMALY DETECTION CLASS
// ============================================

class AgentAnomalyDetection {
    constructor() {
        this.agentBaselines = new Map();
        this.agentSessions = new Map();
        this.anomalyAlerts = [];
        this.conversationPatterns = new Map();
    }

    /**
     * Initialize agent baseline
     */
    async initializeBaseline(agentId, userId) {
        try {
            // Get historical agent behavior
            const [history] = await db.query(
                `SELECT 
                    COUNT(*) as total_actions,
                    AVG(transaction_amount) as avg_amount,
                    COUNT(DISTINCT merchant_id) as merchant_count,
                    AVG(conversation_length) as avg_conversation_length,
                    AVG(action_duration) as avg_action_duration
                 FROM agent_activity_logs 
                 WHERE agent_id = ? 
                 AND timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)`,
                [agentId, ANOMALY_CONFIG.baselineWindow]
            );

            const baseline = {
                agentId,
                userId,
                establishedAt: new Date().toISOString(),
                totalActions: parseInt(history[0]?.total_actions) || 0,
                avgTransactionAmount: parseFloat(history[0]?.avg_amount) || 0,
                merchantCount: parseInt(history[0]?.merchant_count) || 0,
                avgConversationLength: parseInt(history[0]?.avg_conversation_length) || 0,
                avgActionDuration: parseInt(history[0]?.avg_action_duration) || 0,
                permissions: ANOMALY_CONFIG.defaultPermissions
            };

            this.agentBaselines.set(agentId, baseline);
            
            await this.storeBaseline(agentId, baseline);
            
            return baseline;
        } catch (error) {
            console.error('Baseline initialization error:', error);
            throw error;
        }
    }

    /**
     * Detect anomalies in agent behavior
     */
    async detectAnomalies(agentId, action, data) {
        const baseline = this.agentBaselines.get(agentId);
        if (!baseline) {
            throw new Error('No baseline found for agent. Initialize baseline first.');
        }

        const anomalies = {
            isAnomalous: false,
            flags: [],
            riskScore: 0,
            confidence: 0,
            details: {}
        };

        // 1. Check transaction amount anomaly
        if (data.transactionAmount) {
            const amountAnomaly = this.checkAmountAnomaly(
                data.transactionAmount,
                baseline.avgTransactionAmount
            );
            if (amountAnomaly.isAnomalous) {
                anomalies.flags.push(amountAnomaly);
                anomalies.riskScore += 30;
            }
        }

        // 2. Check frequency anomaly
        const frequencyAnomaly = await this.checkFrequencyAnomaly(agentId);
        if (frequencyAnomaly.isAnomalous) {
            anomalies.flags.push(frequencyAnomaly);
            anomalies.riskScore += 25;
        }

        // 3. Check permission violation
        if (action === 'purchase' || action === 'delete' || action === 'modify') {
            if (!baseline.permissions.includes(action)) {
                anomalies.flags.push({
                    type: 'permission_violation',
                    severity: 'critical',
                    details: `Agent attempted ${action} without permission`
                });
                anomalies.riskScore += 40;
            }
        }

        // 4. Check merchant access anomaly
        if (data.merchantId) {
            const merchantAnomaly = await this.checkMerchantAccessAnomaly(
                agentId,
                data.merchantId,
                baseline.merchantCount
            );
            if (merchantAnomaly.isAnomalous) {
                anomalies.flags.push(merchantAnomaly);
                anomalies.riskScore += 15;
            }
        }

        // 5. Check conversation pattern anomaly
        if (data.conversation) {
            const conversationAnomaly = this.checkConversationPattern(
                data.conversation,
                baseline.avgConversationLength
            );
            if (conversationAnomaly.isAnomalous) {
                anomalies.flags.push(conversationAnomaly);
                anomalies.riskScore += 20;
            }
        }

        // 6. Check action duration anomaly
        if (data.duration) {
            const durationAnomaly = this.checkDurationAnomaly(
                data.duration,
                baseline.avgActionDuration
            );
            if (durationAnomaly.isAnomalous) {
                anomalies.flags.push(durationAnomaly);
                anomalies.riskScore += 10;
            }
        }

        // Calculate final risk
        anomalies.riskScore = Math.min(100, anomalies.riskScore);
        anomalies.isAnomalous = anomalies.riskScore > 50;
        anomalies.confidence = this.calculateConfidence(anomalies.flags);
        anomalies.details = {
            agentId,
            action,
            timestamp: new Date().toISOString(),
            baselineReference: {
                avgAmount: baseline.avgTransactionAmount,
                merchantCount: baseline.merchantCount,
                avgConversationLength: baseline.avgConversationLength
            }
        };

        // Log anomaly if detected
        if (anomalies.isAnomalous) {
            await this.logAnomaly(agentId, anomalies);
            
            // Send alert for critical anomalies
            if (anomalies.riskScore > 75) {
                await this.sendCriticalAlert(agentId, anomalies);
            }
        }

        return anomalies;
    }

    /**
     * Check transaction amount anomaly
     */
    checkAmountAnomaly(amount, baselineAvg) {
        const deviation = baselineAvg > 0 ? ((amount - baselineAvg) / baselineAvg) * 100 : 0;
        
        if (deviation > 100) {
            return {
                type: 'amount_anomaly',
                severity: 'high',
                details: `Transaction amount (${amount}) is ${deviation.toFixed(0)}% above baseline (${baselineAvg})`,
                deviation
            };
        }
        return { isAnomalous: false };
    }

    /**
     * Check frequency anomaly
     */
    async checkFrequencyAnomaly(agentId) {
        const now = new Date();
        const oneHourAgo = new Date(now - 3600000);
        const oneDayAgo = new Date(now - 86400000);

        const [hourlyCount] = await db.query(
            'SELECT COUNT(*) as count FROM agent_activity_logs WHERE agent_id = ? AND timestamp > ?',
            [agentId, oneHourAgo]
        );

        const [dailyCount] = await db.query(
            'SELECT COUNT(*) as count FROM agent_activity_logs WHERE agent_id = ? AND timestamp > ?',
            [agentId, oneDayAgo]
        );

        if (hourlyCount[0].count > ANOMALY_CONFIG.maxTransactionsPerHour) {
            return {
                type: 'frequency_anomaly',
                severity: 'high',
                details: `${hourlyCount[0].count} actions in the last hour (limit: ${ANOMALY_CONFIG.maxTransactionsPerHour})`,
                count: hourlyCount[0].count,
                limit: ANOMALY_CONFIG.maxTransactionsPerHour
            };
        }

        if (dailyCount[0].count > ANOMALY_CONFIG.maxTransactionsPerDay) {
            return {
                type: 'frequency_anomaly',
                severity: 'medium',
                details: `${dailyCount[0].count} actions in the last day (limit: ${ANOMALY_CONFIG.maxTransactionsPerDay})`,
                count: dailyCount[0].count,
                limit: ANOMALY_CONFIG.maxTransactionsPerDay
            };
        }

        return { isAnomalous: false };
    }

    /**
     * Check merchant access anomaly
     */
    async checkMerchantAccessAnomaly(agentId, merchantId, baselineCount) {
        const [accessCount] = await db.query(
            'SELECT COUNT(*) as count FROM agent_merchant_access WHERE agent_id = ?',
            [agentId]
        );

        const totalMerchants = accessCount[0].count || 0;
        
        if (totalMerchants > baselineCount * 3 && baselineCount > 0) {
            return {
                type: 'merchant_access_anomaly',
                severity: 'medium',
                details: `Agent accessed ${totalMerchants} merchants (baseline: ${baselineCount})`,
                totalMerchants,
                baselineCount
            };
        }

        return { isAnomalous: false };
    }

    /**
     * Check conversation pattern anomaly
     */
    checkConversationPattern(conversation, baselineLength) {
        const issues = [];
        
        // Check length
        if (conversation.length > baselineLength * 3 && baselineLength > 0) {
            issues.push({
                type: 'conversation_length_anomaly',
                severity: 'medium',
                details: `Conversation length (${conversation.length}) is 3x baseline (${baselineLength})`
            });
        }

        // Check for suspicious patterns
        for (const pattern of ANOMALY_CONFIG.suspiciousPatterns) {
            if (pattern.test(conversation)) {
                issues.push({
                    type: 'suspicious_pattern',
                    severity: 'high',
                    details: `Found suspicious pattern: ${pattern}`
                });
                break;
            }
        }

        if (issues.length > 0) {
            return {
                isAnomalous: true,
                type: 'conversation_anomaly',
                severity: issues.some(i => i.severity === 'high') ? 'high' : 'medium',
                details: issues.map(i => i.details).join('; '),
                issues
            };
        }

        return { isAnomalous: false };
    }

    /**
     * Check duration anomaly
     */
    checkDurationAnomaly(duration, baselineAvg) {
        if (baselineAvg > 0 && duration < baselineAvg * 0.25) {
            return {
                type: 'duration_anomaly',
                severity: 'low',
                details: `Action duration (${duration}ms) is 75% below baseline (${baselineAvg}ms)`,
                duration,
                baselineAvg
            };
        }
        return { isAnomalous: false };
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(flags) {
        if (flags.length === 0) return 0;
        
        const severityWeights = {
            critical: 3,
            high: 2,
            medium: 1.5,
            low: 1
        };

        const totalWeight = flags.reduce((sum, f) => 
            sum + (severityWeights[f.severity] || 1), 0
        );
        const maxWeight = flags.length * 3;
        
        return Math.min(100, (totalWeight / maxWeight) * 100);
    }

    /**
     * Enforce mandate scope
     */
    enforceMandateScope(agentId, action, data) {
        const baseline = this.agentBaselines.get(agentId);
        if (!baseline) {
            throw new Error('Agent not registered');
        }

        // Check if agent has required permission
        const requiredPermissions = {
            'purchase': ['purchase'],
            'modify': ['modify', 'purchase'],
            'delete': ['delete', 'modify', 'purchase'],
            'view': ['view']
        };

        const required = requiredPermissions[action] || ['view'];
        const hasPermission = required.some(perm => baseline.permissions.includes(perm));

        if (!hasPermission) {
            return {
                allowed: false,
                reason: `Agent lacks required permission: ${required.join(', ')}`,
                required,
                current: baseline.permissions
            };
        }

        // Check transaction limits
        if (action === 'purchase' && data.amount) {
            if (data.amount > ANOMALY_CONFIG.maxTransactionAmount) {
                return {
                    allowed: false,
                    reason: `Transaction amount (${data.amount}) exceeds limit (${ANOMALY_CONFIG.maxTransactionAmount})`
                };
            }
        }

        // Check merchant access
        if (data.merchantId) {
            // In production, check if agent has access to this merchant
            // For now, we'll allow if not blocked
        }

        return {
            allowed: true,
            details: {
                permission: required,
                limits: {
                    maxAmount: ANOMALY_CONFIG.maxTransactionAmount
                }
            }
        };
    }

    /**
     * Grant permission to agent
     */
    async grantPermission(agentId, permission, grantedBy) {
        const baseline = this.agentBaselines.get(agentId);
        if (!baseline) {
            throw new Error('Agent not found');
        }

        if (!baseline.permissions.includes(permission)) {
            baseline.permissions.push(permission);
            
            await db.query(
                `INSERT INTO agent_permission_logs 
                 (agent_id, permission, granted_by, granted_at)
                 VALUES (?, ?, ?, NOW())`,
                [agentId, permission, grantedBy]
            );
        }

        return baseline;
    }

    /**
     * Revoke permission from agent
     */
    async revokePermission(agentId, permission, revokedBy) {
        const baseline = this.agentBaselines.get(agentId);
        if (!baseline) {
            throw new Error('Agent not found');
        }

        const index = baseline.permissions.indexOf(permission);
        if (index > -1) {
            baseline.permissions.splice(index, 1);
            
            await db.query(
                `INSERT INTO agent_permission_logs 
                 (agent_id, permission, revoked_by, revoked_at)
                 VALUES (?, ?, ?, NOW())`,
                [agentId, permission, revokedBy]
            );
        }

        return baseline;
    }

    /**
     * Store baseline in database
     */
    async storeBaseline(agentId, baseline) {
        await db.query(
            `INSERT INTO agent_baselines 
             (agent_id, user_id, established_at, total_actions, 
              avg_transaction_amount, merchant_count, avg_conversation_length,
              avg_action_duration, permissions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             total_actions = ?, avg_transaction_amount = ?,
             merchant_count = ?, avg_conversation_length = ?,
             avg_action_duration = ?, permissions = ?`,
            [
                agentId,
                baseline.userId,
                baseline.establishedAt,
                baseline.totalActions,
                baseline.avgTransactionAmount,
                baseline.merchantCount,
                baseline.avgConversationLength,
                baseline.avgActionDuration,
                JSON.stringify(baseline.permissions),
                baseline.totalActions,
                baseline.avgTransactionAmount,
                baseline.merchantCount,
                baseline.avgConversationLength,
                baseline.avgActionDuration,
                JSON.stringify(baseline.permissions)
            ]
        );
    }

    /**
     * Log anomaly
     */
    async logAnomaly(agentId, anomalies) {
        try {
            await db.query(
                `INSERT INTO agent_anomaly_logs 
                 (agent_id, risk_score, flags, confidence, details, timestamp)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    agentId,
                    anomalies.riskScore,
                    JSON.stringify(anomalies.flags),
                    anomalies.confidence,
                    JSON.stringify(anomalies.details)
                ]
            );
        } catch (error) {
            console.error('Log anomaly error:', error);
        }
    }

    /**
     * Send critical alert
     */
    async sendCriticalAlert(agentId, anomalies) {
        console.error(`🚨 CRITICAL: Agent anomaly detected for agent ${agentId}`);
        console.error(`Risk Score: ${anomalies.riskScore}%`);
        console.error(`Flags:`, anomalies.flags);
        
        // In production, send email/Slack alert
        // await sendEmailAlert(...);
        // await sendSlackAlert(...);
    }

    /**
     * Get agent status
     */
    async getAgentStatus(agentId) {
        try {
            const [baseline] = await db.query(
                'SELECT * FROM agent_baselines WHERE agent_id = ?',
                [agentId]
            );

            const [anomalies] = await db.query(
                'SELECT * FROM agent_anomaly_logs WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 10',
                [agentId]
            );

            const [activities] = await db.query(
                'SELECT COUNT(*) as total, AVG(transaction_amount) as avg_amount FROM agent_activity_logs WHERE agent_id = ?',
                [agentId]
            );

            return {
                agentId,
                baseline: baseline[0] || null,
                recentAnomalies: anomalies,
                activitySummary: activities[0] || { total: 0, avg_amount: 0 },
                status: anomalies.length > 0 && anomalies[0].risk_score > 75 ? 'critical' : 'normal'
            };
        } catch (error) {
            console.error('Get agent status error:', error);
            throw error;
        }
    }

    /**
     * Get statistics
     */
    getStatistics() {
        return {
            agentBaselines: this.agentBaselines.size,
            activeSessions: this.agentSessions.size,
            anomalyAlerts: this.anomalyAlerts.length,
            conversationPatterns: this.conversationPatterns.size
        };
    }
}

// ============================================
// EXPORT
// ============================================

module.exports = new AgentAnomalyDetection();