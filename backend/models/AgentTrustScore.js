const mongoose = require('mongoose');

const agentTrustScoreSchema = new mongoose.Schema({
    agentId: {
        type: String,
        ref: 'AgentIdentity',
        required: [true, 'Agent ID is required'],
        unique: true,
        trim: true
    },
    overallScore: {
        type: Number,
        min: [0, 'Overall score cannot be less than 0'],
        max: [100, 'Overall score cannot exceed 100'],
        default: 50
    },
    trustLevel: {
        type: String,
        enum: {
            values: ['untrusted', 'low', 'medium', 'high', 'verified'],
            message: '{VALUE} is not a valid trust level'
        },
        default: 'low'
    },
    components: {
        identityVerification: {
            score: {
                type: Number,
                default: 0,
                min: [0, 'Identity verification score cannot be less than 0'],
                max: [100, 'Identity verification score cannot exceed 100']
            },
            weight: {
                type: Number,
                default: 0.25,
                min: [0, 'Weight cannot be negative'],
                max: [1, 'Weight cannot exceed 1']
            }
        },
        transactionHistory: {
            score: {
                type: Number,
                default: 0,
                min: [0, 'Transaction history score cannot be less than 0'],
                max: [100, 'Transaction history score cannot exceed 100']
            },
            weight: {
                type: Number,
                default: 0.25,
                min: [0, 'Weight cannot be negative'],
                max: [1, 'Weight cannot exceed 1']
            }
        },
        successRate: {
            score: {
                type: Number,
                default: 0,
                min: [0, 'Success rate score cannot be less than 0'],
                max: [100, 'Success rate score cannot exceed 100']
            },
            weight: {
                type: Number,
                default: 0.20,
                min: [0, 'Weight cannot be negative'],
                max: [1, 'Weight cannot exceed 1']
            }
        },
        merchantRatings: {
            score: {
                type: Number,
                default: 0,
                min: [0, 'Merchant ratings score cannot be less than 0'],
                max: [100, 'Merchant ratings score cannot exceed 100']
            },
            weight: {
                type: Number,
                default: 0.15,
                min: [0, 'Weight cannot be negative'],
                max: [1, 'Weight cannot exceed 1']
            }
        },
        fraudDetection: {
            score: {
                type: Number,
                default: 0,
                min: [0, 'Fraud detection score cannot be less than 0'],
                max: [100, 'Fraud detection score cannot exceed 100']
            },
            weight: {
                type: Number,
                default: 0.15,
                min: [0, 'Weight cannot be negative'],
                max: [1, 'Weight cannot exceed 1']
            }
        }
    },
    metrics: {
        totalTransactions: {
            type: Number,
            default: 0,
            min: [0, 'Total transactions count cannot be negative']
        },
        successfulTransactions: {
            type: Number,
            default: 0,
            min: [0, 'Successful transactions count cannot be negative']
        },
        failedTransactions: {
            type: Number,
            default: 0,
            min: [0, 'Failed transactions count cannot be negative']
        },
        flaggedTransactions: {
            type: Number,
            default: 0,
            min: [0, 'Flagged transactions count cannot be negative']
        },
        averageResponseTime: {
            type: Number,
            default: 0,
            min: [0, 'Average response time cannot be negative']
        },
        uptime: {
            type: Number,
            default: 100,
            min: [0, 'Uptime cannot be less than 0'],
            max: [100, 'Uptime cannot exceed 100']
        }
    },
    history: [{
        score: {
            type: Number,
            min: [0, 'Historical score cannot be less than 0'],
            max: [100, 'Historical score cannot exceed 100']
        },
        trustLevel: {
            type: String,
            enum: {
                values: ['untrusted', 'low', 'medium', 'high', 'verified'],
                message: '{VALUE} is not a valid historical trust level'
            }
        },
        reason: {
            type: String,
            trim: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    flags: [{
        type: {
            type: String,
            enum: {
                values: ['warning', 'critical', 'review'],
                message: '{VALUE} is not a valid flag type'
            }
        },
        reason: {
            type: String,
            trim: true
        },
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

// Calculate overall score (Bilkul waisa hi)
agentTrustScoreSchema.methods.calculateScore = function () {
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

// Add flag (Bilkul waisa hi)
agentTrustScoreSchema.methods.addFlag = function (type, reason) {
    this.flags.push({ type, reason });
    return this.save();
};

// Update metrics (Bilkul waisa hi)
agentTrustScoreSchema.methods.updateMetrics = function (transaction) {
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