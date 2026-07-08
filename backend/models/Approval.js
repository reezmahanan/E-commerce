const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true
    },
    type: {
        type: String,
        enum: ['human_approval', 'multi_sig', 'verification', 'rollback_approval'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'expired', 'escalated'],
        default: 'pending'
    },
    requiredApprovals: {
        type: Number,
        default: 1
    },
    approvals: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        action: {
            type: String,
            enum: ['approve', 'reject']
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        comment: String,
        ipAddress: String,
        userAgent: String
    }],
    checkpoints: [{
        name: String,
        required: Boolean,
        verified: {
            type: Boolean,
            default: false
        },
        verifiedAt: Date,
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        metadata: mongoose.Schema.Types.Mixed
    }],
    riskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    context: {
        agentId: String,
        sessionId: String,
        reason: String,
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        }
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    },
    escalatedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    escalationReason: String,
    metadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Indexes
approvalSchema.index({ transactionId: 1, status: 1 });
approvalSchema.index({ status: 1, expiresAt: 1 });
approvalSchema.index({ 'approvals.userId': 1 });

// Methods
approvalSchema.methods.addApproval = function(userId, action, comment = '') {
    this.approvals.push({
        userId,
        action,
        comment,
        timestamp: new Date(),
        ipAddress: this._ipAddress,
        userAgent: this._userAgent
    });

    // Check if enough approvals
    const approvedCount = this.approvals.filter(a => a.action === 'approve').length;
    const rejectedCount = this.approvals.filter(a => a.action === 'reject').length;

    if (rejectedCount > 0) {
        this.status = 'rejected';
    } else if (approvedCount >= this.requiredApprovals) {
        this.status = 'approved';
    }

    return this.save();
};

approvalSchema.methods.addCheckpoint = function(name, metadata = {}) {
    this.checkpoints.push({
        name,
        required: true,
        verified: false,
        metadata
    });
    return this.save();
};

approvalSchema.methods.verifyCheckpoint = function(name, userId) {
    const checkpoint = this.checkpoints.find(c => c.name === name);
    if (checkpoint) {
        checkpoint.verified = true;
        checkpoint.verifiedAt = new Date();
        checkpoint.verifiedBy = userId;
    }
    return this.save();
};

module.exports = mongoose.model('Approval', approvalSchema);