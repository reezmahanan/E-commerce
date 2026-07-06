// backend/services/agentLiabilityService.js
const crypto = require('crypto');
const db = require('../config/db').promise;

// ============================================
// CONFIGURATION
// ============================================

const LIABILITY_CONFIG = {
    // Liability tiers
    tiers: {
        FULL: { name: 'Full Liability', coverage: 100, premium: 0.05 },
        PARTIAL: { name: 'Partial Liability', coverage: 50, premium: 0.025 },
        LIMITED: { name: 'Limited Liability', coverage: 25, premium: 0.01 },
        NONE: { name: 'No Liability', coverage: 0, premium: 0 }
    },
    
    // Insurance
    insuranceReserve: 100000, // Base reserve amount
    fraudCoverage: 0.9, // 90% fraud coverage
    chargebackProtection: true,
    
    // Authorization
    signatureAlgorithm: 'sha256',
    mandateExpiry: 30, // days
    maxTransactionAmount: 50000,
    
    // Liability limits
    maxLiabilityPerAgent: 100000,
    maxLiabilityPerTransaction: 50000,
    maxLiabilityPerDay: 200000
};

// ============================================
// LIABILITY FRAMEWORK CLASS
// ============================================

class AgentLiabilityService {
    constructor() {
        this.agentRegistrations = new Map();
        this.liabilityRecords = new Map();
        this.insuranceClaims = new Map();
        this.authorizationSessions = new Map();
    }

    /**
     * Register an AI agent with liability framework
     */
    async registerAgent(agentData) {
        const registration = {
            agentId: this.generateAgentId(),
            name: agentData.name,
            ownerId: agentData.ownerId,
            ownerType: agentData.ownerType || 'merchant', // merchant, customer, third-party
            registeredAt: new Date().toISOString(),
            liabilityTier: agentData.liabilityTier || 'PARTIAL',
            insuranceActive: agentData.insuranceActive || false,
            maxTransactionLimit: agentData.maxTransactionLimit || LIABILITY_CONFIG.maxTransactionAmount,
            permissions: agentData.permissions || ['view', 'search'],
            status: 'active',
            publicKey: agentData.publicKey || null
        };

        // Store in database
        await this.storeRegistration(registration);

        // Create insurance policy if requested
        if (registration.insuranceActive) {
            await this.createInsurancePolicy(registration.agentId);
        }

        this.agentRegistrations.set(registration.agentId, registration);

        console.log(`✅ Agent registered: ${registration.agentId}`);
        return registration;
    }

    /**
     * Authorize an agent action
     */
    async authorizeAction(agentId, action, data) {
        // 1. Verify agent exists and is active
        const agent = await this.getAgent(agentId);
        if (!agent || agent.status !== 'active') {
            return {
                authorized: false,
                reason: 'Agent not found or inactive',
                liability: null
            };
        }

        // 2. Check permissions
        if (!this.hasPermission(agent, action)) {
            return {
                authorized: false,
                reason: `Agent lacks permission for action: ${action}`,
                liability: null
            };
        }

        // 3. Check transaction limits
        if (action === 'purchase' && data.amount) {
            if (data.amount > agent.maxTransactionLimit) {
                return {
                    authorized: false,
                    reason: `Transaction amount (${data.amount}) exceeds agent limit (${agent.maxTransactionLimit})`,
                    liability: null
                };
            }
        }

        // 4. Check mandate scope
        if (data.merchantId && !this.hasMerchantAccess(agentId, data.merchantId)) {
            return {
                authorized: false,
                reason: 'Agent does not have access to this merchant',
                liability: null
            };
        }

        // 5. Create authorization signature
        const signature = await this.createAuthorizationSignature(agentId, action, data);

        // 6. Assign liability
        const liability = await this.assignLiability(agentId, action, data);

        // 7. Create authorization record
        const authorization = {
            id: this.generateAuthorizationId(),
            agentId,
            action,
            data,
            signature,
            liability,
            timestamp: new Date().toISOString(),
            status: 'authorized'
        };

        // Store authorization
        await this.storeAuthorization(authorization);

        // Log liability assignment
        await this.logLiabilityAssignment(agentId, liability, authorization);

        return {
            authorized: true,
            signature,
            liability,
            authorizationId: authorization.id,
            message: 'Action authorized with liability assignment'
        };
    }

    /**
     * Assign liability for an action
     */
    async assignLiability(agentId, action, data) {
        const agent = await this.getAgent(agentId);
        const tier = LIABILITY_CONFIG.tiers[agent.liabilityTier] || LIABILITY_CONFIG.tiers.PARTIAL;

        let liability = {
            agentId,
            action,
            tier: agent.liabilityTier,
            coverage: tier.coverage,
            amount: 0,
            liabilityAmount: 0,
            assignedTo: agent.ownerId,
            timestamp: new Date().toISOString()
        };

        // Calculate liability amount
        if (action === 'purchase' && data.amount) {
            liability.amount = data.amount;
            liability.liabilityAmount = (data.amount * tier.coverage) / 100;
        } else if (action === 'refund' && data.amount) {
            liability.amount = data.amount;
            liability.liabilityAmount = (data.amount * tier.coverage) / 100;
        } else if (action === 'discount' && data.discountAmount) {
            liability.amount = data.discountAmount;
            liability.liabilityAmount = (data.discountAmount * tier.coverage) / 100;
        }

        // Check if insurance covers this
        if (agent.insuranceActive) {
            const insurance = await this.getInsurancePolicy(agentId);
            if (insurance && insurance.active) {
                liability.insuranceCoverage = Math.min(
                    liability.liabilityAmount * LIABILITY_CONFIG.fraudCoverage,
                    insurance.remainingBalance
                );
                liability.liabilityAmount -= liability.insuranceCoverage;
            }
        }

        // Apply daily limits
        const dailyLiability = await this.getDailyLiability(agentId);
        const remainingDailyLimit = LIABILITY_CONFIG.maxLiabilityPerDay - dailyLiability;
        
        if (liability.liabilityAmount > remainingDailyLimit) {
            liability.liabilityAmount = remainingDailyLimit;
            liability.liabilityReduced = true;
            liability.reductionReason = 'Daily limit exceeded';
        }

        // Check agent max liability
        const totalLiability = await this.getTotalLiability(agentId);
        if (totalLiability + liability.liabilityAmount > LIABILITY_CONFIG.maxLiabilityPerAgent) {
            liability.liabilityAmount = Math.max(0, LIABILITY_CONFIG.maxLiabilityPerAgent - totalLiability);
            liability.liabilityReduced = true;
            liability.reductionReason = 'Agent liability limit exceeded';
        }

        return liability;
    }

    /**
     * Handle a liability claim
     */
    async handleLiabilityClaim(claimData) {
        const claim = {
            id: this.generateClaimId(),
            agentId: claimData.agentId,
            authorizationId: claimData.authorizationId,
            amount: claimData.amount,
            reason: claimData.reason,
            evidence: claimData.evidence || [],
            status: 'pending',
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            resolution: null
        };

        // Verify authorization exists
        const auth = await this.getAuthorization(claimData.authorizationId);
        if (!auth) {
            claim.status = 'rejected';
            claim.resolution = 'Authorization not found';
            return claim;
        }

        // Check if claim is valid
        const liability = auth.liability;
        if (claim.amount > liability.liabilityAmount) {
            claim.status = 'rejected';
            claim.resolution = 'Claim amount exceeds liability coverage';
            return claim;
        }

        // Process claim based on liability tier
        const agent = await this.getAgent(claimData.agentId);
        const tier = LIABILITY_CONFIG.tiers[agent.liabilityTier];

        // Check if insurance covers this
        if (agent.insuranceActive) {
            const insurance = await this.getInsurancePolicy(agent.agentId);
            if (insurance && insurance.active && insurance.remainingBalance >= claim.amount) {
                claim.insuranceUsed = claim.amount;
                await this.deductInsurance(agent.agentId, claim.amount);
                claim.status = 'resolved';
                claim.resolution = 'Paid by insurance';
                claim.resolvedAt = new Date().toISOString();
                
                // Update insurance balance
                insurance.remainingBalance -= claim.amount;
                await this.updateInsurancePolicy(insurance);
            } else {
                // Partial insurance coverage
                if (insurance && insurance.remainingBalance > 0) {
                    claim.insuranceUsed = insurance.remainingBalance;
                    claim.amount -= insurance.remainingBalance;
                    await this.deductInsurance(agent.agentId, insurance.remainingBalance);
                }
                // Remaining amount is liability
                claim.liabilityAmount = claim.amount;
            }
        }

        // If not fully covered by insurance, charge the liable party
        if (claim.amount > 0 && claim.status !== 'resolved') {
            claim.liabilityAmount = claim.amount;
            claim.liableParty = agent.ownerId;
            claim.status = 'pending_payment';
        }

        await this.storeClaim(claim);
        return claim;
    }

    /**
     * Create insurance policy for agent
     */
    async createInsurancePolicy(agentId) {
        const policy = {
            id: this.generatePolicyId(),
            agentId,
            createdAt: new Date().toISOString(),
            active: true,
            balance: LIABILITY_CONFIG.insuranceReserve,
            remainingBalance: LIABILITY_CONFIG.insuranceReserve,
            premium: LIABILITY_CONFIG.tiers.PARTIAL.premium,
            claims: 0,
            totalPaid: 0
        };

        await this.storeInsurancePolicy(policy);
        return policy;
    }

    /**
     * Get agent details
     */
    async getAgent(agentId) {
        if (this.agentRegistrations.has(agentId)) {
            return this.agentRegistrations.get(agentId);
        }

        try {
            const [rows] = await db.query(
                'SELECT * FROM agent_liability_registrations WHERE agent_id = ?',
                [agentId]
            );
            if (rows.length > 0) {
                const agent = rows[0];
                agent.permissions = JSON.parse(agent.permissions);
                this.agentRegistrations.set(agentId, agent);
                return agent;
            }
        } catch (error) {
            console.error('Get agent error:', error);
        }
        return null;
    }

    /**
     * Check if agent has permission
     */
    hasPermission(agent, action) {
        const requiredPermissions = {
            'view': ['view'],
            'search': ['view', 'search'],
            'purchase': ['purchase', 'view', 'search'],
            'refund': ['refund', 'purchase', 'view', 'search'],
            'discount': ['discount', 'purchase', 'view', 'search'],
            'modify': ['modify', 'purchase', 'view', 'search']
        };

        const required = requiredPermissions[action] || ['view'];
        return required.some(perm => agent.permissions.includes(perm));
    }

    /**
     * Check merchant access
     */
    async hasMerchantAccess(agentId, merchantId) {
        try {
            const [rows] = await db.query(
                'SELECT * FROM agent_merchant_access WHERE agent_id = ? AND merchant_id = ?',
                [agentId, merchantId]
            );
            return rows.length > 0;
        } catch (error) {
            console.error('Merchant access check error:', error);
            return false;
        }
    }

    /**
     * Create authorization signature
     */
    async createAuthorizationSignature(agentId, action, data) {
        const secret = process.env.AGENT_AUTH_SECRET || 'default_secret';
        const payload = `${agentId}:${action}:${JSON.stringify(data)}:${Date.now()}`;
        return crypto
            .createHmac(LIABILITY_CONFIG.signatureAlgorithm, secret)
            .update(payload)
            .digest('hex');
    }

    /**
     * Get daily liability
     */
    async getDailyLiability(agentId) {
        try {
            const [rows] = await db.query(
                `SELECT SUM(liability_amount) as total 
                 FROM liability_assignments 
                 WHERE agent_id = ? 
                 AND DATE(timestamp) = CURDATE()`,
                [agentId]
            );
            return parseFloat(rows[0]?.total) || 0;
        } catch (error) {
            console.error('Daily liability error:', error);
            return 0;
        }
    }

    /**
     * Get total liability
     */
    async getTotalLiability(agentId) {
        try {
            const [rows] = await db.query(
                `SELECT SUM(liability_amount) as total 
                 FROM liability_assignments 
                 WHERE agent_id = ? 
                 AND status = 'pending'`,
                [agentId]
            );
            return parseFloat(rows[0]?.total) || 0;
        } catch (error) {
            console.error('Total liability error:', error);
            return 0;
        }
    }

    /**
     * Generate IDs
     */
    generateAgentId() {
        return `AGT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    generateAuthorizationId() {
        return `AUTH_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    generateClaimId() {
        return `CLM_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    generatePolicyId() {
        return `POL_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    /**
     * Store registration in database
     */
    async storeRegistration(registration) {
        await db.query(
            `INSERT INTO agent_liability_registrations 
             (agent_id, name, owner_id, owner_type, liability_tier, 
              insurance_active, max_transaction_limit, permissions, status, 
              public_key, registered_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                registration.agentId,
                registration.name,
                registration.ownerId,
                registration.ownerType,
                registration.liabilityTier,
                registration.insuranceActive ? 1 : 0,
                registration.maxTransactionLimit,
                JSON.stringify(registration.permissions),
                registration.status,
                registration.publicKey,
                registration.registeredAt
            ]
        );
    }

    /**
     * Store authorization
     */
    async storeAuthorization(authorization) {
        await db.query(
            `INSERT INTO agent_authorizations 
             (id, agent_id, action, data, signature, liability, status, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                authorization.id,
                authorization.agentId,
                authorization.action,
                JSON.stringify(authorization.data),
                authorization.signature,
                JSON.stringify(authorization.liability),
                authorization.status,
                authorization.timestamp
            ]
        );
    }

    /**
     * Get authorization
     */
    async getAuthorization(authId) {
        try {
            const [rows] = await db.query(
                'SELECT * FROM agent_authorizations WHERE id = ?',
                [authId]
            );
            if (rows.length > 0) {
                return {
                    ...rows[0],
                    data: JSON.parse(rows[0].data),
                    liability: JSON.parse(rows[0].liability)
                };
            }
        } catch (error) {
            console.error('Get authorization error:', error);
        }
        return null;
    }

    /**
     * Log liability assignment
     */
    async logLiabilityAssignment(agentId, liability, authorization) {
        await db.query(
            `INSERT INTO liability_assignments 
             (agent_id, authorization_id, action, amount, liability_amount, 
              tier, coverage, assigned_to, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                agentId,
                authorization.id,
                authorization.action,
                liability.amount || 0,
                liability.liabilityAmount || 0,
                liability.tier,
                liability.coverage,
                liability.assignedTo
            ]
        );
    }

    /**
     * Store insurance policy
     */
    async storeInsurancePolicy(policy) {
        await db.query(
            `INSERT INTO agent_insurance_policies 
             (id, agent_id, created_at, active, balance, remaining_balance, 
              premium, claims, total_paid)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                policy.id,
                policy.agentId,
                policy.createdAt,
                policy.active ? 1 : 0,
                policy.balance,
                policy.remainingBalance,
                policy.premium,
                policy.claims,
                policy.totalPaid
            ]
        );
    }

    /**
     * Get insurance policy
     */
    async getInsurancePolicy(agentId) {
        try {
            const [rows] = await db.query(
                'SELECT * FROM agent_insurance_policies WHERE agent_id = ? AND active = 1',
                [agentId]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Get insurance error:', error);
            return null;
        }
    }

    /**
     * Update insurance policy
     */
    async updateInsurancePolicy(policy) {
        await db.query(
            `UPDATE agent_insurance_policies 
             SET remaining_balance = ?, claims = ?, total_paid = ? 
             WHERE id = ?`,
            [policy.remainingBalance, policy.claims, policy.totalPaid, policy.id]
        );
    }

    /**
     * Deduct from insurance
     */
    async deductInsurance(agentId, amount) {
        const policy = await this.getInsurancePolicy(agentId);
        if (policy) {
            policy.remainingBalance -= amount;
            policy.claims += 1;
            policy.totalPaid += amount;
            await this.updateInsurancePolicy(policy);
        }
    }

    /**
     * Store claim
     */
    async storeClaim(claim) {
        await db.query(
            `INSERT INTO liability_claims 
             (id, agent_id, authorization_id, amount, reason, evidence, 
              status, created_at, resolved_at, resolution, insurance_used, 
              liability_amount, liable_party)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                claim.id,
                claim.agentId,
                claim.authorizationId,
                claim.amount,
                claim.reason,
                JSON.stringify(claim.evidence),
                claim.status,
                claim.createdAt,
                claim.resolvedAt,
                claim.resolution,
                claim.insuranceUsed || 0,
                claim.liabilityAmount || 0,
                claim.liableParty || null
            ]
        );
    }

    /**
     * Get statistics
     */
    async getStatistics() {
        try {
            const [stats] = await db.query(
                `SELECT 
                    COUNT(*) as total_agents,
                    SUM(CASE WHEN insurance_active = 1 THEN 1 ELSE 0 END) as insured_agents,
                    COUNT(DISTINCT owner_id) as unique_owners,
                    SUM(max_transaction_limit) as total_credit,
                    AVG(max_transaction_limit) as avg_credit
                 FROM agent_liability_registrations
                 WHERE status = 'active'`
            );

            const [claims] = await db.query(
                `SELECT 
                    COUNT(*) as total_claims,
                    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_claims,
                    SUM(amount) as total_claimed,
                    SUM(liability_amount) as total_liability
                 FROM liability_claims
                 WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`
            );

            return {
                agents: stats[0],
                claims: claims[0],
                config: LIABILITY_CONFIG,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Statistics error:', error);
            throw error;
        }
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            registrations: this.agentRegistrations.size,
            liabilityRecords: this.liabilityRecords.size,
            insuranceClaims: this.insuranceClaims.size,
            authorizationSessions: this.authorizationSessions.size,
            config: LIABILITY_CONFIG
        };
    }
}

// ============================================
// EXPORT
// ============================================

module.exports = new AgentLiabilityService();