const AgentIdentityService = require('../services/agentIdentityService');
const TrustScoringService = require('../services/trustScoringService');
const ReputationService = require('../services/reputationService');
const AgentTransaction = require('../models/AgentTransaction');

/**
 * Register agent
 */
exports.registerAgent = async (req, res) => {
    try {
        const agentData = {
            ...req.body,
            ownerId: req.user.id
        };

        const result = await AgentIdentityService.registerAgent(agentData);

        res.status(201).json({
            success: true,
            data: result,
            message: 'Agent registered successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Verify agent
 */
exports.verifyAgent = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { method } = req.body;

        const result = await AgentIdentityService.verifyAgent(
            agentId,
            method || 'manual',
            req.user.id
        );

        res.status(200).json({
            success: true,
            data: result,
            message: 'Agent verified successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Get agent identity
 */
exports.getAgent = async (req, res) => {
    try {
        const { agentId } = req.params;

        const agent = await AgentIdentityService.getAgentIdentity(agentId);

        res.status(200).json({
            success: true,
            data: agent
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Get agent trust score
 */
exports.getTrustScore = async (req, res) => {
    try {
        const { agentId } = req.params;

        const score = await TrustScoringService.getTrustScoreDetails(agentId);

        res.status(200).json({
            success: true,
            data: score
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Get agent reputation
 */
exports.getReputation = async (req, res) => {
    try {
        const { agentId } = req.params;

        const reputation = await ReputationService.getAgentReputation(agentId);

        res.status(200).json({
            success: true,
            data: reputation
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Get agent transactions
 */
exports.getTransactions = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { limit = 50 } = req.query;

        const transactions = await AgentTransaction.find({ agentId })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: transactions,
            count: transactions.length
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Suspend agent
 */
exports.suspendAgent = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { reason } = req.body;

        const agent = await AgentIdentityService.suspendAgent(agentId, reason);

        res.status(200).json({
            success: true,
            data: agent,
            message: 'Agent suspended successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Revoke agent
 */
exports.revokeAgent = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { reason } = req.body;

        const agent = await AgentIdentityService.revokeAgent(agentId, reason);

        res.status(200).json({
            success: true,
            data: agent,
            message: 'Agent revoked successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * List user agents
 */
exports.listAgents = async (req, res) => {
    try {
        const agents = await AgentIdentityService.listUserAgents(req.user.id);

        res.status(200).json({
            success: true,
            data: agents,
            count: agents.length
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Cross-merchant reputation
 */
exports.getCrossMerchantReputation = async (req, res) => {
    try {
        const { agentId } = req.params;

        const reputation = await ReputationService.getCrossMerchantReputation(agentId);

        res.status(200).json({
            success: true,
            data: reputation
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

/**
 * Flag agent as suspicious
 */
exports.flagAgent = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { reason } = req.body;

        const result = await ReputationService.flagSuspiciousAgent(
            agentId,
            reason,
            req.user.id
        );

        res.status(200).json({
            success: true,
            data: result,
            message: 'Agent flagged successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};