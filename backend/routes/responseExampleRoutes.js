// backend/routes/responseExampleRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    sendSuccess,
    sendError,
    sendCreated,
    sendPaginated,
    sendValidationError,
    sendNotFound,
    sendServerError
} = require('../middleware/responseStandardizer');

/**
 * GET /api/response-example/success
 * Example success response
 */
router.get('/success', (req, res) => {
    sendSuccess(res, {
        id: 1,
        name: 'Example Product',
        price: 99.99
    }, 'Product retrieved successfully');
});

/**
 * GET /api/response-example/error
 * Example error response
 */
router.get('/error', (req, res) => {
    sendError(res, 'Invalid request parameter', 400, [
        { field: 'id', message: 'ID must be a valid number' }
    ]);
});

/**
 * POST /api/response-example/create
 * Example created response
 */
router.post('/create', (req, res) => {
    sendCreated(res, {
        id: 123,
        name: 'New Product',
        price: 49.99
    }, 'Product created successfully');
});

/**
 * GET /api/response-example/paginated
 * Example paginated response
 */
router.get('/paginated', (req, res) => {
    const data = [
        { id: 1, name: 'Product 1' },
        { id: 2, name: 'Product 2' },
        { id: 3, name: 'Product 3' }
    ];

    sendPaginated(res, data, {
        page: 1,
        limit: 10,
        total: 25,
        pages: 3
    }, 'Products retrieved successfully');
});

/**
 * GET /api/response-example/validation-error
 * Example validation error
 */
router.get('/validation-error', (req, res) => {
    sendValidationError(res, [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password must be at least 6 characters' }
    ], 'Validation failed');
});

/**
 * GET /api/response-example/not-found
 * Example not found response
 */
router.get('/not-found', (req, res) => {
    sendNotFound(res, 'Product not found');
});

/**
 * GET /api/response-example/server-error
 * Example server error
 */
router.get('/server-error', (req, res) => {
    sendServerError(res, 'Database connection failed', [
        { code: 'DB_CONNECTION_ERROR', message: 'Unable to connect to database' }
    ]);
});

/**
 * GET /api/response-example/standardized
 * Example of already standardized response
 */
router.get('/standardized', (req, res) => {
    res.json({
        success: true,
        message: 'This is already standardized',
        data: { test: 'data' }
    });
});

/**
 * GET /api/response-example/unstandardized
 * Example of unstandardized response (will be wrapped)
 */
router.get('/unstandardized', (req, res) => {
    res.json({
        id: 1,
        name: 'Unstandardized Response',
        price: 29.99
    });
});

module.exports = router;