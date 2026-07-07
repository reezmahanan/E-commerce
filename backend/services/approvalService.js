const Approval = require('../models/Approval');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

class ApprovalService {
    constructor() {
        this.escaltionThresholds = {
            low: { time: 60, approvals: 1 },
            medium: { time: 30, approvals: 2 },
            high: { time: 15, approvals: 3 },
            critical: { time: 5, approvals: 4 }
        };
    }

    /**
     * Request approval for a transaction
     */
    async requestApproval(transactionId, requiredApprovals = 1, context = {}) {
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            throw new Error('Transaction not found');
        }

        // Calculate risk score
        const riskScore = this.calculateRiskScore(transaction);

        // Determine priority
        const priority = this.determinePriority(riskScore);

        // Create approval request
        const approval = new Approval({
            transactionId: transaction._id,
            type: 'human_approval',
            requiredApprovals: requiredApprovals || this.getRequiredApprovals(priority),
            riskScore,
            context: {
                agentId: context.agentId,
                sessionId: context.sessionId,
                reason: context.reason,
                priority
            },
            expiresAt: new Date(Date.now() + this.getExpiryTime(priority))
        });

        await approval.save();

        // Update transaction
        transaction.approvalRequestId = approval._id;
        transaction.status = 'pending_approval';
        await transaction.save();

        // Notify approvers
        await this.notifyApprovers(approval);

        return approval;
    }

    /**
     * Approve a transaction
     */
    async approveTransaction(approvalId, userId, comment = '') {
        const approval = await Approval.findById(approvalId);
        if (!approval) {
            throw new Error('Approval request not found');
        }

        if (approval.status !== 'pending') {
            throw new Error(`Approval already ${approval.status}`);
        }

        // Check if user is authorized
        // In production, check user roles/permissions

        // Add approval
        await approval.addApproval(userId, 'approve', comment);

        // If approved, execute transaction
        if (approval.status === 'approved') {
            const transaction = await Transaction.findById(approval.transactionId);
            await transaction.execute();
            
            // Log approval
            console.log(`✅ Transaction ${transaction.transactionId} approved by ${userId}`);
        }

        return approval;
    }

    /**
     * Reject a transaction
     */
    async rejectTransaction(approvalId, userId, comment = '') {
        const approval = await Approval.findById(approvalId);
        if (!approval) {
            throw new Error('Approval request not found');
        }

        if (approval.status !== 'pending') {
            throw new Error(`Approval already ${approval.status}`);
        }

        await approval.addApproval(userId, 'reject', comment);

        // Update transaction
        const transaction = await Transaction.findById(approval.transactionId);
        transaction.status = 'rejected';
        await transaction.save();

        console.log(`❌ Transaction ${transaction.transactionId} rejected by ${userId}`);

        return approval;
    }

    /**
     * Get pending approvals for a user
     */
    async getPendingApprovals(userId, limit = 20) {
        // Get approvals where user is approver
        // In production, this would check user's role/permissions
        
        const approvals = await Approval.find({
            status: 'pending',
            expiresAt: { $gt: new Date() }
        })
        .populate('transactionId')
        .sort({ priority: -1, createdAt: 1 })
        .limit(limit);

        return approvals;
    }

    /**
     * Add verification checkpoint
     */
    async addVerificationCheckpoint(approvalId, checkpointName, metadata = {}) {
        const approval = await Approval.findById(approvalId);
        if (!approval) {
            throw new Error('Approval request not found');
        }

        await approval.addCheckpoint(checkpointName, metadata);
        return approval;
    }

    /**
     * Verify checkpoint
     */
    async verifyCheckpoint(approvalId, checkpointName, userId) {
        const approval = await Approval.findById(approvalId);
        if (!approval) {
            throw new Error('Approval request not found');
        }

        await approval.verifyCheckpoint(checkpointName, userId);
        return approval;
    }

    /**
     * Escalate approval
     */
    async escalateApproval(approvalId, userId, reason = '') {
        const approval = await Approval.findById(approvalId);
        if (!approval) {
            throw new Error('Approval request not found');
        }

        // Find admin/manager user
        const admin = await User.findOne({ role: 'admin' });
        if (!admin) {
            throw new Error('No admin available for escalation');
        }

        approval.status = 'escalated';
        approval.escalatedTo = admin._id;
        approval.escalationReason = reason || 'Escalated due to urgency';
        await approval.save();

        // Notify admin
        await this.notifyAdmin(approval, admin);

        return approval;
    }

    /**
     * Calculate risk score for transaction
     */
    calculateRiskScore(transaction) {
        let score = 0;
        const factors = [];

        // Amount factor
        if (transaction.amount > 10000) {
            score += 30;
            factors.push('High transaction amount');
        } else if (transaction.amount > 5000) {
            score += 20;
            factors.push('Medium transaction amount');
        } else if (transaction.amount > 1000) {
            score += 10;
        }

        // Type factor
        if (transaction.type === 'refund' || transaction.type === 'cancellation') {
            score += 20;
            factors.push('Refund/Cancellation transaction');
        }

        // Source factor
        if (transaction.source === 'agent_ai') {
            score += 15;
            factors.push('AI-initiated transaction');
        }

        // Confidence factor
        if (transaction.agentDecision?.confidence < 0.7) {
            score += 15;
            factors.push('Low confidence in AI decision');
        }

        // Risk assessment from AI
        if (transaction.agentDecision?.riskAssessment?.score) {
            score += transaction.agentDecision.riskAssessment.score * 0.3;
        }

        return Math.min(100, Math.round(score));
    }

    /**
     * Determine priority based on risk score
     */
    determinePriority(riskScore) {
        if (riskScore > 80) return 'critical';
        if (riskScore > 60) return 'high';
        if (riskScore > 30) return 'medium';
        return 'low';
    }

    /**
     * Get required approvals based on priority
     */
    getRequiredApprovals(priority) {
        return this.escaltionThresholds[priority]?.approvals || 1;
    }

    /**
     * Get expiry time based on priority (in minutes)
     */
    getExpiryTime(priority) {
        return (this.escaltionThresholds[priority]?.time || 30) * 60 * 1000;
    }

    /**
     * Notify approvers
     */
    async notifyApprovers(approval) {
        // In production, send email, SMS, or push notification
        console.log(`📧 Approval request created: ${approval._id}`);
        console.log(`   Priority: ${approval.context.priority}`);
        console.log(`   Required approvals: ${approval.requiredApprovals}`);
    }

    /**
     * Notify admin about escalation
     */
    async notifyAdmin(approval, admin) {
        console.log(`🔔 Approval escalated to admin ${admin.email}`);
        console.log(`   Approval: ${approval._id}`);
        console.log(`   Reason: ${approval.escalationReason}`);
    }
}

module.exports = new ApprovalService();