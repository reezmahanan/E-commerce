// backend/utils/signatureVerification.js
const crypto = require('crypto');

/**
 * Verify ClaudeBot signature using HMAC-SHA256
 */
function verifyClaudeSignature(signature, body, secret) {
    if (!signature || !body) {
        console.warn('⚠️ Missing signature or body for verification');
        return false;
    }

    try {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(body))
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature, 'utf8'),
            Buffer.from(expectedSignature, 'utf8')
        );
    } catch (error) {
        console.error('❌ Signature verification error:', error);
        return false;
    }
}

/**
 * Generate signature for outgoing requests (for testing)
 */
function generateClaudeSignature(body, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');
}

/**
 * Check if request is from a trusted agent
 */
function isTrustedAgent(req) {
    // First check: Cryptographic signature
    const signature = req.headers['x-claude-signature'];
    if (signature) {
        const secret = process.env.CLAUDE_WEBHOOK_SECRET;
        if (secret && verifyClaudeSignature(signature, req.body, secret)) {
            return {
                isTrusted: true,
                verificationMethod: 'signature'
            };
        }
    }

    // If signature is missing or invalid, reject immediately. No insecure fallbacks.
    return { 
        isTrusted: false, 
        reason: 'not_verified',
        verificationMethod: 'none'
    };
}

module.exports = {
    verifyClaudeSignature,
    generateClaudeSignature,
    isTrustedAgent
};