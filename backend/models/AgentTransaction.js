const mongoose = require('mongoose');

const agentTransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        unique: true,
        required: true
    },
    agentId: {
        type: String,
        ref: 'AgentIdentity',
        required: true
    },
    merchantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['purchase', 'refund', 'inquiry', 'action', 'verification'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'flagged', 'reversed'],
        default: 'pending'
    },
    amount: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    action: {
        type: String,
        required: true
    },
    data: mongoose.Schema.Types.Mixed,
    signature: {
        type: String,
        required: true
    },
    verification: {
        verified: {
            type: Boolean,
            default: false
        },
        method: String,
        verifiedAt: Date,
        verifiedBy: String
    },
    flags: [{
        type: String,
        enum: ['suspicious', 'high_risk', 'unusual_pattern', 'impersonation']
    }],
    trustScoreBefore: Number,
    trustScoreAfter: Number,
    metadata: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Generate transaction ID
agentTransactionSchema.pre('save', function(next) {
    if (this.isNew && !this.transactionId) {
        const crypto = require('crypto');
        this.transactionId = `TXN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    }
    next();
});

// Indexes
agentTransactionSchema.index({ agentId: 1, timestamp: -1 });
agentTransactionSchema.index({ merchantId: 1, timestamp: -1 });
agentTransactionSchema.index({ status: 1, timestamp: -1 });
agentTransactionSchema.index({ transactionId: 1 });

module.exports = mongoose.model('AgentTransaction', agentTransactionSchema);