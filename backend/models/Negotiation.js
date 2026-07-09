const mongoose = require('mongoose');

const negotiationSchema = new mongoose.Schema({
    negotiationId: {
        type: String,
        unique: true,
        required: true
    },
    agentId: {
        type: String,
        ref: 'AgentIdentity',
        required: true
    },
    agentName: {
        type: String,
        required: true
    },
    counterparty: {
        type: String,
        required: true
    },
    counterpartyType: {
        type: String,
        enum: ['individual', 'business', 'organization', 'ai_agent'],
        required: true
    },
    product: {
        type: String,
        required: true
    },
    productDetails: {
        category: String,
        description: String,
        quantity: Number,
        unit: String
    },
    // Negotiation details
    initialPrice: {
        type: Number,
        required: true
    },
    finalPrice: {
        type: Number,
        required: true
    },
    marketPrice: {
        type: Number
    },
    discountPercentage: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    // Negotiation steps
    steps: [{
        stepNumber: Number,
        action: {
            type: String,
            enum: ['offer', 'counter_offer', 'acceptance', 'rejection', 'concession']
        },
        proposer: {
            type: String,
            enum: ['agent', 'counterparty']
        },
        price: Number,
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        reasoning: String,
        metadata: mongoose.Schema.Types.Mixed
    }],
    // Decision points
    decisions: [{
        type: {
            type: String,
            enum: ['price_acceptance', 'concession', 'counter_proposal', 'termination']
        },
        reason: String,
        confidence: {
            type: Number,
            min: 0,
            max: 1
        },
        alternatives: [String],
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    // Status
    status: {
        type: String,
        enum: ['initiated', 'in_progress', 'accepted', 'rejected', 'expired', 'completed'],
        default: 'initiated'
    },
    outcome: {
        type: String,
        enum: ['successful', 'failed', 'cancelled']
    },
    // Legal framework
    legalStatus: {
        type: String,
        enum: ['pending_review', 'compliant', 'non_compliant', 'needs_approval'],
        default: 'pending_review'
    },
    complianceChecks: [{
        check: String,
        passed: Boolean,
        details: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    // Audit trail
    auditTrail: [{
        event: String,
        details: mongoose.Schema.Types.Mixed,
        timestamp: {
            type: Date,
            default: Date.now
        },
        actor: String
    }],
    // Signature
    signature: {
        type: String,
        select: false
    },
    // Metadata
    ipAddress: String,
    userAgent: String,
    sessionId: String,
    metadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Generate negotiation ID
negotiationSchema.pre('save', function(next) {
    if (this.isNew && !this.negotiationId) {
        const crypto = require('crypto');
        this.negotiationId = `NEG-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    }
    next();
});

// Methods
negotiationSchema.methods.addStep = function(stepData) {
    this.steps.push({
        ...stepData,
        stepNumber: this.steps.length + 1,
        timestamp: new Date()
    });
    return this.save();
};

negotiationSchema.methods.addDecision = function(decisionData) {
    this.decisions.push({
        ...decisionData,
        timestamp: new Date()
    });
    return this.save();
};

negotiationSchema.methods.addAuditEvent = function(event, details, actor) {
    this.auditTrail.push({
        event,
        details,
        timestamp: new Date(),
        actor: actor || 'system'
    });
    return this.save();
};

// Indexes
negotiationSchema.index({ agentId: 1, timestamp: -1 });
negotiationSchema.index({ status: 1, timestamp: -1 });
negotiationSchema.index({ legalStatus: 1 });
negotiationSchema.index({ negotiationId: 1 });
negotiationSchema.index({ counterparty: 1 });

module.exports = mongoose.model('Negotiation', negotiationSchema);