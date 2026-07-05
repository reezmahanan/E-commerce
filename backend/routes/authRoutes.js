// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();

// ======================== CONTROLLERS ========================
const {
    signup,
    verifySignup,
    login,
    forgotPassword,
    resetPassword,
    refreshAccessToken,
    getMe
} = require("../controllers/authController");

// ======================== MIDDLEWARE ========================
const authMiddleware = require("../middleware/authMiddleware");
const { 
    signupLimiter, 
    loginLimiter, 
    forgotPasswordLimiter, 
    refreshTokenLimiter 
} = require("../middleware/rateLimiter");
const { verifyHumanChallenge } = require("../middleware/behavioralCaptcha");
const { detectSyntheticIdentity } = require("../middleware/fraudDetectionMiddleware");

// ======================== DATABASE ========================
const db = require("../config/db").promise;

// ======================== UTILITIES ========================
const { sanitizeString } = require("../utils/helpers");

// ======================== ENVIRONMENT VALIDATION ========================
if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not set");
}

// ======================== HELPER FUNCTIONS ========================

/**
 * Validate required fields in request body
 */
function validateRequiredFields(req, res, fields) {
    const missing = fields.filter(field => !sanitizeString(req.body[field]));
    
    if (missing.length > 0) {
        return res.status(400).json({
            success: false,
            message: `${missing.join(', ')} is/are required`
        });
    }
    return null;
}

/**
 * Apply behavioral CAPTCHA check
 */
function applyCaptchaCheck(req, res, next) {
    if (process.env.ENABLE_BEHAVIORAL_CAPTCHA === 'true') {
        const captchaResult = verifyHumanChallenge(req);
        
        if (!captchaResult.passed) {
            console.warn(`🛡️ CAPTCHA failed for ${req.ip} on ${req.path}: ${captchaResult.reason}`);
            
            const statusCode = captchaResult.reason === 'rate_limit_exceeded' ? 429 : 403;
            return res.status(statusCode).json({
                success: false,
                message: captchaResult.reason === 'rate_limit_exceeded' 
                    ? 'Too many requests. Please slow down.' 
                    : 'Automated access detected. Please verify you are human.',
                retryAfter: captchaResult.retryAfter || 60,
                score: captchaResult.score
            });
        }
    }
    next();
}

// ======================== ROUTES ========================

/**
 * GET /api/auth/status
 * Check auth API status
 */
router.get("/status", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Auth API running",
        timestamp: new Date().toISOString(),
        version: "2.1.0",
        security: {
            behavioralCaptcha: process.env.ENABLE_BEHAVIORAL_CAPTCHA === 'true',
            syntheticFraudDetection: true,
            rateLimiting: true
        }
    });
});

/**
 * POST /api/auth/signup
 * Register new user with synthetic identity fraud detection
 */
router.post(
    "/signup",
    signupLimiter,
    applyCaptchaCheck,
    detectSyntheticIdentity,  // ✅ FRAUD DETECTION ADDED
    (req, res, next) => {
        const { name, email, password, age } = req.body;

        // Validate all required fields
        const validationError = validateRequiredFields(req, res, ['name', 'email', 'password']);
        if (validationError) return validationError;

        // Additional validations
        if (name.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Name must be at least 2 characters long"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        // Age validation (if provided)
        if (age && (age < 18 || age > 100)) {
            return res.status(400).json({
                success: false,
                message: "Age must be between 18 and 100"
            });
        }

        next();
    },
    signup
);

/**
 * POST /api/auth/verify-signup
 * Verify OTP for signup
 */
router.post(
    "/verify-signup",
    signupLimiter,
    applyCaptchaCheck,
    (req, res, next) => {
        const { email, otp } = req.body;
        
        const validationError = validateRequiredFields(req, res, ['email', 'otp']);
        if (validationError) return validationError;

        // OTP should be 6 digits
        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: "OTP must be 6 digits"
            });
        }

        next();
    },
    verifySignup
);

/**
 * POST /api/auth/login
 * User login
 */
router.post(
    "/login",
    loginLimiter,
    applyCaptchaCheck,
    (req, res, next) => {
        const { email, password } = req.body;

        const validationError = validateRequiredFields(req, res, ['email', 'password']);
        if (validationError) return validationError;

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        next();
    },
    login
);

/**
 * POST /api/auth/forgot-password
 * Request password reset OTP
 */
router.post(
    "/forgot-password",
    forgotPasswordLimiter,
    applyCaptchaCheck,
    (req, res, next) => {
        const { email } = req.body;
        
        const validationError = validateRequiredFields(req, res, ['email']);
        if (validationError) return validationError;

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        next();
    },
    forgotPassword
);

/**
 * POST /api/auth/reset-password
 * Reset password with OTP
 */
router.post(
    "/reset-password",
    forgotPasswordLimiter,
    applyCaptchaCheck,
    (req, res, next) => {
        const { userId, otp, newPassword } = req.body;

        const validationError = validateRequiredFields(req, res, ['userId', 'otp', 'newPassword']);
        if (validationError) return validationError;

        // UserId should be a number
        if (isNaN(Number(userId))) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID format"
            });
        }

        // OTP should be 6 digits
        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: "OTP must be 6 digits"
            });
        }

        // Password should be strong enough
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        next();
    },
    resetPassword
);

/**
 * POST /api/auth/refresh-token
 * Refresh access token
 */
router.post(
    "/refresh-token",
    refreshTokenLimiter,
    applyCaptchaCheck,
    (req, res, next) => {
        const { refreshToken } = req.body;

        const validationError = validateRequiredFields(req, res, ['refreshToken']);
        if (validationError) return validationError;

        // Refresh token should be a valid JWT format
        if (typeof refreshToken !== 'string' || refreshToken.split('.').length !== 3) {
            return res.status(400).json({
                success: false,
                message: "Invalid refresh token format"
            });
        }

        next();
    },
    refreshAccessToken
);

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post(
    "/logout",
    authMiddleware,
    async (req, res) => {
        try {
            await db.query(
                `UPDATE users 
                 SET refresh_token = NULL, 
                     last_logout = NOW() 
                 WHERE id = ?`,
                [req.user.id]
            );

            // Clear cookies if using cookie-based auth
            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');

            console.log(`🔓 User ${req.user.id} logged out successfully`);

            return res.status(200).json({
                success: true,
                message: "Logged out successfully",
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error("❌ LOGOUT ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Logout failed. Please try again."
            });
        }
    }
);

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get(
    "/me",
    authMiddleware,
    getMe
);

/**
 * POST /api/auth/validate-token
 * Validate if token is still active
 */
router.post(
    "/validate-token",
    authMiddleware,
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Token is valid",
            user: {
                id: req.user.id,
                email: req.user.email,
                role: req.user.role,
                isTrustedAgent: req.isTrustedAgent || false
            }
        });
    }
);

/**
 * POST /api/auth/change-password
 * Change password (authenticated)
 */
router.post(
    "/change-password",
    authMiddleware,
    applyCaptchaCheck,
    async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!sanitizeString(currentPassword) || !sanitizeString(newPassword)) {
                return res.status(400).json({
                    success: false,
                    message: "Current password and new password are required"
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "New password must be at least 6 characters long"
                });
            }

            // Get user with password
            const [users] = await db.query(
                `SELECT id, password 
                 FROM users 
                 WHERE id = ?`,
                [req.user.id]
            );

            if (users.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Verify current password
            const bcrypt = require('bcryptjs');
            const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
            
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: "Current password is incorrect"
                });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            await db.query(
                `UPDATE users 
                 SET password = ?, 
                     updated_at = NOW() 
                 WHERE id = ?`,
                [hashedPassword, req.user.id]
            );

            console.log(`🔐 User ${req.user.id} changed password successfully`);

            return res.status(200).json({
                success: true,
                message: "Password changed successfully"
            });

        } catch (error) {
            console.error("❌ CHANGE PASSWORD ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to change password"
            });
        }
    }
);

/**
 * GET /api/auth/security-audit
 * Get security audit log (admin only)
 */
router.get(
    "/security-audit",
    authMiddleware,
    async (req, res) => {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required"
                });
            }

            const [logs] = await db.query(
                `SELECT * FROM security_logs 
                 ORDER BY timestamp DESC 
                 LIMIT 100`
            );

            return res.status(200).json({
                success: true,
                data: logs,
                count: logs.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error("❌ SECURITY AUDIT ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch security logs"
            });
        }
    }
);

/**
 * GET /api/auth/fraud-status
 * Get fraud detection status for current user (authenticated)
 */
router.get(
    "/fraud-status",
    authMiddleware,
    async (req, res) => {
        try {
            const [detection] = await db.query(
                `SELECT risk_level, risk_score, confidence, timestamp 
                 FROM synthetic_identity_detections 
                 WHERE user_id = ? 
                 ORDER BY timestamp DESC 
                 LIMIT 1`,
                [req.user.id]
            );

            if (detection.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: "No fraud detection records found",
                    status: "clean"
                });
            }

            const isFlagged = detection[0].risk_level === 'critical' || 
                             detection[0].risk_level === 'high';

            return res.status(200).json({
                success: true,
                data: detection[0],
                isFlagged,
                status: isFlagged ? 'flagged' : 'clean',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error("❌ FRAUD STATUS ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch fraud status"
            });
        }
    }
);

// ======================== ROUTE FALLBACK ========================

/**
 * 404 - Route not found
 */
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Auth route not found",
        path: req.path,
        method: req.method
    });
});

// ======================== EXPORTS ========================

module.exports = router;