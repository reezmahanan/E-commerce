const mongoose = require('mongoose');

const agentScoreSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    overallScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    factors: {
        cardAdditionVelocity: {
            score: { type: Number, default: 0 },
            weight: { type: Number, default: 0.25 }
        },
        paymentFailureRate: {
            score: { type: Number, default: 0 },
            weight: { type: Number, default: 0.25 }
        },
        uniqueCardsCount: {
            score: { type: Number, default: 0 },
            weight: { type: Number, default: 0.20 }
        },
        testTransactionPattern: {
            score: { type: Number, default: 0 },
            weight: { type: Number, default: 0.15 }
        },
        behavioralAnomaly: {
            score: { type: Number, default: 0 },
            weight: { type: Number, default: 0.15 }
        }
    },
    alerts: [{
        type: {
            type: String,
            enum: ['warning', 'critical']
        },
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        resolved: {
            type: Boolean,
            default: false
        }
    }],
    actionHistory: [{
        action: String,
        timestamp: Date,
        reason: String
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Methods
agentScoreSchema.methods.updateScore = function() {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, factor] of Object.entries(this.factors)) {
        totalScore += factor.score * factor.weight;
        totalWeight += factor.weight;
    }

    this.overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    this.lastUpdated = new Date();

    // Determine risk level
    if (this.overallScore > 80) this.riskLevel = 'critical';
    else if (this.overallScore > 60) this.riskLevel = 'high';
    else if (this.overallScore > 30) this.riskLevel = 'medium';
    else this.riskLevel = 'low';

    return this.save();
};

agentScoreSchema.methods.addAlert = function(type, message) {
    this.alerts.push({ type, message });
    return this.save();
};

module.exports = mongoose.model('AgentScore', agentScoreSchema);