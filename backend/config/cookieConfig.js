// backend/config/cookieConfig.js

/**
 * ============================================
 * COOKIE CONFIGURATION
 * ============================================
 * Shared cookie configuration to ensure consistent
 * creation, security, and environment-specific settings.
 */

// Get environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isStaging = NODE_ENV === 'staging';
const isDevelopment = NODE_ENV === 'development';

// Environment-specific configurations
const ENV_CONFIGS = {
    development: {
        secure: false,
        sameSite: 'lax',
        domain: undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        path: '/',
        partitioned: false,
    },
    staging: {
        secure: true,
        sameSite: 'lax',
        domain: '.staging.example.com',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        path: '/',
        partitioned: false,
    },
    production: {
        secure: true,
        sameSite: 'strict',
        domain: '.example.com',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        path: '/',
        partitioned: false,
    }
};

/**
 * Cookie configuration object
 * Supports environment-specific settings with fallbacks
 */
const cookieConfig = {
    // HTTP-Only flag (prevents XSS attacks)
    httpOnly: process.env.COOKIE_HTTP_ONLY !== 'false',
    
    // Secure flag (only send over HTTPS)
    secure: process.env.COOKIE_SECURE !== undefined 
        ? process.env.COOKIE_SECURE === 'true' 
        : (isProduction || isStaging),
    
    // SameSite policy (CSRF protection)
    sameSite: process.env.COOKIE_SAME_SITE || 
        (isProduction ? 'strict' : 'lax'),
    
    // Domain configuration
    domain: process.env.COOKIE_DOMAIN || 
        (isProduction ? '.example.com' : 
         isStaging ? '.staging.example.com' : 
         undefined),
    
    // Cookie path
    path: process.env.COOKIE_PATH || '/',
    
    // Max age in milliseconds
    maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 
        (isProduction ? 30 * 24 * 60 * 60 * 1000 : // 30 days
         7 * 24 * 60 * 60 * 1000), // 7 days default
    
    // Expires (alternative to maxAge)
    expires: process.env.COOKIE_EXPIRES ? new Date(process.env.COOKIE_EXPIRES) : undefined,
    
    // Partitioned (for CHIPS - Chrome's partitioned cookies)
    partitioned: process.env.COOKIE_PARTITIONED === 'true',
    
    // Priority (low, medium, high)
    priority: process.env.COOKIE_PRIORITY || 'medium',
};

/**
 * Cookie names configuration
 * Centralized cookie names for consistency
 */
const cookieNames = {
    // Session cookies
    session: process.env.COOKIE_SESSION_NAME || 'session',
    refreshToken: process.env.COOKIE_REFRESH_NAME || 'refresh_token',
    
    // Auth cookies
    accessToken: process.env.COOKIE_ACCESS_NAME || 'access_token',
    auth: process.env.COOKIE_AUTH_NAME || 'auth_token',
    
    // User preferences
    preferences: process.env.COOKIE_PREFERENCES_NAME || 'preferences',
    theme: process.env.COOKIE_THEME_NAME || 'theme',
    language: process.env.COOKIE_LANGUAGE_NAME || 'language',
    
    // Security cookies
    csrf: process.env.COOKIE_CSRF_NAME || 'csrf_token',
    xsrftoken: process.env.COOKIE_XSRF_NAME || 'XSRF-TOKEN',
    
    // Analytics
    analytics: process.env.COOKIE_ANALYTICS_NAME || 'analytics',
    tracking: process.env.COOKIE_TRACKING_NAME || 'tracking_id',
};

/**
 * Environment-specific cookie options
 */
const getEnvCookieOptions = () => {
    const env = process.env.COOKIE_ENV || NODE_ENV;
    return ENV_CONFIGS[env] || ENV_CONFIGS.development;
};

/**
 * Merge custom options with environment defaults
 * @param {Object} customOptions - Custom cookie options
 * @returns {Object} - Merged cookie options
 */
const getCookieOptions = (customOptions = {}) => {
    const envOptions = getEnvCookieOptions();
    
    // Start with environment options
    let options = { ...envOptions };
    
    // Override with custom options
    options = { ...options, ...customOptions };
    
    // Remove undefined values
    Object.keys(options).forEach(key => {
        if (options[key] === undefined) {
            delete options[key];
        }
    });
    
    return options;
};

/**
 * Get cookie options for session
 * @param {Object} customOptions - Custom session options
 * @returns {Object} - Session cookie options
 */
const getSessionCookieOptions = (customOptions = {}) => {
    const envOptions = getEnvCookieOptions();
    
    return {
        ...envOptions,
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        ...customOptions,
    };
};

/**
 * Get cookie options for refresh token
 * @param {Object} customOptions - Custom refresh token options
 * @returns {Object} - Refresh token cookie options
 */
const getRefreshTokenOptions = (customOptions = {}) => {
    const envOptions = getEnvCookieOptions();
    
    return {
        ...envOptions,
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/api/auth/refresh',
        ...customOptions,
    };
};

/**
 * Get cookie options for access token
 * @param {Object} customOptions - Custom access token options
 * @returns {Object} - Access token cookie options
 */
const getAccessTokenOptions = (customOptions = {}) => {
    const envOptions = getEnvCookieOptions();
    
    return {
        ...envOptions,
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
        ...customOptions,
    };
};

/**
 * Get cookie options for preferences (non-sensitive)
 * @param {Object} customOptions - Custom preferences options
 * @returns {Object} - Preferences cookie options
 */
const getPreferencesOptions = (customOptions = {}) => {
    const envOptions = getEnvCookieOptions();
    
    return {
        ...envOptions,
        httpOnly: false, // Client-side accessible
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        ...customOptions,
    };
};

/**
 * Get cookie options for CSRF token
 * @param {Object} customOptions - Custom CSRF options
 * @returns {Object} - CSRF cookie options
 */
const getCsrfTokenOptions = (customOptions = {}) => {
    const envOptions = getEnvCookieOptions();
    
    return {
        ...envOptions,
        httpOnly: false, // Client needs to read this
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        ...customOptions,
    };
};

/**
 * Clear cookie options (for logout)
 * @param {string} path - Cookie path
 * @returns {Object} - Clear cookie options
 */
const getClearCookieOptions = (path = '/') => {
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: path,
        maxAge: 0, // Expire immediately
    };
};

/**
 * Validate cookie configuration
 * @returns {Object} - Validation result
 */
const validateCookieConfig = () => {
    const errors = [];
    const warnings = [];
    
    // Check secure flag in production
    if (isProduction && !cookieConfig.secure) {
        errors.push('Secure flag must be true in production');
    }
    
    // Check domain configuration
    if (isProduction && !cookieConfig.domain) {
        warnings.push('Domain should be set in production');
    }
    
    // Check SameSite policy
    if (!['strict', 'lax', 'none'].includes(cookieConfig.sameSite)) {
        errors.push(`Invalid SameSite value: ${cookieConfig.sameSite}`);
    }
    
    // Check maxAge
    if (cookieConfig.maxAge && cookieConfig.maxAge < 0) {
        errors.push('maxAge must be positive');
    }
    
    // Check priority
    if (cookieConfig.priority && !['low', 'medium', 'high'].includes(cookieConfig.priority)) {
        warnings.push(`Invalid priority value: ${cookieConfig.priority}`);
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        environment: NODE_ENV,
        isProduction,
    };
};

/**
 * Log cookie configuration (for debugging)
 */
const logCookieConfig = () => {
    const validation = validateCookieConfig();
    
    console.log('========== COOKIE CONFIGURATION ==========');
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Production: ${isProduction}`);
    console.log(`Secure: ${cookieConfig.secure}`);
    console.log(`SameSite: ${cookieConfig.sameSite}`);
    console.log(`Domain: ${cookieConfig.domain || 'Not set'}`);
    console.log(`MaxAge: ${cookieConfig.maxAge}ms`);
    console.log(`Validation: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
    
    if (validation.warnings.length > 0) {
        console.log('⚠️ Warnings:');
        validation.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    if (validation.errors.length > 0) {
        console.log('❌ Errors:');
        validation.errors.forEach(e => console.log(`  - ${e}`));
    }
    console.log('==========================================');
};

// Run validation in development
if (isDevelopment) {
    logCookieConfig();
}

// Export configurations
module.exports = {
    // Main configuration
    cookieConfig,
    
    // Cookie names
    cookieNames,
    
    // Environment options
    getEnvCookieOptions,
    getCookieOptions,
    
    // Specific options by cookie type
    getSessionCookieOptions,
    getRefreshTokenOptions,
    getAccessTokenOptions,
    getPreferencesOptions,
    getCsrfTokenOptions,
    
    // Utility functions
    getClearCookieOptions,
    validateCookieConfig,
    logCookieConfig,
    
    // Environment helpers
    isProduction,
    isStaging,
    isDevelopment,
    NODE_ENV,
};