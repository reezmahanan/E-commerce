// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if header exists
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    // Check if it starts with Bearer
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Bearer token required" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Invalid token format" });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message === "jwt expired" ? "Token expired" : "Unauthorized"
    });
  }
};

module.exports = authMiddleware;