const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: [true, 'Transaction ID is required']
    },
    type: {
        type: String,
        required: [true, 'Approval type is required'],
        enum: {
            values: ['human_approval', 'multi_sig', 'verification', 'rollback_approval'],
            message: '{VALUE} is not a valid approval type'
        }
    },
    status: {
        type: String,
        enum: {
            values: ['pending', 'approved', 'rejected', 'expired', 'escalated'],
            message: '{VALUE} is not a valid status'
        },
        default: 'pending'
    },
    requiredApprovals: {
        type: Number,
        default: 1,
        min: [1, 'Required approvals must be at least 1']
    },
    approvals: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        action: {
            type: String,
            enum: {
                values: ['approve', 'reject'],
                message: '{VALUE} is not a valid approval action'
            }
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        comment: {
            type: String,
            trim: true,
            maxlength: [500, 'Comment cannot exceed 500 characters']
        },
        ipAddress: {
            type: String,
            trim: true
        },
        userAgent: {
            type: String,
            trim: true
        }
    }],
    checkpoints: [{
        name: {
            type: String,
            trim: true,
            maxlength: [100, 'Checkpoint name cannot exceed 100 characters']
        },
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
        min: [0, 'Risk score cannot be less than 0'],
        max: [100, 'Risk score cannot exceed 100'],
        default: 0
    },
    context: {
        agentId: {
            type: String,
            trim: true
        },
        sessionId: {
            type: String,
            trim: true
        },
        reason: {
            type: String,
            trim: true,
            maxlength: [500, 'Reason cannot exceed 500 characters']
        },
        priority: {
            type: String,
            enum: {
                values: ['low', 'medium', 'high', 'critical'],
                message: '{VALUE} is not a valid priority level'
            },
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
    escalationReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Escalation reason cannot exceed 500 characters']
    },
    metadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Indexes (Bilkul waisa hi)
approvalSchema.index({ transactionId: 1, status: 1 });
approvalSchema.index({ status: 1, expiresAt: 1 });
approvalSchema.index({ 'approvals.userId': 1 });

// Methods (Bilkul waisa hi)
approvalSchema.methods.addApproval = function (userId, action, comment = '') {
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

approvalSchema.methods.addCheckpoint = function (name, metadata = {}) {
    this.checkpoints.push({
        name,
        required: true,
        verified: false,
        metadata
    });
    return this.save();
};

approvalSchema.methods.verifyCheckpoint = function (name, userId) {
    const checkpoint = this.checkpoints.find(c => c.name === name);
    if (checkpoint) {
        checkpoint.verified = true;
        checkpoint.verifiedAt = new Date();
        checkpoint.verifiedBy = userId;
    }
    return this.save();
};

module.exports = mongoose.model('Approval', approvalSchema);