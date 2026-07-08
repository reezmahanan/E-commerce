// backend/services/agenticATODetectionService.js
const db = require('../config/db').promise;
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const ATO_CONFIG = {
    // Behavioral baselines
    baselineWindow: 30, // days
    updateFrequency: 7, // days
    
    // Merchant tracking
    maxMerchants: 20,
    merchantExpansionThreshold: 3, // new merchants per day
    
    // Basket composition
    basketHistoryLength: 50,
    compositionDeviationThreshold: 0.3,
    
    // Conversation analysis
    conversationHistoryLength: 100,
    fingerprintThreshold: 0.75,
    
    // Mandate scope
    mandateDeviationThreshold: 0.2,
    
    // Detection thresholds
    lowConfidenceThreshold: 40,
    mediumConfidenceThreshold: 60,
    highConfidenceThreshold: 80,
    
    // Alert thresholds
    alertThreshold: 60,
    criticalThreshold: 80
};

// ============================================
// AGENTIC ATO DETECTION CLASS
// ============================================

class AgenticATODetectionService {
    constructor() {
        this.agentBaselines = new Map();
        this.merchantProfiles = new Map();
        this.basketProfiles = new Map();
        this.conversationFingerprints = new Map();
        this.mandateProfiles = new Map();
        this.anomalyLogs = [];
        this.detectionAlerts = [];
        this.agentSessions = new Map();
        this.credentialVaultAccess = new Map();
    }

    /**
     * Initialize agent behavioral baseline
     */
    async initializeBaseline(agentId, initialData = {}) {
        const baseline = {
            agentId,
            initializedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            merchantProfile: await this.buildMerchantProfile(agentId, initialData.merchants),
            basketProfile: await this.buildBasketProfile(agentId, initialData.baskets),
            conversationFingerprint: await this.buildConversationFingerprint(agentId, initialData.conversations),
            mandateProfile: await this.buildMandateProfile(agentId, initialData.mandates),
            behavioralPatterns: await this.extractBehavioralPatterns(agentId, initialData),
            credentialVaultPattern: await this.buildCredentialVaultPattern(agentId, initialData.credentialAccess)
        };

        this.agentBaselines.set(agentId, baseline);
        await this.storeBaseline(agentId, baseline);

        console.log(`✅ Baseline initialized for agent: ${agentId}`);
        return baseline;
    }

    /**
     * Update agent baseline
     */
    async updateBaseline(agentId, newData) {
        const current = this.agentBaselines.get(agentId);
        if (!current) {
            throw new Error(`No baseline found for agent: ${agentId}`);
        }

        if (newData.merchants) {
            current.merchantProfile = await this.updateMerchantProfile(
                current.merchantProfile,
                newData.merchants
            );
        }

        if (newData.baskets) {
            current.basketProfile = await this.updateBasketProfile(
                current.basketProfile,
                newData.baskets
            );
        }

        if (newData.conversations) {
            current.conversationFingerprint = await this.updateConversationFingerprint(
                current.conversationFingerprint,
                newData.conversations
            );
        }

        if (newData.mandates) {
            current.mandateProfile = await this.updateMandateProfile(
                current.mandateProfile,
                newData.mandates
            );
        }

        if (newData.credentialAccess) {
            current.credentialVaultPattern = await this.updateCredentialVaultPattern(
                current.credentialVaultPattern,
                newData.credentialAccess
            );
        }

        current.behavioralPatterns = await this.updateBehavioralPatterns(
            current.behavioralPatterns,
            newData
        );

        current.lastUpdated = new Date().toISOString();
        this.agentBaselines.set(agentId, current);
        await this.storeBaseline(agentId, current);

        return current;
    }

    /**
     * Detect compromised agent
     */
    async detectCompromisedAgent(agentId, currentActivity) {
        const baseline = this.agentBaselines.get(agentId);
        if (!baseline) {
            throw new Error(`No baseline found for agent: ${agentId}`);
        }

        const detection = {
            isCompromised: false,
            confidence: 0,
            flags: [],
            details: {},
            timestamp: new Date().toISOString()
        };

        // Track current session
        this.trackAgentSession(agentId, currentActivity);

        // Check merchant behavior
        const merchantCheck = await this.checkMerchantBehavior(
            baseline.merchantProfile,
            currentActivity.merchants
        );
        this.addDetectionResult(detection, merchantCheck);

        // Check basket composition
        const basketCheck = await this.checkBasketComposition(
            baseline.basketProfile,
            currentActivity.basket
        );
        this.addDetectionResult(detection, basketCheck);

        // Check conversation fingerprint
        const conversationCheck = await this.checkConversationFingerprint(
            baseline.conversationFingerprint,
            currentActivity.conversation
        );
        this.addDetectionResult(detection, conversationCheck);

        // Check mandate scope
        const mandateCheck = await this.checkMandateScope(
            baseline.mandateProfile,
            currentActivity.mandate
        );
        this.addDetectionResult(detection, mandateCheck);

        // Check credential vault access
        const credentialCheck = await this.checkCredentialVaultAccess(
            baseline.credentialVaultPattern,
            currentActivity.credentialAccess
        );
        this.addDetectionResult(detection, credentialCheck);

        // Check behavioral patterns
        const patternCheck = await this.checkBehavioralPatterns(
            baseline.behavioralPatterns,
            currentActivity
        );
        this.addDetectionResult(detection, patternCheck);

        // Calculate overall confidence
        this.calculateOverallConfidence(detection);

        // Determine if compromised
        detection.isCompromised = detection.confidence > ATO_CONFIG.alertThreshold;

        // Log detection
        await this.logAnomalyDetection(agentId, detection);

        // Generate alert if compromised
        if (detection.isCompromised) {
            await this.generateAlert(agentId, detection);
        }

        return detection;
    }

    /**
     * Add detection result
     */
    addDetectionResult(detection, result) {
        if (result.flags && result.flags.length > 0) {
            detection.flags.push(...result.flags);
            detection.confidence += result.confidence || 0;
            if (result.details) {
                detection.details = { ...detection.details, ...result.details };
            }
        }
    }

    /**
     * Calculate overall confidence
     */
    calculateOverallConfidence(detection) {
        const totalFlags = detection.flags.length;
        if (totalFlags === 0) {
            detection.confidence = 0;
            return;
        }

        // Calculate weighted confidence based on flag severity
        let weightedConfidence = 0;
        let totalWeight = 0;

        for (const flag of detection.flags) {
            const weight = flag.severity === 'critical' ? 3 :
                          flag.severity === 'high' ? 2 : 1;
            weightedConfidence += flag.confidence * weight;
            totalWeight += weight;
        }

        detection.confidence = Math.min(100, weightedConfidence / totalWeight);
    }

    /**
     * Track agent session
     */
    trackAgentSession(agentId, activity) {
        if (!this.agentSessions.has(agentId)) {
            this.agentSessions.set(agentId, {
                id: agentId,
                startTime: Date.now(),
                activities: [],
                merchantVisits: new Set(),
                totalActions: 0
            });
        }

        const session = this.agentSessions.get(agentId);
        session.activities.push({
            ...activity,
            timestamp: Date.now()
        });
        session.totalActions++;

        if (activity.merchants) {
            for (const merchant of activity.merchants) {
                session.merchantVisits.add(merchant.id);
            }
        }

        // Keep only last 100 activities
        if (session.activities.length > 100) {
            session.activities.shift();
        }
    }

    // ============================================
    // MERCHANT PROFILE METHODS
    // ============================================

    async buildMerchantProfile(agentId, merchantData = []) {
        return {
            knownMerchants: new Set(),
            merchantFrequency: {},
            averageBasketSize: {},
            lastInteraction: {},
            expansionRate: 0,
            typicalMerchantCount: merchantData.length || 0
        };
    }

    async updateMerchantProfile(current, newMerchants) {
        for (const merchant of newMerchants) {
            current.knownMerchants.add(merchant.id);
            current.merchantFrequency[merchant.id] = (current.merchantFrequency[merchant.id] || 0) + 1;
            current.averageBasketSize[merchant.id] = merchant.basketSize || 0;
            current.lastInteraction[merchant.id] = merchant.timestamp || new Date().toISOString();
        }

        const recent = await this.getRecentMerchants(current);
        current.expansionRate = recent.length / 7;

        return current;
    }

    async checkMerchantBehavior(baseline, currentMerchants) {
        const flags = [];
        let confidence = 0;
        const details = {};

        if (!currentMerchants || currentMerchants.length === 0) {
            return { flags, confidence, details };
        }

        const newMerchants = currentMerchants.filter(
            m => !baseline.knownMerchants.has(m.id)
        );

        if (newMerchants.length > ATO_CONFIG.merchantExpansionThreshold) {
            flags.push({
                type: 'rapid_merchant_expansion',
                severity: 'high',
                confidence: 70,
                details: `Expanded to ${newMerchants.length} new merchants`
            });
            confidence += 70;
            details.newMerchants = newMerchants.map(m => m.id);
        }

        for (const merchant of currentMerchants) {
            const frequency = baseline.merchantFrequency[merchant.id] || 0;
            const expected = (baseline.typicalMerchantCount / Object.keys(baseline.merchantFrequency).length) || 1;

            if (frequency > expected * 3) {
                flags.push({
                    type: 'unusual_merchant_frequency',
                    severity: 'medium',
                    confidence: 60,
                    details: `Merchant ${merchant.id} has unusual frequency: ${frequency}`
                });
                confidence += 60;
            }
        }

        return {
            flags,
            confidence: Math.min(100, confidence / 2),
            details
        };
    }

    // ============================================
    // BASKET COMPOSITION METHODS
    // ============================================

    async buildBasketProfile(agentId, baskets = []) {
        return {
            typicalItems: new Map(),
            typicalCategories: new Map(),
            itemFrequency: {},
            categoryFrequency: {},
            averageItemCount: 0,
            averageValue: 0,
            history: baskets.slice(-ATO_CONFIG.basketHistoryLength)
        };
    }

    async updateBasketProfile(current, newBaskets) {
        for (const basket of newBaskets) {
            for (const item of basket.items || []) {
                current.itemFrequency[item.id] = (current.itemFrequency[item.id] || 0) + 1;
                if (current.itemFrequency[item.id] > 5) {
                    current.typicalItems.set(item.id, item);
                }
            }
            current.history.push(basket);
        }

        if (current.history.length > ATO_CONFIG.basketHistoryLength) {
            current.history = current.history.slice(-ATO_CONFIG.basketHistoryLength);
        }

        return current;
    }

    async checkBasketComposition(baseline, currentBasket) {
        const flags = [];
        let confidence = 0;
        const details = {};

        if (!currentBasket || !currentBasket.items) {
            return { flags, confidence, details };
        }

        const unusualItems = currentBasket.items.filter(
            item => !baseline.typicalItems.has(item.id)
        );

        if (unusualItems.length > currentBasket.items.length * 0.5) {
            flags.push({
                type: 'unusual_items',
                severity: 'high',
                confidence: 75,
                details: `${unusualItems.length} unusual items in basket`
            });
            confidence += 75;
            details.unusualItems = unusualItems.map(i => i.id);
        }

        const currentValue = currentBasket.items.reduce((sum, item) => sum + (item.price || 0), 0);
        if (currentValue > baseline.averageValue * 3 && baseline.averageValue > 0) {
            flags.push({
                type: 'unusual_basket_value',
                severity: 'medium',
                confidence: 65,
                details: `Basket value (${currentValue}) exceeds typical (${baseline.averageValue})`
            });
            confidence += 65;
        }

        return {
            flags,
            confidence: Math.min(100, confidence / 2),
            details
        };
    }

    // ============================================
    // CONVERSATION FINGERPRINT METHODS
    // ============================================

    async buildConversationFingerprint(agentId, conversations = []) {
        return {
            patterns: {},
            typicalPhrases: new Set(),
            style: {},
            history: conversations.slice(-ATO_CONFIG.conversationHistoryLength),
            hash: null
        };
    }

    async updateConversationFingerprint(current, newConversations) {
        for (const conversation of newConversations) {
            const words = (conversation.text || '').toLowerCase().split(' ');
            for (const word of words) {
                if (word.length > 3) {
                    current.typicalPhrases.add(word);
                }
            }
            current.history.push(conversation);
        }

        if (current.history.length > ATO_CONFIG.conversationHistoryLength) {
            current.history = current.history.slice(-ATO_CONFIG.conversationHistoryLength);
        }

        current.hash = this.generateFingerprintHash(current);
        return current;
    }

    generateFingerprintHash(fingerprint) {
        const data = {
            phrases: Array.from(fingerprint.typicalPhrases).slice(0, 50),
            style: fingerprint.style
        };
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }

    async checkConversationFingerprint(baseline, currentConversation) {
        const flags = [];
        let confidence = 0;
        const details = {};

        if (!currentConversation) {
            return { flags, confidence, details };
        }

        const currentHash = this.generateFingerprintHash({
            typicalPhrases: new Set((currentConversation.text || '').toLowerCase().split(' ')),
            style: { count: 1 }
        });

        const similarity = this.calculateSimilarity(baseline.hash, currentHash);

        if (similarity < ATO_CONFIG.fingerprintThreshold) {
            flags.push({
                type: 'conversation_fingerprint_mismatch',
                severity: 'high',
                confidence: 80,
                details: `Fingerprint similarity: ${similarity.toFixed(2)}`
            });
            confidence += 80;
            details.similarity = similarity;
        }

        return {
            flags,
            confidence: Math.min(100, confidence),
            details
        };
    }

    calculateSimilarity(hash1, hash2) {
        if (!hash1 || !hash2) return 0;
        let matches = 0;
        for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
            if (hash1[i] === hash2[i]) matches++;
        }
        return matches / Math.min(hash1.length, hash2.length);
    }

    // ============================================
    // MANDATE SCOPE METHODS
    // ============================================

    async buildMandateProfile(agentId, mandates = []) {
        return {
            allowedActions: new Set(),
            allowedMerchants: new Set(),
            maxAmount: 0,
            scope: {},
            history: mandates,
            deviationCount: 0
        };
    }

    async updateMandateProfile(current, newMandates) {
        for (const mandate of newMandates) {
            if (mandate.actions) {
                for (const action of mandate.actions) {
                    current.allowedActions.add(action);
                }
            }
            if (mandate.merchants) {
                for (const merchant of mandate.merchants) {
                    current.allowedMerchants.add(merchant);
                }
            }
            if (mandate.maxAmount && mandate.maxAmount > current.maxAmount) {
                current.maxAmount = mandate.maxAmount;
            }
            current.history.push(mandate);
        }

        current.scope = {
            actionCount: current.allowedActions.size,
            merchantCount: current.allowedMerchants.size,
            maxAmount: current.maxAmount
        };

        return current;
    }

    async checkMandateScope(baseline, currentMandate) {
        const flags = [];
        let confidence = 0;
        const details = {};

        if (!currentMandate) {
            return { flags, confidence, details };
        }

        const unauthorizedActions = (currentMandate.actions || []).filter(
            action => !baseline.allowedActions.has(action)
        );

        if (unauthorizedActions.length > 0) {
            flags.push({
                type: 'unauthorized_actions',
                severity: 'critical',
                confidence: 90,
                details: `Unauthorized actions: ${unauthorizedActions.join(', ')}`
            });
            confidence += 90;
            details.unauthorizedActions = unauthorizedActions;
        }

        const unauthorizedMerchants = (currentMandate.merchants || []).filter(
            merchant => !baseline.allowedMerchants.has(merchant)
        );

        if (unauthorizedMerchants.length > 0) {
            flags.push({
                type: 'unauthorized_merchants',
                severity: 'high',
                confidence: 80,
                details: `Unauthorized merchants: ${unauthorizedMerchants.join(', ')}`
            });
            confidence += 80;
            details.unauthorizedMerchants = unauthorizedMerchants;
        }

        return {
            flags,
            confidence: Math.min(100, confidence),
            details
        };
    }

    // ============================================
    // CREDENTIAL VAULT METHODS
    // ============================================

    async buildCredentialVaultPattern(agentId, accesses = []) {
        return {
            typicalAccessPattern: {
                times: [],
                frequency: 0,
                devices: new Set()
            },
            history: accesses.slice(-20),
            accessCount: 0
        };
    }

    async updateCredentialVaultPattern(current, newAccesses) {
        for (const access of newAccesses) {
            current.accessCount++;
            current.typicalAccessPattern.times.push(access.timestamp || Date.now());
            if (access.device) {
                current.typicalAccessPattern.devices.add(access.device);
            }
            current.history.push(access);
        }

        if (current.history.length > 20) {
            current.history = current.history.slice(-20);
        }

        return current;
    }

    async checkCredentialVaultAccess(baseline, currentAccess) {
        const flags = [];
        let confidence = 0;
        const details = {};

        if (!currentAccess) {
            return { flags, confidence, details };
        }

        // Check for out-of-baseline access
        const unusualTime = this.isUnusualTime(currentAccess.timestamp);
        if (unusualTime) {
            flags.push({
                type: 'unusual_credential_access_time',
                severity: 'medium',
                confidence: 60,
                details: `Credential access at unusual time: ${currentAccess.timestamp}`
            });
            confidence += 60;
        }

        // Check for new device
        if (currentAccess.device && !baseline.typicalAccessPattern.devices.has(currentAccess.device)) {
            flags.push({
                type: 'new_device_credential_access',
                severity: 'high',
                confidence: 75,
                details: `Credential access from new device: ${currentAccess.device}`
            });
            confidence += 75;
            details.newDevice = currentAccess.device;
        }

        // Check for unusual frequency
        const recentAccesses = baseline.history.slice(-10);
        if (recentAccesses.length >= 10) {
            const avgFrequency = recentAccesses.length / 7; // per day
            const currentFrequency = 1; // assuming this is one access
            if (currentFrequency > avgFrequency * 3) {
                flags.push({
                    type: 'unusual_credential_access_frequency',
                    severity: 'medium',
                    confidence: 65,
                    details: `Unusual credential access frequency`
                });
                confidence += 65;
            }
        }

        return {
            flags,
            confidence: Math.min(100, confidence),
            details
        };
    }

    isUnusualTime(timestamp) {
        if (!timestamp) return false;
        const hour = new Date(timestamp).getHours();
        return hour < 3 || hour > 22;
    }

    // ============================================
    // BEHAVIORAL PATTERN METHODS
    // ============================================

    async extractBehavioralPatterns(agentId, data) {
        return {
            timePatterns: await this.extractTimePatterns(data),
            frequencyPatterns: await this.extractFrequencyPatterns(data),
            valuePatterns: await this.extractValuePatterns(data),
            interactionPatterns: await this.extractInteractionPatterns(data)
        };
    }

    async updateBehavioralPatterns(current, newData) {
        if (newData.timestamps) {
            current.timePatterns = await this.updateTimePatterns(current.timePatterns, newData.timestamps);
        }
        if (newData.frequencies) {
            current.frequencyPatterns = await this.updateFrequencyPatterns(current.frequencyPatterns, newData.frequencies);
        }
        if (newData.values) {
            current.valuePatterns = await this.updateValuePatterns(current.valuePatterns, newData.values);
        }
        if (newData.interactions) {
            current.interactionPatterns = await this.updateInteractionPatterns(current.interactionPatterns, newData.interactions);
        }
        return current;
    }

    async checkBehavioralPatterns(baseline, currentActivity) {
        const flags = [];
        let confidence = 0;
        const details = {};

        if (currentActivity.timestamp) {
            const timeCheck = await this.checkTimePatterns(baseline.timePatterns, currentActivity.timestamp);
            if (timeCheck.flags.length > 0) {
                flags.push(...timeCheck.flags);
                confidence += timeCheck.confidence;
                details.time = timeCheck.details;
            }
        }

        return {
            flags,
            confidence: Math.min(100, confidence),
            details
        };
    }

    async extractTimePatterns(data) {
        return { typicalHours: new Set(), typicalDays: new Set(), count: 0 };
    }

    async updateTimePatterns(current, newTimestamps) {
        for (const timestamp of newTimestamps) {
            const date = new Date(timestamp);
            current.typicalHours.add(date.getHours());
            current.typicalDays.add(date.getDay());
            current.count++;
        }
        return current;
    }

    async checkTimePatterns(patterns, timestamp) {
        const flags = [];
        let confidence = 0;
        const details = {};

        if (!timestamp || patterns.count === 0) {
            return { flags, confidence, details };
        }

        const date = new Date(timestamp);
        const hour = date.getHours();

        if (!patterns.typicalHours.has(hour) && patterns.typicalHours.size > 0) {
            flags.push({
                type: 'unusual_hour',
                severity: 'low',
                confidence: 40,
                details: `Activity at unusual hour: ${hour}:00`
            });
            confidence += 40;
        }

        return {
            flags,
            confidence: Math.min(100, confidence),
            details
        };
    }

    async extractFrequencyPatterns(data) {
        return { averageFrequency: 0, maxFrequency: 0, count: 0 };
    }

    async updateFrequencyPatterns(current, newFrequencies) {
        const allFrequencies = [...current, ...newFrequencies];
        current.averageFrequency = allFrequencies.reduce((a, b) => a + b, 0) / allFrequencies.length;
        current.maxFrequency = Math.max(...allFrequencies);
        current.count = allFrequencies.length;
        return current;
    }

    async extractValuePatterns(data) {
        return { averageValue: 0, maxValue: 0, count: 0 };
    }

    async updateValuePatterns(current, newValues) {
        const allValues = [...current, ...newValues];
        current.averageValue = allValues.reduce((a, b) => a + b, 0) / allValues.length;
        current.maxValue = Math.max(...allValues);
        current.count = allValues.length;
        return current;
    }

    async extractInteractionPatterns(data) {
        return { typicalActions: new Set(data.interactions || []), count: 0 };
    }

    async updateInteractionPatterns(current, newInteractions) {
        for (const interaction of newInteractions) {
            current.typicalActions.add(interaction);
            current.count++;
        }
        return current;
    }

    // ============================================
    // DATABASE OPERATIONS
    // ============================================

    async storeBaseline(agentId, baseline) {
        try {
            await db.query(
                `INSERT INTO agentic_ato_baselines 
                 (agent_id, initialized_at, last_updated, merchant_profile, 
                  basket_profile, conversation_fingerprint, mandate_profile, 
                  behavioral_patterns, credential_vault_pattern)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                 last_updated = VALUES(last_updated),
                 merchant_profile = VALUES(merchant_profile),
                 basket_profile = VALUES(basket_profile),
                 conversation_fingerprint = VALUES(conversation_fingerprint),
                 mandate_profile = VALUES(mandate_profile),
                 behavioral_patterns = VALUES(behavioral_patterns),
                 credential_vault_pattern = VALUES(credential_vault_pattern)`,
                [
                    agentId,
                    baseline.initializedAt,
                    baseline.lastUpdated,
                    JSON.stringify(baseline.merchantProfile),
                    JSON.stringify(baseline.basketProfile),
                    JSON.stringify(baseline.conversationFingerprint),
                    JSON.stringify(baseline.mandateProfile),
                    JSON.stringify(baseline.behavioralPatterns),
                    JSON.stringify(baseline.credentialVaultPattern)
                ]
            );
        } catch (error) {
            console.error('Store baseline error:', error);
        }
    }

    async logAnomalyDetection(agentId, detection) {
        try {
            await db.query(
                `INSERT INTO agentic_ato_anomalies 
                 (agent_id, confidence, flags, details, timestamp)
                 VALUES (?, ?, ?, ?, NOW())`,
                [
                    agentId,
                    detection.confidence,
                    JSON.stringify(detection.flags),
                    JSON.stringify(detection.details)
                ]
            );
        } catch (error) {
            console.error('Log anomaly error:', error);
        }
    }

    async generateAlert(agentId, detection) {
        const alert = {
            agentId,
            detection,
            timestamp: new Date().toISOString()
        };

        this.detectionAlerts.push(alert);

        try {
            await db.query(
                `INSERT INTO agentic_ato_alerts 
                 (agent_id, confidence, flags, details, timestamp, resolved)
                 VALUES (?, ?, ?, ?, NOW(), FALSE)`,
                [
                    agentId,
                    detection.confidence,
                    JSON.stringify(detection.flags),
                    JSON.stringify(detection.details)
                ]
            );
        } catch (error) {
            console.error('Store alert error:', error);
        }

        if (detection.confidence > ATO_CONFIG.criticalThreshold) {
            console.error(`🚨 CRITICAL: Agent ${agentId} appears compromised!`);
            console.error(`Confidence: ${detection.confidence}%`);
            console.error(`Flags:`, detection.flags);
        }

        return alert;
    }

    async getRecentMerchants(profile) {
        const recent = [];
        const now = new Date();
        for (const [merchantId, lastTime] of Object.entries(profile.lastInteraction)) {
            const diff = (now - new Date(lastTime)) / (1000 * 60 * 60 * 24);
            if (diff < 7) {
                recent.push(merchantId);
            }
        }
        return recent;
    }

    // ============================================
    // STATISTICS
    // ============================================

    async getStatistics() {
        try {
            const [stats] = await db.query(
                `SELECT 
                    COUNT(*) as total_baselines,
                    AVG(confidence) as avg_confidence,
                    SUM(CASE WHEN confidence > 60 THEN 1 ELSE 0 END) as compromised_agents,
                    COUNT(DISTINCT agent_id) as unique_agents
                 FROM agentic_ato_anomalies
                 WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
            );

            const [alertStats] = await db.query(
                `SELECT 
                    COUNT(*) as total_alerts,
                    SUM(CASE WHEN resolved = FALSE THEN 1 ELSE 0 END) as pending_alerts
                 FROM agentic_ato_alerts
                 WHERE timestamp > DATE_SUB(NOW(), INTERVAL 7 DAY)`
            );

            return {
                anomalies: stats[0],
                alerts: alertStats[0],
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Statistics error:', error);
            throw error;
        }
    }

    getStatus() {
        return {
            agentBaselines: this.agentBaselines.size,
            agentSessions: this.agentSessions.size,
            detectionAlerts: this.detectionAlerts.length,
            config: ATO_CONFIG
        };
    }
}

// ============================================
// EXPORT
// ============================================

module.exports = new AgenticATODetectionService();