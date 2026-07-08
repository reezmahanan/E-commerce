const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');

describe('authMiddleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = { headers: {} };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
    });

    it('should reject request without authorization header', () => {
        authMiddleware(mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            message: 'Authorization header required'
        });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept valid Bearer token', () => {
        const token = jwt.sign({ userId: 1 }, 'test-secret');
        mockReq.headers.authorization = `Bearer ${token}`;
        
        authMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.user).toBeDefined();
    });

    it('should reject invalid token', () => {
        mockReq.headers.authorization = 'Bearer invalid-token';
        
        authMiddleware(mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            success: false,
            message: 'Invalid or expired token'
        });
    });
});

describe('optionalAuth', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = { headers: {} };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
    });

    it('should call next without token', () => {
        optionalAuth(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should attach user with valid token', () => {
        const token = jwt.sign({ userId: 1 }, 'test-secret');
        mockReq.headers.authorization = `Bearer ${token}`;
        
        optionalAuth(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.user).toBeDefined();
    });
});
