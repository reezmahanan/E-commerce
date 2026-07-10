// backend/controllers/adminApprovalController.js
const db = require('../config/db').promise;

/**
 * Get pending approval requests (Admin only)
 */
exports.getPendingApprovals = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const [requests] = await db.query(`
            SELECT a.*, u.name as user_name, u.email as user_email
            FROM admin_approval_requests a
            JOIN users u ON a.user_id = u.id
            WHERE a.status = 'pending'
            ORDER BY a.created_at DESC
        `);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch approvals'
    });
  }
};

/**
 * Approve or reject discount (Admin only)
 */
exports.decideApproval = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { id } = req.params;
    const { action, notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }

    const [result] = await db.query(
      `UPDATE admin_approval_requests 
             SET status = ?, admin_id = ?, admin_notes = ?
             WHERE id = ?`,
      [action === 'approve' ? 'approved' : 'rejected', req.user.id, notes, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Approval request not found'
      });
    }

    // If approved, proceed with order
    if (action === 'approve') {
      // Process the order with approved discount
      // ... order processing logic
    }

    return res.json({
      success: true,
      message: `Request ${action}d successfully`
    });
  } catch (error) {
    console.error('Error updating approval:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update approval'
    });
  }
};