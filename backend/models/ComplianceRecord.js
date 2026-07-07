const mongoose = require('mongoose');

const complianceRecordSchema = new mongoose.Schema({
    recordId: {
        type: String,
        unique: true,
        required: true
    },
    negotiationId: {
        type: String,
        ref: 'Negotiation',
        required: true
    },
    // Regulatory framework
    framework: {
        type: String,
        enum: ['gdpr', 'ccpa', 'hipaa', 'pci_dss', 'soc2', 'iso27001'],
        required: true
    },
    // Compliance checks
    checks: [{
        name: {
            type: String,
            required: true
        },
        description: String,
        passed: {
            type: Boolean,
            default: false
        },
        details: String,
        evidence: String,
        checkedAt: {
            type: Date,
            default: Date.now
        },
        checkedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    // Status
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'compliant', 'non_compliant', 'exempt'],
        default: 'pending'
    },
    // Risk assessment
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    riskFactors: [String],
    // Audit readiness
    auditReady: {
        type: Boolean,
        default: false
    },
    auditNotes: String,
    // Reporting
    reports: [{
        type: {
            type: String,
            enum: ['internal', 'regulatory', 'customer']
        },
        format: String,
        generatedAt: Date,
        fileUrl: String,
        metadata: mongoose.Schema.Types.Mixed
    }],
    // Escalation
    escalated: {
        type: Boolean,
        default: false
    },
    escalatedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    escalationReason: String,
    // Metadata
    metadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Generate record ID
complianceRecordSchema.pre('save', function(next) {
    if (this.isNew && !this.recordId) {
        const crypto = require('crypto');
        this.recordId = `COMPLY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    }
    next();
});

// Methods
complianceRecordSchema.methods.addCheck = function(checkData) {
    this.checks.push({
        ...checkData,
        checkedAt: new Date()
    });
    return this.save();
};

complianceRecordSchema.methods.updateStatus = function() {
    const allPassed = this.checks.every(c => c.passed);
    this.status = allPassed ? 'compliant' : 'non_compliant';
    return this.save();
};

// Indexes
complianceRecordSchema.index({ negotiationId: 1 });
complianceRecordSchema.index({ framework: 1, status: 1 });
complianceRecordSchema.index({ auditReady: 1 });
complianceRecordSchema.index({ riskLevel: 1 });

module.exports = mongoose.model('ComplianceRecord', complianceRecordSchema);