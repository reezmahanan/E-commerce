const mongoose = require('mongoose');

const agentTrustScoreSchema = new mongoose.Schema({
    agentId: {
        type: String,
        ref: 'AgentIdentity',
        required: true,
        unique: true
    },
    overallScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
    },
    trustLevel: {
        type: String,
        enum: ['untrusted', 'low', 'medium', 'high', 'verified'],
        default: 'low'
    },
    components: {
        identityVerification: {
            score: { type: Number, default: 0 },
            weight: { type: Number, default: 0.25 }
        },
        transactionHistory: {
            score: { type: Number, default: 0 },
            weight: { type: Number, default: 0.25 }
        },
        successRate: {
            score: { type: Number, default: 0 },
            weight: { type: Number, default: 0.20 }
        },
        merchantRatings: {
            score: { type: Number, default: 0 },
            weight: { type: Number, default: 0.15 }
        },
        fraudDetection: {
            score: { type: Number, default: 0 },
            weight: { type: Number, default: 0.15 }
        }
    },
    metrics: {
        totalTransactions: { type: Number, default: 0 },
        successfulTransactions: { type: Number, default: 0 },
        failedTransactions: { type: Number, default: 0 },
        flaggedTransactions: { type: Number, default: 0 },
        averageResponseTime: { type: Number, default: 0 },
        uptime: { type: Number, default: 100 }
    },
    history: [{
        score: Number,
        trustLevel: String,
        reason: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    flags: [{
        type: {
            type: String,
            enum: ['warning', 'critical', 'review']
        },
        reason: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        resolved: {
            type: Boolean,
            default: false
        }
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Calculate overall score
agentTrustScoreSchema.methods.calculateScore = function() {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, component] of Object.entries(this.components)) {
        totalScore += component.score * component.weight;
        totalWeight += component.weight;
    }

    this.overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    this.lastUpdated = new Date();

    // Determine trust level
    if (this.overallScore >= 80) this.trustLevel = 'verified';
    else if (this.overallScore >= 60) this.trustLevel = 'high';
    else if (this.overallScore >= 40) this.trustLevel = 'medium';
    else if (this.overallScore >= 20) this.trustLevel = 'low';
    else this.trustLevel = 'untrusted';

    // Add history entry
    this.history.push({
        score: this.overallScore,
        trustLevel: this.trustLevel,
        reason: 'Auto-calculated score update'
    });

    // Keep history manageable (last 100 entries)
    if (this.history.length > 100) {
        this.history = this.history.slice(-100);
    }

    return this.save();
};

// Add flag
agentTrustScoreSchema.methods.addFlag = function(type, reason) {
    this.flags.push({ type, reason });
    return this.save();
};

// Update metrics
agentTrustScoreSchema.methods.updateMetrics = function(transaction) {
    this.metrics.totalTransactions++;

    if (transaction.status === 'success') {
        this.metrics.successfulTransactions++;
    } else if (transaction.status === 'failed') {
        this.metrics.failedTransactions++;
    }

    if (transaction.flags && transaction.flags.length > 0) {
        this.metrics.flaggedTransactions++;
    }

    // Update success rate
    const successRate = this.metrics.successfulTransactions / this.metrics.totalTransactions;
    this.components.successRate.score = successRate * 100;

    return this.save();
};

module.exports = mongoose.model('AgentTrustScore', agentTrustScoreSchema);