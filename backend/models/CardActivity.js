const mongoose = require('mongoose');

const cardActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    cardId: {
        type: String,
        required: true
    },
    action: {
        type: String,
        enum: [
            'card_added',
            'payment_attempt',
            'payment_success',
            'payment_failed',
            'card_removed',
            'card_updated'
        ],
        required: true
    },
    cardDetails: {
        lastFour: String,
        issuer: String,
        country: String,
        bin: String // First 6 digits
    },
    paymentAmount: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'success', 'failed', 'declined'],
        default: 'pending'
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: true
    },
    sessionId: {
        type: String,
        required: true
    },
    riskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    isSuspicious: {
        type: Boolean,
        default: false
    },
    detectionFlags: [{
        type: String,
        enum: [
            'rapid_card_addition',
            'multiple_failures',
            'test_transaction',
            'unusual_bin',
            'high_velocity',
            'compromised_agent',
            'unusual_time',
            'device_anomaly'
        ]
    }],
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for fast queries
cardActivitySchema.index({ userId: 1, timestamp: -1 });
cardActivitySchema.index({ cardId: 1, timestamp: -1 });
cardActivitySchema.index({ isSuspicious: 1, timestamp: -1 });
cardActivitySchema.index({ action: 1, timestamp: -1 });
cardActivitySchema.index({ 'cardDetails.lastFour': 1 });

// Virtual for card count
cardActivitySchema.virtual('cardCount').get(function() {
    return this._cardCount || 0;
});

module.exports = mongoose.model('CardActivity', cardActivitySchema);