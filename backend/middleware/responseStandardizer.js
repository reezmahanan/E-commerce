// backend/middleware/responseStandardizer.js
const crypto = require('crypto');

// ============================================
// RESPONSE FORMAT CONFIGURATION
// ============================================

const RESPONSE_CONFIG = {
    includeTimestamp: true,
    includeRequestId: true,
    includePath: false,
    includeDuration: true,
    environment: process.env.NODE_ENV || 'development'
};

// ============================================
// STANDARD RESPONSE CLASS
// ============================================

class StandardResponse {
    constructor(options = {}) {
        this.success = options.success !== undefined ? options.success : true;
        this.message = options.message || '';
        this.data = options.data || null;
        this.errors = options.errors || null;
        this.timestamp = options.timestamp || new Date().toISOString();
        this.requestId = options.requestId || null;
        this.statusCode = options.statusCode || 200;
        this.path = options.path || null;
        this.duration = options.duration || null;
        this.pagination = options.pagination || null;
        this.meta = options.meta || null;
    }

    /**
     * Create a success response
     */
    static success(data, message = 'Success', options = {}) {
        return new StandardResponse({
            success: true,
            message,
            data,
            statusCode: 200,
            ...options
        });
    }

    /**
     * Create an error response
     */
    static error(message, statusCode = 400, errors = null, options = {}) {
        return new StandardResponse({
            success: false,
            message,
            errors,
            statusCode,
            ...options
        });
    }

    /**
     * Create a created response
     */
    static created(data, message = 'Resource created successfully', options = {}) {
        return new StandardResponse({
            success: true,
            message,
            data,
            statusCode: 201,
            ...options
        });
    }

    /**
     * Create a paginated response
     */
    static paginated(data, pagination, message = 'Success', options = {}) {
        return new StandardResponse({
            success: true,
            message,
            data,
            pagination,
            statusCode: 200,
            ...options
        });
    }

    /**
     * Create a no content response
     */
    static noContent(message = 'No content', options = {}) {
        return new StandardResponse({
            success: true,
            message,
            data: null,
            statusCode: 204,
            ...options
        });
    }

    /**
     * Create a validation error response
     */
    static validationError(errors, message = 'Validation failed', options = {}) {
        return new StandardResponse({
            success: false,
            message,
            errors,
            statusCode: 400,
            ...options
        });
    }

    /**
     * Create an unauthorized response
     */
    static unauthorized(message = 'Unauthorized', options = {}) {
        return new StandardResponse({
            success: false,
            message,
            errors: [{ code: 'UNAUTHORIZED', message }],
            statusCode: 401,
            ...options
        });
    }

    /**
     * Create a forbidden response
     */
    static forbidden(message = 'Forbidden', options = {}) {
        return new StandardResponse({
            success: false,
            message,
            errors: [{ code: 'FORBIDDEN', message }],
            statusCode: 403,
            ...options
        });
    }

    /**
     * Create a not found response
     */
    static notFound(message = 'Resource not found', options = {}) {
        return new StandardResponse({
            success: false,
            message,
            errors: [{ code: 'NOT_FOUND', message }],
            statusCode: 404,
            ...options
        });
    }

    /**
     * Create a conflict response
     */
    static conflict(message = 'Conflict', errors = null, options = {}) {
        return new StandardResponse({
            success: false,
            message,
            errors,
            statusCode: 409,
            ...options
        });
    }

    /**
     * Create a server error response
     */
    static serverError(message = 'Internal server error', errors = null, options = {}) {
        return new StandardResponse({
            success: false,
            message,
            errors,
            statusCode: 500,
            ...options
        });
    }

    /**
     * Convert to JSON
     */
    toJSON() {
        const response = {
            success: this.success,
            message: this.message
        };

        if (this.data !== null) {
            response.data = this.data;
        }

        if (this.errors !== null) {
            response.errors = this.errors;
        }

        if (RESPONSE_CONFIG.includeTimestamp) {
            response.timestamp = this.timestamp;
        }

        if (RESPONSE_CONFIG.includeRequestId && this.requestId) {
            response.requestId = this.requestId;
        }

        if (this.pagination) {
            response.pagination = this.pagination;
        }

        if (this.meta) {
            response.meta = this.meta;
        }

        if (RESPONSE_CONFIG.includePath && this.path) {
            response.path = this.path;
        }

        if (RESPONSE_CONFIG.includeDuration && this.duration !== null) {
            response.duration = this.duration;
        }

        return response;
    }

    /**
     * Send response
     */
    send(res) {
        return res.status(this.statusCode).json(this.toJSON());
    }
}

// ============================================
// RESPONSE STANDARDIZATION MIDDLEWARE
// ============================================

/**
 * Middleware to standardize all responses
 */
function standardizeResponse(req, res, next) {
    // Store request start time
    req._startTime = Date.now();

    // Generate request ID
    req.requestId = generateRequestId();

    // Override res.json to standardize responses
    const originalJson = res.json;

    res.json = function(data) {
        // Calculate duration
        const duration = req._startTime ? Date.now() - req._startTime : null;

        // Check if response is already standardized
        if (data && typeof data === 'object' && 'success' in data && 'message' in data) {
            // Already standardized, add additional fields
            const standardized = {
                ...data,
                requestId: req.requestId,
                timestamp: new Date().toISOString()
            };

            if (duration !== null) {
                standardized.duration = duration;
            }

            return originalJson.call(this, standardized);
        }

        // Not standardized - wrap it
        let statusCode = this.statusCode;

        // Determine if success or error based on status code
        const isSuccess = statusCode >= 200 && statusCode < 300;
        const isError = statusCode >= 400;

        let response;

        if (isSuccess) {
            response = StandardResponse.success(data, 'Success', {
                requestId: req.requestId,
                duration,
                path: req.path
            });
        } else if (isError) {
            const message = data?.message || data?.error || 'An error occurred';
            const errors = data?.errors || (data?.error ? [{ message: data.error }] : null);
            response = StandardResponse.error(message, statusCode, errors, {
                requestId: req.requestId,
                duration,
                path: req.path
            });
        } else {
            response = StandardResponse.success(data, 'Success', {
                requestId: req.requestId,
                duration,
                path: req.path
            });
        }

        return originalJson.call(this, response.toJSON());
    };

    next();
}

/**
 * Generate a unique request ID
 */
function generateRequestId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `req_${timestamp}_${random}`;
}

// ============================================
// HELPER FUNCTIONS FOR CONTROLLERS
// ============================================

/**
 * Send a standardized success response
 */
function sendSuccess(res, data, message = 'Success', statusCode = 200) {
    const response = StandardResponse.success(data, message);
    response.statusCode = statusCode;
    return response.send(res);
}

/**
 * Send a standardized error response
 */
function sendError(res, message, statusCode = 400, errors = null) {
    const response = StandardResponse.error(message, statusCode, errors);
    return response.send(res);
}

/**
 * Send a standardized created response
 */
function sendCreated(res, data, message = 'Resource created successfully') {
    return StandardResponse.created(data, message).send(res);
}

/**
 * Send a standardized paginated response
 */
function sendPaginated(res, data, pagination, message = 'Success') {
    return StandardResponse.paginated(data, pagination, message).send(res);
}

/**
 * Send a standardized validation error
 */
function sendValidationError(res, errors, message = 'Validation failed') {
    return StandardResponse.validationError(errors, message).send(res);
}

/**
 * Send a standardized not found response
 */
function sendNotFound(res, message = 'Resource not found') {
    return StandardResponse.notFound(message).send(res);
}

/**
 * Send a standardized server error
 */
function sendServerError(res, message = 'Internal server error', errors = null) {
    return StandardResponse.serverError(message, errors).send(res);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    StandardResponse,
    standardizeResponse,
    sendSuccess,
    sendError,
    sendCreated,
    sendPaginated,
    sendValidationError,
    sendNotFound,
    sendServerError,
    generateRequestId
};