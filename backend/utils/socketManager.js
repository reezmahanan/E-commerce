// backend/utils/socketManager.js

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const chatService = require("../services/chat.service");
const logger = require("./logger");
const { sanitizeString } = require("./helpers");

let io;
const userSockets = new Map(); // userId -> socketId
const socketUsers = new Map(); // socketId -> userId
const typingUsers = new Map(); // roomId -> { userId, timeout }
const messageRateLimit = new Map(); // socketId -> { count, timestamp }
const activeRooms = new Map(); // roomId -> Set of socketIds
const userStatus = new Map(); // userId -> { status, lastSeen }

const RATE_LIMIT = 10; // messages per minute
const RATE_WINDOW = 60000; // 1 minute
const TYPING_TIMEOUT = 5000; // 5 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

const initSocket = (server, allowedOrigins) => {
    io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // ==================== MIDDLEWARE ====================
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            logger.warn("Socket connection attempt without token");
            return next(new Error("Authentication error"));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            socket.user = decoded;
            socket.userId = decoded.id;
            next();
        } catch (err) {
            logger.error(`Socket auth error: ${err.message}`);
            next(new Error("Authentication error"));
        }
    });

    // ==================== CONNECTION HANDLER ====================
    io.on("connection", (socket) => {
        const userId = socket.userId;
        const userRole = socket.user.role;
        
        logger.info(`User connected: ${userId} (${userRole}) - Socket: ${socket.id}`);

        // Store user connection
        userSockets.set(userId, socket.id);
        socketUsers.set(socket.id, userId);
        userStatus.set(userId, { status: 'online', lastSeen: new Date() });

        // Broadcast online status
        io.emit('user_status_change', { userId, status: 'online' });
        io.emit('users_online', userSockets.size);

        // Setup event handlers
        setupEventHandlers(socket);

        // Setup heartbeat
        setupHeartbeat(socket);

        // ==================== DISCONNECT HANDLER ====================
        socket.on("disconnect", () => {
            handleDisconnect(socket);
        });
    });

    return io;
};

// ==================== EVENT HANDLERS ====================
function setupEventHandlers(socket) {
    const userId = socket.userId;
    const userRole = socket.user.role;

    // Join conversation
    socket.on("join_conversation", async (data, callback) => {
        try {
            let conversationId = data?.conversationId;
            
            // If customer joins without ID, find or create their default convo
            if (userRole === 'customer' && !conversationId) {
                const conv = await chatService.findOrCreateConversation(userId);
                conversationId = conv.id;
            }

            if (!conversationId) {
                if (callback) callback({ success: false, message: "No conversation ID" });
                return;
            }

            // Verify access
            const hasAccess = await chatService.verifyConversationAccess(conversationId, userId, userRole);
            if (!hasAccess) {
                if (callback) callback({ success: false, message: "Unauthorized access to conversation" });
                return;
            }

            // Leave previous rooms
            for (const [room, sockets] of activeRooms) {
                if (sockets.has(socket.id)) {
                    sockets.delete(socket.id);
                    if (sockets.size === 0) {
                        activeRooms.delete(room);
                    }
                }
            }

            // Join new room
            socket.join(`conversation:${conversationId}`);
            if (!activeRooms.has(`conversation:${conversationId}`)) {
                activeRooms.set(`conversation:${conversationId}`, new Set());
            }
            activeRooms.get(`conversation:${conversationId}`).add(socket.id);

            socket.currentRoom = `conversation:${conversationId}`;
            
            logger.info(`User ${userId} joined conversation:${conversationId}`);
            
            // Send room participants
            const participants = Array.from(activeRooms.get(`conversation:${conversationId}`))
                .map(sId => socketUsers.get(sId))
                .filter(id => id);
            
            io.to(`conversation:${conversationId}`).emit('room_participants', participants);
            
            if (callback) callback({ success: true, conversationId });
        } catch (err) {
            logger.error(`Socket Join Error: ${err.message}`);
            if (callback) callback({ success: false, message: "Server error" });
        }
    });

    // Send message with rate limiting
    socket.on("send_message", async (data, callback) => {
        try {
            // Rate limiting check
            if (!checkRateLimit(socket.id)) {
                socket.emit('error', { 
                    message: 'Rate limit exceeded. Please wait before sending more messages.' 
                });
                if (callback) callback({ success: false, message: "Rate limit exceeded" });
                return;
            }

            const { conversationId, message } = data;
            if (!conversationId || !message?.trim()) {
                if (callback) callback({ success: false, message: "Invalid message" });
                return;
            }

            // Sanitize message
            const sanitizedMessage = sanitizeString(message.trim());

            // Check access
            const hasAccess = await chatService.verifyConversationAccess(conversationId, userId, userRole);
            if (!hasAccess) {
                if (callback) callback({ success: false, message: "Unauthorized" });
                return;
            }

            const senderType = userRole === 'admin' ? 'admin' : 'customer';
            const savedMessage = await chatService.saveMessage(conversationId, userId, senderType, sanitizedMessage);

            // Broadcast to everyone in the room including sender
            io.to(`conversation:${conversationId}`).emit("message_received", savedMessage);
            
            // Notify admins about new message (for dashboard updates)
            io.to('admin_room').emit("conversation_updated", { 
                conversationId, 
                last_message: sanitizedMessage,
                timestamp: new Date().toISOString()
            });

            // Clear typing indicator
            clearTypingForUser(userId);

            if (callback) callback({ success: true, message: savedMessage });
        } catch (err) {
            logger.error(`Socket Send Message Error: ${err.message}`);
            if (callback) callback({ success: false, message: "Server error" });
        }
    });

    // Typing indicator
    socket.on("typing", (data) => {
        handleTyping(socket, data);
    });

    // Stop typing
    socket.on("stop_typing", (data) => {
        handleStopTyping(socket, data);
    });

    // Message read receipt
    socket.on("message_read", async (data) => {
        try {
            const { messageId, conversationId } = data;
            if (!messageId || !conversationId) return;

            // Mark message as read
            await chatService.markMessageAsRead(messageId, userId);
            
            io.to(`conversation:${conversationId}`).emit('message_read', {
                messageId,
                userId,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            logger.error(`Message read error: ${err.message}`);
        }
    });

    // Edit message
    socket.on("edit_message", async (data) => {
        try {
            const { messageId, newMessage, conversationId } = data;
            if (!messageId || !newMessage || !conversationId) return;

            // Check if user owns the message
            const message = await chatService.getMessage(messageId);
            if (message.sender_id !== userId) {
                socket.emit('error', { message: 'Not authorized to edit this message' });
                return;
            }

            const sanitizedMessage = sanitizeString(newMessage.trim());
            await chatService.updateMessage(messageId, sanitizedMessage);

            io.to(`conversation:${conversationId}`).emit('message_edited', {
                messageId,
                newMessage: sanitizedMessage,
                editedAt: new Date().toISOString()
            });
        } catch (err) {
            logger.error(`Edit message error: ${err.message}`);
            socket.emit('error', { message: 'Failed to edit message' });
        }
    });

    // Delete message
    socket.on("delete_message", async (data) => {
        try {
            const { messageId, conversationId } = data;
            if (!messageId || !conversationId) return;

            // Check if user owns the message
            const message = await chatService.getMessage(messageId);
            if (message.sender_id !== userId && userRole !== 'admin') {
                socket.emit('error', { message: 'Not authorized to delete this message' });
                return;
            }

            await chatService.deleteMessage(messageId);

            io.to(`conversation:${conversationId}`).emit('message_deleted', {
                messageId,
                deletedAt: new Date().toISOString()
            });
        } catch (err) {
            logger.error(`Delete message error: ${err.message}`);
            socket.emit('error', { message: 'Failed to delete message' });
        }
    });

    // Join admin room
    socket.on("join_admin_room", () => {
        if (userRole === 'admin') {
            socket.join('admin_room');
            logger.info(`Admin ${userId} joined admin_room`);
            socket.emit('admin_room_joined', { success: true });
        }
    });

    // Get active users
    socket.on("get_active_users", () => {
        const activeUsers = Array.from(userSockets.keys());
        socket.emit('active_users', activeUsers);
    });

    // Get online count
    socket.on("get_online_count", () => {
        socket.emit('online_count', userSockets.size);
    });

    // Pong for heartbeat
    socket.on("pong", () => {
        socket.lastPong = Date.now();
    });
}

// ==================== TYPING HANDLERS ====================
function handleTyping(socket, data) {
    const userId = socket.userId;
    if (!userId) return;

    const roomId = data.roomId || socket.currentRoom;
    if (!roomId) return;

    // Clear existing timeout
    if (typingUsers.has(roomId)) {
        const existing = typingUsers.get(roomId);
        if (existing.userId === userId) {
            clearTimeout(existing.timeout);
        }
    }

    // Set new typing indicator
    const timeout = setTimeout(() => {
        handleStopTyping(socket, { roomId });
    }, TYPING_TIMEOUT);

    typingUsers.set(roomId, { userId, timeout });
    io.to(roomId).emit('user_typing', { userId });
}

function handleStopTyping(socket, data) {
    const userId = socket.userId;
    if (!userId) return;

    const roomId = data.roomId || socket.currentRoom;
    if (!roomId) return;

    const typingData = typingUsers.get(roomId);
    if (typingData && typingData.userId === userId) {
        clearTimeout(typingData.timeout);
        typingUsers.delete(roomId);
        io.to(roomId).emit('user_stopped_typing', { userId });
    }
}

function clearTypingForUser(userId) {
    for (const [roomId, data] of typingUsers) {
        if (data.userId === userId) {
            clearTimeout(data.timeout);
            typingUsers.delete(roomId);
            io.to(roomId).emit('user_stopped_typing', { userId });
        }
    }
}

// ==================== RATE LIMITING ====================
function checkRateLimit(socketId) {
    const now = Date.now();
    const userRate = messageRateLimit.get(socketId) || { count: 0, timestamp: now };

    // Reset if window has passed
    if (now - userRate.timestamp > RATE_WINDOW) {
        userRate.count = 0;
        userRate.timestamp = now;
    }

    // Check rate limit
    if (userRate.count >= RATE_LIMIT) {
        return false;
    }

    // Increment count
    userRate.count++;
    messageRateLimit.set(socketId, userRate);
    return true;
}

// ==================== HEARTBEAT ====================
function setupHeartbeat(socket) {
    socket.lastPong = Date.now();

    const heartbeatInterval = setInterval(() => {
        const now = Date.now();
        if (now - socket.lastPong > HEARTBEAT_INTERVAL + 5000) {
            logger.warn(`Heartbeat timeout for socket ${socket.id}`);
            socket.emit('heartbeat_timeout');
            clearInterval(heartbeatInterval);
        }
    }, HEARTBEAT_INTERVAL);

    socket.on('disconnect', () => {
        clearInterval(heartbeatInterval);
    });
}

// ==================== DISCONNECT HANDLER ====================
function handleDisconnect(socket) {
    const userId = socket.userId;
    if (userId) {
        // Remove from active rooms
        for (const [roomId, sockets] of activeRooms) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
                activeRooms.delete(roomId);
            }
        }

        // Remove user mappings
        userSockets.delete(userId);
        socketUsers.delete(socket.id);
        userStatus.set(userId, { status: 'offline', lastSeen: new Date() });

        // Clear typing indicators
        clearTypingForUser(userId);

        // Broadcast offline status
        io.emit('user_status_change', { userId, status: 'offline' });
        io.emit('users_online', userSockets.size);

        logger.info(`User disconnected: ${userId}`);
    }
}

// ==================== UTILITY FUNCTIONS ====================
const getIo = () => {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
};

const sendToUser = (userId, event, data) => {
    const socketId = userSockets.get(userId);
    if (socketId) {
        io.to(socketId).emit(event, data);
    }
};

const broadcastToRoom = (roomId, event, data) => {
    io.to(roomId).emit(event, data);
};

const getActiveUsers = () => {
    return Array.from(userSockets.keys());
};

const getUserStatus = (userId) => {
    return userStatus.get(userId) || { status: 'offline', lastSeen: null };
};

module.exports = { 
    initSocket, 
    getIo,
    sendToUser,
    broadcastToRoom,
    getActiveUsers,
    getUserStatus
};