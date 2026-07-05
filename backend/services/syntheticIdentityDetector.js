// backend/services/syntheticIdentityDetector.js
const db = require('../config/db').promise;
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const FRAUD_DETECTION_CONFIG = {
    // Velocity thresholds
    maxAccountsPerIP: 5,           // Max accounts from same IP
    maxAccountsPerDevice: 3,       // Max accounts from same device
    maxAccountsPerHour: 10,        // Max accounts per hour
    maxAccountsPerDay: 20,         // Max accounts per day
    
    // Identity patterns
    minAge: 18,                    // Minimum age
    maxAge: 100,                   // Maximum age
    suspiciousNamePatterns: [
        /test/i,
        /user\d+/,                // user123 pattern
        /temp/i,
        /demo/i,
        /fake/i,
        /dummy/i
    ],
    
    // Email patterns
    suspiciousEmailDomains: [
        'tempmail.com',
        'guerrillamail.com',
        'mailinator.com',
        '10minutemail.com',
        'throwaway.com'
    ],
    disposableEmailPatterns: [
        /\+.*@/,                  // Gmail plus addressing
        /\.{2,}/,                 // Multiple dots
        /^[a-z0-9]{1,5}@/         // Very short local part
    ],
    
    // Behavioral scoring
    trustScoreThreshold: 50,       // Below 50 = suspicious
    highRiskThreshold: 30,         // Below 30 = high risk
    criticalRiskThreshold: 15      // Below 15 = critical
};

// ============================================
// IDENTITY FRAUD DETECTION CLASS
// ============================================

class SyntheticIdentityDetector {
    constructor() {
        this.fraudScores = new Map();
        this.deviceFingerprints = new Map();
        this.ipReputation = new Map();
        this.velocityTracker = new Map();
        this.initialized = false;
    }

    async initialize() {
        try {
            await this.loadReputationData();
            this.initialized = true;
            console.log('✅ Synthetic Identity Detector initialized');
        } catch (error) {
            console.error('❌ Detector initialization error:', error);
        }
    }

    // ============================================
    // MAIN DETECTION
    // ============================================

    async detectSyntheticIdentity(userData, context = {}) {
        const detectionResult = {
            isSynthetic: false,
            riskScore: 0,
            riskLevel: 'low',
            flags: [],
            recommendations: [],
            confidence: 0,
            timestamp: new Date().toISOString()
        };

        try {
            // 1. Check velocity (rate of account creation)
            const velocityCheck = await this.checkVelocity(context);
            detectionResult.flags.push(...velocityCheck.flags);
            detectionResult.riskScore += velocityCheck.riskScore;

            // 2. Analyze identity patterns
            const identityCheck = this.analyzeIdentityPatterns(userData);
            detectionResult.flags.push(...identityCheck.flags);
            detectionResult.riskScore += identityCheck.riskScore;

            // 3. Check email patterns
            const emailCheck = this.analyzeEmailPatterns(userData.email);
            detectionResult.flags.push(...emailCheck.flags);
            detectionResult.riskScore += emailCheck.riskScore;

            // 4. Device fingerprint analysis
            const deviceCheck = await this.analyzeDeviceFingerprint(context);
            detectionResult.flags.push(...deviceCheck.flags);
            detectionResult.riskScore += deviceCheck.riskScore;

            // 5. IP reputation check
            const ipCheck = await this.checkIPReputation(context.ip);
            detectionResult.flags.push(...ipCheck.flags);
            detectionResult.riskScore += ipCheck.riskScore;

            // 6. Behavioral biometrics
            const behaviorCheck = this.analyzeBehavioralPatterns(context);
            detectionResult.flags.push(...behaviorCheck.flags);
            detectionResult.riskScore += behaviorCheck.riskScore;

            // 7. Name analysis
            const nameCheck = this.analyzeNamePatterns(userData.name);
            detectionResult.flags.push(...nameCheck.flags);
            detectionResult.riskScore += nameCheck.riskScore;

            // Calculate final risk score (0-100)
            detectionResult.riskScore = Math.min(100, detectionResult.riskScore);
            detectionResult.riskLevel = this.calculateRiskLevel(detectionResult.riskScore);
            detectionResult.isSynthetic = detectionResult.riskLevel === 'critical' || 
                                        detectionResult.riskLevel === 'high';
            detectionResult.confidence = this.calculateConfidence(detectionResult.flags);

            // Generate recommendations
            detectionResult.recommendations = this.generateRecommendations(detectionResult);

            // Log detection
            await this.logDetection(userData, detectionResult, context);

            // Update velocity tracking
            await this.updateVelocity(context);

            return detectionResult;

        } catch (error) {
            console.error('Detection error:', error);
            return {
                ...detectionResult,
                error: error.message,
                isSynthetic: false,
                riskLevel: 'unknown'
            };
        }
    }

    // ============================================
    // VELOCITY CHECKS
    // ============================================

    async checkVelocity(context) {
        const flags = [];
        let riskScore = 0;
        const ip = context.ip || 'unknown';
        const deviceId = context.deviceId || 'unknown';

        try {
            // Check accounts from same IP
            const [ipAccounts] = await db.query(
                `SELECT COUNT(*) as count FROM users 
                 WHERE registration_ip = ? 
                 AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
                [ip]
            );

            if (ipAccounts[0].count >= FRAUD_DETECTION_CONFIG.maxAccountsPerIP) {
                flags.push({
                    type: 'velocity_ip',
                    severity: 'high',
                    details: `Too many accounts from same IP (${ipAccounts[0].count})`
                });
                riskScore += 25;
            }

            // Check accounts from same device
            if (deviceId !== 'unknown') {
                const [deviceAccounts] = await db.query(
                    `SELECT COUNT(*) as count FROM users 
                     WHERE device_fingerprint = ? 
                     AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
                    [deviceId]
                );

                if (deviceAccounts[0].count >= FRAUD_DETECTION_CONFIG.maxAccountsPerDevice) {
                    flags.push({
                        type: 'velocity_device',
                        severity: 'high',
                        details: `Too many accounts from same device (${deviceAccounts[0].count})`
                    });
                    riskScore += 30;
                }
            }

            // Check hourly rate
            const [hourlyAccounts] = await db.query(
                `SELECT COUNT(*) as count FROM users 
                 WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`
            );

            if (hourlyAccounts[0].count >= FRAUD_DETECTION_CONFIG.maxAccountsPerHour) {
                flags.push({
                    type: 'velocity_hourly',
                    severity: 'medium',
                    details: `High account creation rate (${hourlyAccounts[0].count}/hour)`
                });
                riskScore += 15;
            }

        } catch (error) {
            console.error('Velocity check error:', error);
        }

        return { flags, riskScore };
    }

    // ============================================
    // IDENTITY PATTERN ANALYSIS
    // ============================================

    analyzeIdentityPatterns(userData) {
        const flags = [];
        let riskScore = 0;

        // Check name patterns
        if (userData.name) {
            for (const pattern of FRAUD_DETECTION_CONFIG.suspiciousNamePatterns) {
                if (pattern.test(userData.name)) {
                    flags.push({
                        type: 'suspicious_name',
                        severity: 'medium',
                        details: `Name matches suspicious pattern: ${pattern}`
                    });
                    riskScore += 15;
                    break;
                }
            }
        }

        // Check age validity
        if (userData.age) {
            if (userData.age < FRAUD_DETECTION_CONFIG.minAge) {
                flags.push({
                    type: 'underage',
                    severity: 'high',
                    details: `Age (${userData.age}) below minimum (${FRAUD_DETECTION_CONFIG.minAge})`
                });
                riskScore += 20;
            }
            if (userData.age > FRAUD_DETECTION_CONFIG.maxAge) {
                flags.push({
                    type: 'unrealistic_age',
                    severity: 'medium',
                    details: `Age (${userData.age}) above maximum (${FRAUD_DETECTION_CONFIG.maxAge})`
                });
                riskScore += 10;
            }
        }

        // Check missing identity data
        const requiredFields = ['name', 'email'];
        const missingFields = requiredFields.filter(f => !userData[f]);
        if (missingFields.length > 0) {
            flags.push({
                type: 'missing_identity',
                severity: 'medium',
                details: `Missing identity fields: ${missingFields.join(', ')}`
            });
            riskScore += 10;
        }

        return { flags, riskScore };
    }

    // ============================================
    // EMAIL PATTERN ANALYSIS
    // ============================================

    analyzeEmailPatterns(email) {
        const flags = [];
        let riskScore = 0;

        if (!email) {
            flags.push({
                type: 'missing_email',
                severity: 'high',
                details: 'Email address is required'
            });
            riskScore += 20;
            return { flags, riskScore };
        }

        // Check disposable email domains
        const domain = email.split('@')[1];
        if (domain && FRAUD_DETECTION_CONFIG.suspiciousEmailDomains.includes(domain)) {
            flags.push({
                type: 'disposable_email',
                severity: 'high',
                details: `Disposable email domain: ${domain}`
            });
            riskScore += 25;
        }

        // Check for suspicious patterns
        for (const pattern of FRAUD_DETECTION_CONFIG.disposableEmailPatterns) {
            if (pattern.test(email)) {
                flags.push({
                    type: 'suspicious_email_pattern',
                    severity: 'medium',
                    details: `Email matches suspicious pattern: ${pattern}`
                });
                riskScore += 10;
                break;
            }
        }

        // Check for temporary email patterns
        if (email.match(/\d{5,}@/)) {
            flags.push({
                type: 'temporary_email',
                severity: 'medium',
                details: 'Email contains numeric sequence suggesting temporary use'
            });
            riskScore += 15;
        }

        return { flags, riskScore };
    }

    // ============================================
    // DEVICE FINGERPRINT ANALYSIS
    // ============================================

    async analyzeDeviceFingerprint(context) {
        const flags = [];
        let riskScore = 0;
        const fingerprint = this.generateDeviceFingerprint(context);

        try {
            // Check if fingerprint is already associated with multiple accounts
            const [existing] = await db.query(
                `SELECT COUNT(*) as count FROM users 
                 WHERE device_fingerprint = ?`,
                [fingerprint]
            );

            if (existing[0].count >= FRAUD_DETECTION_CONFIG.maxAccountsPerDevice) {
                flags.push({
                    type: 'device_fingerprint_abuse',
                    severity: 'high',
                    details: `Device fingerprint associated with ${existing[0].count} accounts`
                });
                riskScore += 30;
            }

            // Check for missing or inconsistent device data
            if (!context.userAgent || !context.acceptLanguage) {
                flags.push({
                    type: 'incomplete_device_data',
                    severity: 'low',
                    details: 'Device data is incomplete'
                });
                riskScore += 5;
            }

            // Check for headless browser patterns
            if (context.userAgent && this.isHeadlessBrowser(context.userAgent)) {
                flags.push({
                    type: 'headless_browser',
                    severity: 'high',
                    details: 'Headless browser detected'
                });
                riskScore += 25;
            }

        } catch (error) {
            console.error('Device analysis error:', error);
        }

        // Store fingerprint for future checks
        this.deviceFingerprints.set(fingerprint, {
            firstSeen: new Date(),
            count: (this.deviceFingerprints.get(fingerprint)?.count || 0) + 1
        });

        return { flags, riskScore };
    }

    generateDeviceFingerprint(context) {
        const components = [
            context.userAgent || 'unknown',
            context.acceptLanguage || 'unknown',
            context.acceptEncoding || 'unknown',
            context.screenResolution || 'unknown',
            context.timezone || 'unknown'
        ];
        const string = components.join('|');
        return crypto.createHash('sha256').update(string).digest('hex');
    }

    isHeadlessBrowser(userAgent) {
        const headlessPatterns = [
            /Headless/i,
            /Puppeteer/i,
            /Playwright/i,
            /Selenium/i,
            /PhantomJS/i,
            /Cypress/i
        ];
        return headlessPatterns.some(pattern => pattern.test(userAgent));
    }

    // ============================================
    // IP REPUTATION CHECK
    // ============================================

    async checkIPReputation(ip) {
        const flags = [];
        let riskScore = 0;

        if (!ip || ip === 'unknown') {
            flags.push({
                type: 'missing_ip',
                severity: 'medium',
                details: 'IP address not available'
            });
            riskScore += 10;
            return { flags, riskScore };
        }

        try {
            // Check IP reputation cache
            const reputation = this.ipReputation.get(ip);
            if (reputation) {
                if (reputation.riskScore > 50) {
                    flags.push({
                        type: 'ip_reputation',
                        severity: 'high',
                        details: `IP has poor reputation (score: ${reputation.riskScore})`
                    });
                    riskScore += reputation.riskScore / 2;
                }
                return { flags, riskScore };
            }

            // Check database for IP history
            const [ipHistory] = await db.query(
                `SELECT COUNT(*) as account_count, 
                        SUM(CASE WHEN fraud_flag = true THEN 1 ELSE 0 END) as fraud_count
                 FROM users 
                 WHERE registration_ip = ?`,
                [ip]
            );

            if (ipHistory[0].account_count > 0) {
                const fraudRate = (ipHistory[0].fraud_count / ipHistory[0].account_count) * 100;
                if (fraudRate > 50) {
                    flags.push({
                        type: 'ip_fraud_history',
                        severity: 'high',
                        details: `IP associated with fraud (${fraudRate.toFixed(0)}% fraud rate)`
                    });
                    riskScore += Math.min(40, fraudRate / 2);
                }
            }

            // Check for VPN/Proxy patterns
            if (this.isProxyIP(ip)) {
                flags.push({
                    type: 'proxy_ip',
                    severity: 'medium',
                    details: 'Proxy/VPN IP detected'
                });
                riskScore += 15;
            }

            // Store reputation
            this.ipReputation.set(ip, { riskScore });

        } catch (error) {
            console.error('IP reputation check error:', error);
        }

        return { flags, riskScore };
    }

    isProxyIP(ip) {
        // Simple proxy detection - in production use IP reputation APIs
        const proxyPatterns = [
            /^10\./,        // Private IP
            /^172\.16\./,   // Private IP
            /^192\.168\./,  // Private IP
            /^127\./        // Localhost
        ];
        return proxyPatterns.some(pattern => pattern.test(ip));
    }

    // ============================================
    // BEHAVIORAL PATTERN ANALYSIS
    // ============================================

    analyzeBehavioralPatterns(context) {
        const flags = [];
        let riskScore = 0;

        // Check for automated behavior
        if (context.isAutomated) {
            flags.push({
                type: 'automated_behavior',
                severity: 'high',
                details: 'Automated behavior detected'
            });
            riskScore += 25;
        }

        // Check for unusual timing
        if (context.signupTime) {
            const hour = new Date(context.signupTime).getHours();
            if (hour >= 0 && hour <= 5) {
                flags.push({
                    type: 'unusual_timing',
                    severity: 'low',
                    details: 'Signup during off-hours (2 AM - 5 AM)'
                });
                riskScore += 5;
            }
        }

        // Check for rapid form completion
        if (context.formCompletionTime && context.formCompletionTime < 2000) {
            flags.push({
                type: 'rapid_completion',
                severity: 'medium',
                details: 'Form completed too quickly (under 2 seconds)'
            });
            riskScore += 15;
        }

        return { flags, riskScore };
    }

    // ============================================
    // NAME PATTERN ANALYSIS
    // ============================================

    analyzeNamePatterns(name) {
        const flags = [];
        let riskScore = 0;

        if (!name) {
            flags.push({
                type: 'missing_name',
                severity: 'high',
                details: 'Name is required'
            });
            riskScore += 20;
            return { flags, riskScore };
        }

        // Check for unrealistic names
        if (name.length < 2) {
            flags.push({
                type: 'unrealistic_name_length',
                severity: 'medium',
                details: `Name too short (${name.length} characters)`
            });
            riskScore += 10;
        }

        // Check for common synthetic name patterns
        const syntheticPatterns = [
            /^[A-Z][a-z]{1,2}$/,  // Single letter + 1-2 letters
            /[0-9]/,              // Numbers in name
            /[!@#$%^&*]/,        // Special characters
            /^[A-Z]$/             // Single letter
        ];

        for (const pattern of syntheticPatterns) {
            if (pattern.test(name)) {
                flags.push({
                    type: 'synthetic_name_pattern',
                    severity: 'medium',
                    details: `Name matches synthetic pattern: ${pattern}`
                });
                riskScore += 10;
                break;
            }
        }

        return { flags, riskScore };
    }

    // ============================================
    // RISK CALCULATION
    // ============================================

    calculateRiskLevel(score) {
        if (score >= FRAUD_DETECTION_CONFIG.trustScoreThreshold) return 'low';
        if (score >= FRAUD_DETECTION_CONFIG.highRiskThreshold) return 'medium';
        if (score >= FRAUD_DETECTION_CONFIG.criticalRiskThreshold) return 'high';
        return 'critical';
    }

    calculateConfidence(flags) {
        // Confidence based on number and severity of flags
        if (flags.length === 0) return 0;
        
        const severityWeights = { high: 3, medium: 2, low: 1 };
        const totalWeight = flags.reduce((sum, f) => sum + (severityWeights[f.severity] || 0), 0);
        const maxWeight = flags.length * 3;
        
        return Math.min(100, (totalWeight / maxWeight) * 100);
    }

    generateRecommendations(detection) {
        const recommendations = [];

        if (detection.riskLevel === 'critical') {
            recommendations.push('Block account creation immediately');
            recommendations.push('Flag IP address for monitoring');
            recommendations.push('Alert security team');
        }

        if (detection.riskLevel === 'high') {
            recommendations.push('Require additional verification');
            recommendations.push('Add CAPTCHA to checkout');
            recommendations.push('Monitor for fraudulent activity');
        }

        if (detection.riskLevel === 'medium') {
            recommendations.push('Send verification email');
            recommendations.push('Rate limit account actions');
            recommendations.push('Enable 2FA requirement');
        }

        // Specific recommendations based on flags
        detection.flags.forEach(flag => {
            if (flag.type === 'disposable_email') {
                recommendations.push('Require email verification before purchase');
            }
            if (flag.type === 'velocity_ip') {
                recommendations.push('Rate limit accounts from this IP');
            }
            if (flag.type === 'headless_browser') {
                recommendations.push('Add JavaScript challenge to verify browser');
            }
        });

        return recommendations;
    }

    // ============================================
    // DATABASE OPERATIONS
    // ============================================

    async logDetection(userData, detection, context) {
        try {
            await db.query(
                `INSERT INTO synthetic_identity_detections 
                 (user_email, user_name, risk_score, risk_level, flags, 
                  confidence, recommendations, ip_address, device_fingerprint, 
                  timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    userData.email || 'unknown',
                    userData.name || 'unknown',
                    detection.riskScore,
                    detection.riskLevel,
                    JSON.stringify(detection.flags),
                    detection.confidence,
                    JSON.stringify(detection.recommendations),
                    context.ip || 'unknown',
                    this.generateDeviceFingerprint(context)
                ]
            );
        } catch (error) {
            console.error('Error logging detection:', error);
        }
    }

    async updateVelocity(context) {
        const key = `velocity_${context.ip || 'unknown'}`;
        const now = Date.now();
        
        if (!this.velocityTracker.has(key)) {
            this.velocityTracker.set(key, { count: 1, timestamp: now });
        } else {
            const data = this.velocityTracker.get(key);
            data.count++;
            data.timestamp = now;
        }
    }

    async loadReputationData() {
        try {
            // Load IP reputation data from database
            const [reputations] = await db.query(
                `SELECT ip_address, risk_score FROM ip_reputation 
                 WHERE last_updated > DATE_SUB(NOW(), INTERVAL 7 DAY)`
            );
            
            for (const rep of reputations) {
                this.ipReputation.set(rep.ip_address, { riskScore: rep.risk_score });
            }
            
            console.log(`✅ Loaded ${reputations.length} IP reputations`);
        } catch (error) {
            console.error('Error loading reputation data:', error);
        }
    }

    // ============================================
    // EXPORTS
    // ============================================

    getStats() {
        return {
            fraudScores: this.fraudScores.size,
            deviceFingerprints: this.deviceFingerprints.size,
            ipReputations: this.ipReputation.size,
            velocityTrackers: this.velocityTracker.size,
            initialized: this.initialized
        };
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

const detector = new SyntheticIdentityDetector();
detector.initialize();

module.exports = detector;