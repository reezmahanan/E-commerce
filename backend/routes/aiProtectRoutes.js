// backend/routes/aiProtectedRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { promptInjectionGuard } = require('../services/promptInjectionDetector');

// Apply both middlewares
router.use(authMiddleware);
router.use(promptInjectionGuard);

// Your protected AI routes here
router.post('/chat', async (req, res) => {
    // Your chat handler
});

module.exports = router;