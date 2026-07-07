const mongoose = require('mongoose');
const crypto = require('crypto');

const agentIdentitySchema = new mongoose.Schema({
    agentId: {
        type: String,
        unique: true,
        required: true
    },
    agentName: {
        type: String,
        required: true
    },
    agentType: {
        type: String,
        enum: ['shopping', 'research', 'payment', 'customer_service', 'fraud_detection'],
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ownerType: {
        type: String,
        enum: ['individual', 'business', 'organization'],
        default: 'individual'
    },
    // Cryptographic identity
    publicKey: {
        type: String,
        required: true
    },
    privateKey: {
        type: String,
        select: false // Never expose in queries
    },
    keyAlgorithm: {
        type: String,
        default: 'RSA-2048'
    },
    // Verification
    verified: {
        type: Boolean,
        default: false
    },
    verificationMethod: {
        type: String,
        enum: ['manual', 'automated', 'third_party'],
        default: 'manual'
    },
    verifiedAt: Date,
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Identity documents
    registrationProof: {
        type: String,
        select: false
    },
    // Status
    status: {
        type: String,
        enum: ['active', 'suspended', 'revoked', 'pending_verification'],
        default: 'pending_verification'
    },
    // Metadata
    ipAddress: String,
    userAgent: String,
    metadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Generate agent ID before saving
agentIdentitySchema.pre('save', function(next) {
    if (this.isNew && !this.agentId) {
        this.agentId = `AGT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    }
    next();
});

// Generate key pair
agentIdentitySchema.methods.generateKeyPair = function() {
    const { generateKeyPairSync } = crypto;
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    return { publicKey, privateKey };
};

// Sign data
agentIdentitySchema.methods.sign = function(data) {
    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(data));
    sign.end();
    return sign.sign(this.privateKey, 'base64');
};

// Verify signature
agentIdentitySchema.methods.verify = function(data, signature) {
    const verify = crypto.createVerify('SHA256');
    verify.update(JSON.stringify(data));
    verify.end();
    return verify.verify(this.publicKey, signature, 'base64');
};

// Indexes
agentIdentitySchema.index({ agentId: 1 });
agentIdentitySchema.index({ ownerId: 1, status: 1 });
agentIdentitySchema.index({ verified: 1, status: 1 });

module.exports = mongoose.model('AgentIdentity', agentIdentitySchema);