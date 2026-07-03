// backend/services/chat.service.js

const db = require("../config/db");
const logger = require("../utils/logger");
const { safeArray, safeNumber, sanitizeString } = require("../utils/helpers");

// ==================== CONVERSATION MANAGEMENT ====================
const findOrCreateConversation = async (customerId) => {
    try {
        // Check if open or pending conversation exists
        const [existing] = await db.query(
            `SELECT * FROM chat_conversations WHERE customer_id = ? AND status IN ('open', 'pending') LIMIT 1`,
            [customerId]
        );

        if (existing.length > 0) return existing[0];

        // Create new
        const [result] = await db.query(
            `INSERT INTO chat_conversations (customer_id, status, created_at, updated_at) VALUES (?, 'open', NOW(), NOW())`,
            [customerId]
        );

        const [newConv] = await db.query(`SELECT * FROM chat_conversations WHERE id = ?`, [result.insertId]);
        logger.info(`New conversation created: ${result.insertId} for customer ${customerId}`);
        return newConv[0];
    } catch (error) {
        logger.error(`FindOrCreate conversation error: ${error.message}`);
        throw error;
    }
};

const getConversationList = async (filters, page = 1, limit = 20) => {
    try {
        const offset = (page - 1) * limit;
        let query = `
            SELECT c.*, u.name as customer_name, u.email as customer_email,
            (SELECT message FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
            (SELECT created_at FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_activity,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id AND m.is_read = 0 AND m.sender_type = 'customer') as unread_count
            FROM chat_conversations c
            JOIN users u ON c.customer_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status) {
            query += ` AND c.status = ?`;
            params.push(filters.status);
        }

        if (filters.assigned_to) {
            if (filters.assigned_to === 'unassigned') {
                query += ` AND c.assigned_admin_id IS NULL`;
            } else {
                query += ` AND c.assigned_admin_id = ?`;
                params.push(filters.assigned_to);
            }
        }

        if (filters.search) {
            query += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        // Get total count
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM (${query}) as t`, params);
        const total = countResult[0]?.total || 0;

        // Apply sorting and pagination
        query += ` ORDER BY last_activity DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [conversations] = await db.query(query, params);

        return {
            conversations: safeArray(conversations),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    } catch (error) {
        logger.error(`Get conversation list error: ${error.message}`);
        throw error;
    }
};

const getConversationMessages = async (conversationId, limit = 50, offset = 0) => {
    try {
        const [messages] = await db.query(
            `SELECT m.*, u.name as sender_name, u.role as sender_role
             FROM chat_messages m 
             JOIN users u ON m.sender_id = u.id 
             WHERE m.conversation_id = ? 
             ORDER BY m.created_at DESC
             LIMIT ? OFFSET ?`,
            [conversationId, limit, offset]
        );

        // Get total count
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM chat_messages WHERE conversation_id = ?`,
            [conversationId]
        );

        return {
            messages: safeArray(messages).reverse(),
            total: countResult[0]?.total || 0,
            limit,
            offset
        };
    } catch (error) {
        logger.error(`Get conversation messages error: ${error.message}`);
        throw error;
    }
};

// ==================== MESSAGE MANAGEMENT ====================
const saveMessage = async (conversationId, senderId, senderType, message) => {
    try {
        const [result] = await db.query(
            `INSERT INTO chat_messages (conversation_id, sender_id, sender_type, message, is_read, created_at)
             VALUES (?, ?, ?, ?, 0, NOW())`,
            [conversationId, senderId, senderType, message]
        );

        // Update conversation updated_at
        await db.query(
            `UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [conversationId]
        );

        const [newMsg] = await db.query(
            `SELECT m.*, u.name as sender_name, u.role as sender_role 
             FROM chat_messages m 
             JOIN users u ON m.sender_id = u.id 
             WHERE m.id = ?`,
            [result.insertId]
        );
        
        logger.info(`Message saved: ${result.insertId} in conversation ${conversationId}`);
        return newMsg[0];
    } catch (error) {
        logger.error(`Save message error: ${error.message}`);
        throw error;
    }
};

const getMessage = async (messageId) => {
    try {
        const [messages] = await db.query(
            `SELECT * FROM chat_messages WHERE id = ?`,
            [messageId]
        );
        return messages[0] || null;
    } catch (error) {
        logger.error(`Get message error: ${error.message}`);
        throw error;
    }
};

const updateMessage = async (messageId, newMessage) => {
    try {
        await db.query(
            `UPDATE chat_messages SET message = ?, is_edited = 1, updated_at = NOW() WHERE id = ?`,
            [newMessage, messageId]
        );
        logger.info(`Message ${messageId} updated`);
    } catch (error) {
        logger.error(`Update message error: ${error.message}`);
        throw error;
    }
};

const deleteMessage = async (messageId) => {
    try {
        await db.query(
            `UPDATE chat_messages SET is_deleted = 1, deleted_at = NOW() WHERE id = ?`,
            [messageId]
        );
        logger.info(`Message ${messageId} deleted`);
    } catch (error) {
        logger.error(`Delete message error: ${error.message}`);
        throw error;
    }
};

const markMessageAsRead = async (messageId, userId) => {
    try {
        await db.query(
            `INSERT INTO message_reads (message_id, user_id, read_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE read_at = NOW()`,
            [messageId, userId]
        );
    } catch (error) {
        logger.error(`Mark message read error: ${error.message}`);
        throw error;
    }
};

const getUnreadCount = async (userId, conversationId = null) => {
    try {
        let query = `
            SELECT COUNT(*) as unread_count
            FROM chat_messages m
            LEFT JOIN message_reads r ON m.id = r.message_id AND r.user_id = ?
            WHERE r.id IS NULL
            AND m.sender_id != ?
        `;

        const params = [userId, userId];

        if (conversationId) {
            query += ` AND m.conversation_id = ?`;
            params.push(conversationId);
        }

        const [results] = await db.query(query, params);
        return results[0]?.unread_count || 0;
    } catch (error) {
        logger.error(`Get unread count error: ${error.message}`);
        throw error;
    }
};

// ==================== CONVERSATION MANAGEMENT ====================
const updateConversationStatus = async (conversationId, status) => {
    try {
        let query = `UPDATE chat_conversations SET status = ?`;
        const params = [status];

        if (status === "closed") {
            query += `, closed_at = CURRENT_TIMESTAMP`;
        } else {
            query += `, closed_at = NULL`;
        }

        query += `, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        params.push(conversationId);

        const [result] = await db.query(query, params);

        if (result.affectedRows === 0) {
            throw new Error("Conversation not found");
        }
        logger.info(`Conversation ${conversationId} status updated to ${status}`);
    } catch (error) {
        logger.error(`Update conversation status error: ${error.message}`);
        throw error;
    }
};

const assignConversation = async (conversationId, adminId) => {
    try {
        const [result] = await db.query(
            `UPDATE chat_conversations
             SET assigned_admin_id = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [adminId, conversationId]
        );

        if (result.affectedRows === 0) {
            throw new Error("Conversation not found");
        }
        logger.info(`Conversation ${conversationId} assigned to admin ${adminId}`);
    } catch (error) {
        logger.error(`Assign conversation error: ${error.message}`);
        throw error;
    }
};

const verifyConversationAccess = async (conversationId, userId, role) => {
    try {
        const [conv] = await db.query(`SELECT * FROM chat_conversations WHERE id = ?`, [conversationId]);
        if (!conv.length) return false;

        if (role === 'admin') return true;
        return conv[0].customer_id === userId;
    } catch (error) {
        logger.error(`Verify conversation access error: ${error.message}`);
        return false;
    }
};

// ==================== DASHBOARD STATS ====================
const getDashboardStats = async () => {
    try {
        const [totalConvs] = await db.query(`SELECT COUNT(*) as total FROM chat_conversations`);
        const [openConvs] = await db.query(`SELECT COUNT(*) as open FROM chat_conversations WHERE status = 'open'`);
        const [pendingConvs] = await db.query(`SELECT COUNT(*) as pending FROM chat_conversations WHERE status = 'pending'`);
        const [closedConvs] = await db.query(`SELECT COUNT(*) as closed FROM chat_conversations WHERE status = 'closed'`);
        const [unassigned] = await db.query(`SELECT COUNT(*) as unassigned FROM chat_conversations WHERE assigned_admin_id IS NULL AND status != 'closed'`);
        
        return {
            total: totalConvs[0]?.total || 0,
            open: openConvs[0]?.open || 0,
            pending: pendingConvs[0]?.pending || 0,
            closed: closedConvs[0]?.closed || 0,
            unassigned: unassigned[0]?.unassigned || 0
        };
    } catch (error) {
        logger.error(`Get dashboard stats error: ${error.message}`);
        throw error;
    }
};

module.exports = {
    findOrCreateConversation,
    getConversationList,
    getConversationMessages,
    saveMessage,
    getMessage,
    updateMessage,
    deleteMessage,
    markMessageAsRead,
    getUnreadCount,
    updateConversationStatus,
    assignConversation,
    verifyConversationAccess,
    getDashboardStats
};