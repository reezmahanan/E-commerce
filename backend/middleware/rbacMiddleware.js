/**
 * Role-Based Access Control (RBAC) Middleware
 * Validates if the authenticated user has the required role(s) to access a route.
 * Includes security checks: user existence, account status, email verification, and logging.
 */

const { User } = require("../models");
const logger = require("../utils/logger");

// =====================
// ERROR CODES
// =====================
const ERROR_CODES = {
    USER_NOT_FOUND: "ADMIN_USER_NOT_FOUND",
    ACCOUNT_INACTIVE: "ADMIN_ACCOUNT_INACTIVE",
    ACCOUNT_BLOCKED: "ADMIN_ACCOUNT_BLOCKED",
    EMAIL_NOT_VERIFIED: "ADMIN_EMAIL_NOT_VERIFIED",
    ADMIN_ROLE_REQUIRED: "ADMIN_ROLE_REQUIRED",
    TOKEN_INVALID: "ADMIN_TOKEN_INVALID",
    UNAUTHORIZED: "ADMIN_UNAUTHORIZED"
};

// =====================
// MAIN RBAC MIDDLEWARE
// =====================
const authorizeRoles = (...roles) => {
    return async (req, res, next) => {
        try {
            // STEP 1: Check if user is authenticated
            if (!req.user || !req.user.id) {
                logger.warn("Access denied - Unauthenticated user", {
                    ip: req.ip,
                    path: req.path,
                    method: req.method,
                    userAgent: req.headers["user-agent"]
                });

                return res.status(401).json({
                    success: false,
                    errorCode: ERROR_CODES.TOKEN_INVALID,
                    message: "Authentication required. Please login again."
                });
            }

            // STEP 2: Verify user exists in database
            const user = await User.findByPk(req.user.id);

            if (!user) {
                logger.warn("Access denied - User not found in database", {
                    userId: req.user.id,
                    ip: req.ip,
                    path: req.path
                });

                return res.status(403).json({
                    success: false,
                    errorCode: ERROR_CODES.USER_NOT_FOUND,
                    message: "User account not found. Please contact support."
                });
            }

            // STEP 3: Check if account is blocked
            if (user.status === "blocked") {
                logger.warn("Access denied - Account blocked", {
                    userId: user.id,
                    email: user.email,
                    status: user.status,
                    ip: req.ip,
                    path: req.path
                });

                return res.status(403).json({
                    success: false,
                    errorCode: ERROR_CODES.ACCOUNT_BLOCKED,
                    message: "Your account has been blocked. Please contact support."
                });
            }

            // STEP 4: Check if account is inactive
            if (user.status === "inactive") {
                logger.warn("Access denied - Account inactive", {
                    userId: user.id,
                    email: user.email,
                    status: user.status,
                    ip: req.ip,
                    path: req.path
                });

                return res.status(403).json({
                    success: false,
                    errorCode: ERROR_CODES.ACCOUNT_INACTIVE,
                    message: "Your account is inactive. Please contact support."
                });
            }

            // STEP 5: Check if email is verified
            if (user.isEmailVerified === false) {
                logger.warn("Access denied - Email not verified", {
                    userId: user.id,
                    email: user.email,
                    ip: req.ip,
                    path: req.path
                });

                return res.status(403).json({
                    success: false,
                    errorCode: ERROR_CODES.EMAIL_NOT_VERIFIED,
                    message: "Please verify your email address before accessing this resource."
                });
            }

            // STEP 6: Check user role
            if (!roles.includes(user.role)) {
                logger.warn("Access denied - Insufficient role", {
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                    requiredRoles: roles,
                    ip: req.ip,
                    path: req.path,
                    method: req.method
                });

                return res.status(403).json({
                    success: false,
                    errorCode: ERROR_CODES.ADMIN_ROLE_REQUIRED,
                    message: `Access denied. Required roles: ${roles.join(", ")}`
                });
            }

            // STEP 7: Log successful access
            logger.info("Access granted", {
                userId: user.id,
                email: user.email,
                role: user.role,
                ip: req.ip,
                path: req.path,
                method: req.method
            });

            // Attach full user object to request
            req.user = user;
            next();

        } catch (error) {
            // STEP 8: Handle unexpected errors
            logger.error("RBAC middleware error:", {
                error: error.message,
                stack: error.stack,
                ip: req.ip,
                path: req.path
            });

            return res.status(500).json({
                success: false,
                errorCode: ERROR_CODES.UNAUTHORIZED,
                message: "An error occurred while verifying access. Please try again."
            });
        }
    };
};

// =====================
// ADMIN MIDDLEWARE (Backward compatibility)
// =====================
const adminMiddleware = authorizeRoles("admin", "superadmin");

// =====================
// EXPORTS
// =====================
module.exports = {
    authorizeRoles,
    adminMiddleware,
    ERROR_CODES
};