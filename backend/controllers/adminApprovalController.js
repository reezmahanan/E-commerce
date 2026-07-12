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

   
    if (!id || !/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid approval request identifier. It must be a positive integer.'
      });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }

    
    const MAX_NOTE_LENGTH = 500;
    let sanitizedNotes = null;

    // Notes are optional, only validate if provided
    if (notes !== undefined && notes !== null) {
      // 1. Must be a string
      if (typeof notes !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Admin notes must be a string if provided.'
        });
      }

      // 2. Trim whitespace
      const trimmedNotes = notes.trim();

      // 3. Reject empty or whitespace-only strings
      if (trimmedNotes.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Admin notes cannot be empty or contain only whitespace.'
        });
      }

      // 4. Enforce maximum length
      if (trimmedNotes.length > MAX_NOTE_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `Admin notes cannot exceed ${MAX_NOTE_LENGTH} characters.`
        });
      }

      sanitizedNotes = trimmedNotes;
    }
    
    const [existingRequest] = await db.query(
      `SELECT status FROM admin_approval_requests WHERE id = ?`,
      [id]
    );

    if (existingRequest.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Approval request not found'
      });
    }

    if (existingRequest[0].status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: `Request already ${existingRequest[0].status}. Cannot re-process an already decided request.`
      });
    }
    // ==========================================

    // Atomic database update with status check
    const [result] = await db.query(
      `UPDATE admin_approval_requests 
             SET status = ?, admin_id = ?, admin_notes = ?
             WHERE id = ? AND status = 'pending'`,
      [action === 'approve' ? 'approved' : 'rejected', req.user.id, sanitizedNotes, id]
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        error: 'Request status was modified by another admin. Please refresh and try again.'
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