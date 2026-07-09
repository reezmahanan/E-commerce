// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const cookieOptions = require("../config/cookieOptions");
// ======================== CONTROLLERS ========================
const {
    signup,
    verifySignup,
    login,
    forgotPassword,
    resetPassword,
    refreshAccessToken,
    getMe,
    getStatus,
    logout,
    validateToken,
    changePassword,
    getSecurityAudit,
    getFraudStatus
} = require("../controllers/authController");
// ======================== MIDDLEWARE ========================
const authMiddleware = require("../middleware/authMiddleware");
const { 
    signupLimiter, 
    loginLimiter, 
    forgotPasswordLimiter, 
    refreshTokenLimiter 
} = require("../middleware/rateLimiter");
const { applyCaptchaCheck } = require("../middleware/captchaMiddleware");
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


// ======================== ROUTES ========================

/**
 * GET /api/auth/status
 * Check auth API status
 */
router.get("/status", getStatus);

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
        const { name, email, password, confirmPassword, age } = req.body;

        // Validate all required fields
        const validationError = validateRequiredFields(req, res, ['name', 'email', 'password', 'confirmPassword']);
        if (validationError) return validationError;

        // Additional validations
        if (name.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Name must be at least 2 characters long"
            });
        }

        const passwordCheck = validatePassword(password);
        if (!passwordCheck.isValid) {
            return res.status(400).json({
                success: false,
                message: passwordCheck.message
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }

        // Email format validation
        if (!isValidEmail(email)) {
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
        if (!isValidOTP(otp)) {
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
        if (!isValidEmail(email)) {
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
        if (!isValidEmail(email)) {
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
        // OTP should be 6 digits
        if (!isValidOTP(otp)) {
            return res.status(400).json({
                success: false,
                message: "OTP must be 6 digits"
            });
        }

        // Password should be strong enough
        const passwordCheck = validatePassword(newPassword);
        if (!passwordCheck.isValid) {
            return res.status(400).json({
                success: false,
                message: passwordCheck.message
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
   logout
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
    validateToken
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

            const passwordCheck = validatePassword(newPassword);
            if (!passwordCheck.isValid) {
                return res.status(400).json({
                    success: false,
                    message: passwordCheck.message
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
   getSecurityAudit
);

/**
 * GET /api/auth/fraud-status
 * Get fraud detection status for current user (authenticated)
 */
router.get(
    "/fraud-status",
    authMiddleware,
    getFraudStatus
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