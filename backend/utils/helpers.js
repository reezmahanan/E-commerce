const validator = require('validator');
const crypto = require('crypto');

function safeNumber(value, fallback = 0) {
    if (value === null || value === undefined) return fallback;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function safeInteger(value, fallback = 0) {
    if (value === null || value === undefined) return fallback;
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
}

function sanitizeString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function deepSanitize(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(item => deepSanitize(item));
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = deepSanitize(value);
        }
        return sanitized;
    }
    return obj;
}

function getPagination(page, limit, maxLimit = 50) {
    const safePage = Math.max(1, safeInteger(page, 1));
    const safeLimit = Math.min(maxLimit, Math.max(1, safeInteger(limit, 10)));
    return {
        page: safePage,
        limit: safeLimit,
        offset: (safePage - 1) * safeLimit
    };
}

function buildPaginationMeta(total, page, limit) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
    };
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function safeObject(value, fallback = {}) {
    return (value && typeof value === 'object' && !Array.isArray(value)) ? value : fallback;
}

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return validator.isEmail(email.trim());
}

function validatePhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    return validator.isMobilePhone(cleaned, 'any');
}

function validateUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return validator.isURL(url.trim(), {
        protocols: ['http', 'https'],
        require_protocol: true
    });
}

function validatePincode(pincode) {
    if (!pincode || typeof pincode !== 'string') return false;
    return /^\d{6}$/.test(pincode.trim());
}

function validateUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') return false;
    return validator.isUUID(uuid);
}

function generateSlug(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function truncate(text, length = 100, suffix = '...') {
    if (!text || typeof text !== 'string') return '';
    if (text.length <= length) return text;
    return text.substring(0, length).trim() + suffix;
}

function generateUUID() {
    return crypto.randomUUID();
}

function generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}

function generateRandomString(length = 16) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}

function formatResponse(success, data, message = null, errors = null) {
    const response = { success };
    if (data !== null && data !== undefined) response.data = data;
    if (message) response.message = message;
    if (errors) response.errors = errors;
    return response;
}

function formatError(message, code = null, details = null) {
    const error = { success: false, message };
    if (code) error.code = code;
    if (details) error.details = details;
    return error;
}

function maskEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const masked = local.length > 2 
        ? local[0] + '*'.repeat(Math.min(local.length - 2, 4)) + local[local.length - 1]
        : local;
    return `${masked}@${domain}`;
}

function maskPhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.length <= 4) return '****';
    return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
}

function isValidJSON(str) {
    if (!str || typeof str !== 'string') return false;
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

function parseJSON(str, fallback = null) {
    if (!str || typeof str !== 'string') return fallback;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function retry(fn, retries = 3, delay = 1000) {
    return async function(...args) {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                return await fn(...args);
            } catch (error) {
                lastError = error;
                if (i < retries - 1) {
                    await sleep(delay * Math.pow(2, i));
                }
            }
        }
        throw lastError;
    };
}

function isObjectId(id) {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
}

function isMongoId(id) {
    return isObjectId(id);
}

function isPostgresUUID(uuid) {
    return validateUUID(uuid);
}

module.exports = {
    safeNumber,
    safeInteger,
    sanitizeString,
    escapeHTML,
    deepSanitize,
    getPagination,
    buildPaginationMeta,
    safeArray,
    safeObject,
    asyncHandler,
    validateEmail,
    validatePhone,
    validateUrl,
    validatePincode,
    validateUUID,
    generateSlug,
    truncate,
    generateUUID,
    generateOTP,
    generateRandomString,
    formatResponse,
    formatError,
    maskEmail,
    maskPhone,
    isValidJSON,
    parseJSON,
    sleep,
    retry,
    isObjectId,
    isMongoId,
    isPostgresUUID
};