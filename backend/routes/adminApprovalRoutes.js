const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../config/db').promise;
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { sanitizeString } = require('../utils/helpers');

const approvalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: {
        success: false,
        error: 'Too many approval requests. Please try again later.'
    }
});

function validateDecisionInput(body) {
    const errors = [];

    if (!body.action || !['approve', 'reject'].includes(body.action)) {
        errors.push('Invalid action. Must be "approve" or "reject"');
    }

    if (body.notes && typeof body.notes !== 'string') {
        errors.push('Notes must be a string');
    }

    if (body.notes && body.notes.length > 500) {
        errors.push('Notes cannot exceed 500 characters');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

function sanitizeInput(body) {
    return {
        action: body.action,
        notes: body.notes ? sanitizeString(body.notes.trim()) : null
    };
}

function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

function parseFilters(query) {
    const filters = {};
    if (query.status && ['pending', 'approved', 'rejected'].includes(query.status)) {
        filters.status = query.status;
    }
    if (query.action_type) {
        filters.action_type = query.action_type;
    }
    if (query.user_id) {
        filters.user_id = query.user_id;
    }
    if (query.search) {
        filters.search = sanitizeString(query.search.trim());
    }
    return filters;
}

// ============================================
// GET PENDING APPROVAL REQUESTS
// ============================================

router.get('/approvals/pending', authMiddleware, approvalLimiter, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            logger.warn(`Unauthorized approval access attempt by user ${req.user.id}`);
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const { limit, offset } = parsePagination(req.query);
        const filters = parseFilters(req.query);

        let query = `
            SELECT a.*, u.name as user_name, u.email as user_email
            FROM admin_approval_requests a
            JOIN users u ON a.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status) {
            query += ` AND a.status = ?`;
            params.push(filters.status);
        }

        if (filters.action_type) {
            query += ` AND a.action_type = ?`;
            params.push(filters.action_type);
        }

        if (filters.user_id) {
            query += ` AND a.user_id = ?`;
            params.push(filters.user_id);
        }

        if (filters.search) {
            query += ` AND (u.name LIKE ? OR u.email LIKE ? OR a.proposed_action LIKE ?)`;
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM (${query}) as subquery`,
            params
        );

        query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [requests] = await db.query(query, params);

        logger.info(`Admin ${req.user.id} fetched ${requests.length} approval requests`);

        res.json({
            success: true,
            data: requests,
            pagination: {
                page: Math.floor(offset / limit) + 1,
                limit,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        logger.error('Error fetching approvals:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch approvals'
        });
    }
});

// ============================================
// GET SINGLE APPROVAL REQUEST
// ============================================

router.get('/approvals/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid approval ID'
            });
        }

        const [requests] = await db.query(
            `
            SELECT a.*, u.name as user_name, u.email as user_email
            FROM admin_approval_requests a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = ?
            `,
            [id]
        );

        if (requests.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Approval request not found'
            });
        }

        res.json({
            success: true,
            data: requests[0]
        });

    } catch (error) {
        logger.error('Error fetching approval:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch approval'
        });
    }
});

// ============================================
// APPROVE OR REJECT DISCOUNT
// ============================================

router.post('/approvals/:id/decide', authMiddleware, approvalLimiter, async (req, res) => {
    const connection = await db.getConnection();

    try {
        if (req.user.role !== 'admin') {
            logger.warn(`Unauthorized decision attempt by user ${req.user.id}`);
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid approval ID'
            });
        }

        const validation = validateDecisionInput(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                errors: validation.errors
            });
        }

        const sanitized = sanitizeInput(req.body);

        await connection.beginTransaction();

        const [result] = await connection.query(
            `UPDATE admin_approval_requests 
             SET status = ?, admin_id = ?, admin_notes = ?, updated_at = NOW()
             WHERE id = ? AND status = 'pending'`,
            [
                sanitized.action === 'approve' ? 'approved' : 'rejected',
                req.user.id,
                sanitized.notes,
                id
            ]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Approval request not found or already processed'
            });
        }

        const [request] = await connection.query(
            `SELECT * FROM admin_approval_requests WHERE id = ?`,
            [id]
        );

        if (sanitized.action === 'approve') {
            logger.info(`Admin ${req.user.id} approved request ${id}`);
            
            try {
                const proposedAction = JSON.parse(request[0].proposed_action);
                const orderId = proposedAction.order_id;

                if (orderId) {
                    await connection.query(
                        `UPDATE orders SET status = 'processing', approved_by = ? WHERE id = ?`,
                        [req.user.id, orderId]
                    );

                    await connection.query(
                        `INSERT INTO order_approvals (order_id, approved_by, approved_at)
                         VALUES (?, ?, NOW())`,
                        [orderId, req.user.id]
                    );
                }
            } catch (parseError) {
                logger.error('Error processing approved action:', parseError);
            }

        } else {
            logger.warn(`Admin ${req.user.id} rejected request ${id}`);
            
            try {
                const proposedAction = JSON.parse(request[0].proposed_action);
                const orderId = proposedAction.order_id;

                if (orderId) {
                    await connection.query(
                        `UPDATE orders SET status = 'cancelled', rejected_by = ?, rejection_reason = ?
                         WHERE id = ?`,
                        [req.user.id, sanitized.notes || 'Rejected by admin', orderId]
                    );
                }
            } catch (parseError) {
                logger.error('Error processing rejected action:', parseError);
            }
        }

        await connection.commit();

        return res.json({
            success: true,
            message: `Request ${sanitized.action}d successfully`
        });

    } catch (error) {
        await connection.rollback();
        logger.error('Error updating approval:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update approval'
        });
    } finally {
        connection.release();
    }
});

// ============================================
// BULK APPROVE/REJECT REQUESTS
// ============================================

router.post('/approvals/bulk', authMiddleware, async (req, res) => {
    const connection = await db.getConnection();

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const { ids, action, notes } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request IDs array is required'
            });
        }

        if (ids.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 50 requests can be processed at once'
            });
        }

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid action'
            });
        }

        await connection.beginTransaction();

        const placeholders = ids.map(() => '?').join(',');
        const params = [action === 'approve' ? 'approved' : 'rejected', req.user.id, notes || null, ...ids];

        const [result] = await connection.query(
            `UPDATE admin_approval_requests 
             SET status = ?, admin_id = ?, admin_notes = ?, updated_at = NOW()
             WHERE id IN (${placeholders}) AND status = 'pending'`,
            params
        );

        await connection.commit();

        logger.info(`Admin ${req.user.id} bulk ${action}d ${result.affectedRows} requests`);

        res.json({
            success: true,
            message: `Successfully ${action}d ${result.affectedRows} requests`,
            processed: result.affectedRows
        });

    } catch (error) {
        await connection.rollback();
        logger.error('Error in bulk approval:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process bulk request'
        });
    } finally {
        connection.release();
    }
});

// ============================================
// GET APPROVAL STATISTICS
// ============================================

router.get('/approvals/stats', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                ROUND((SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) as approval_rate
            FROM admin_approval_requests
        `);

        res.json({
            success: true,
            data: stats[0] || { total: 0, pending: 0, approved: 0, rejected: 0, approval_rate: 0 }
        });

    } catch (error) {
        logger.error('Error fetching approval stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

module.exports = router;