const mongoose = require('mongoose');
const crypto = require('crypto');

const agentIdentitySchema = new mongoose.Schema({
    agentId: {
        type: String,
        unique: true,
        required: [true, 'Agent ID is required'],
        trim: true,
        minlength: [8, 'Agent ID must be at least 8 characters long'],
        maxlength: [50, 'Agent ID must be less than 50 characters long']
    },
    agentName: {
        type: String,
        required: [true, 'Agent name is required'],
        trim: true,
        minlength: [3, 'Agent name must be at least 3 characters long'],
        maxlength: [100, 'Agent name must be less than 100 characters long']
    },
    agentType: {
        type: String,
        required: [true, 'Agent type is required'],
        enum: {
            values: ['shopping', 'research', 'payment', 'customer_service', 'fraud_detection'],
            message: '{VALUE} is not a valid agent type'
        }
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Owner ID is required']
    },
    ownerType: {
        type: String,
        enum: {
            values: ['individual', 'business', 'organization'],
            message: '{VALUE} is not a valid owner type'
        },
        default: 'individual'
    },
    // Cryptographic identity
    publicKey: {
        type: String,
        required: [true, 'Public key is required'],
        trim: true
    },
    privateKey: {
        type: String,
        select: false, // Never expose in queries
        trim: true
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
        enum: {
            values: ['manual', 'automated', 'third_party'],
            message: '{VALUE} is not a valid verification method'
        },
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
        select: false,
        trim: true
    },
    // Status
    status: {
        type: String,
        enum: {
            values: ['active', 'suspended', 'revoked', 'pending_verification'],
            message: '{VALUE} is not a valid status'
        },
        default: 'pending_verification'
    },
    // Metadata
    ipAddress: {
        type: String,
        trim: true
    },
    userAgent: {
        type: String,
        trim: true
    },
    metadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Generate agent ID before saving
agentIdentitySchema.pre('save', function (next) {
    if (this.isNew && !this.agentId) {
        this.agentId = `AGT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    }
    next();
});

// Generate key pair
agentIdentitySchema.methods.generateKeyPair = function () {
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
agentIdentitySchema.methods.sign = function (data) {
    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(data));
    sign.end();
    return sign.sign(this.privateKey, 'base64');
};

// Verify signature
agentIdentitySchema.methods.verify = function (data, signature) {
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