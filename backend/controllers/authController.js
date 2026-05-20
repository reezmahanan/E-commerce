const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SIGNUP
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // VALIDATION
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    // CHECK EXISTING USER
    db.query("SELECT * FROM users WHERE email = ?", [email], async (error, result) => {
      if (error) return res.status(500).json({ success: false, message: error.message });
      if (result.length > 0) return res.status(400).json({ success: false, message: "User already exists" });

      // HASH PASSWORD
      const hashedPassword = await bcrypt.hash(password, 10);

      // INSERT USER
      db.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        [name, email, hashedPassword, "user"], // default role as "user"
        (error, result) => {
          if (error) return res.status(500).json({ success: false, message: error.message });
          res.status(201).json({ success: true, message: "User registered successfully" });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password required" });

    db.query("SELECT * FROM users WHERE email = ?", [email], async (error, result) => {
      if (error) return res.status(500).json({ success: false, message: error.message });
      if (result.length === 0) return res.status(400).json({ success: false, message: "Invalid credentials" });

      const user = result[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ success: false, message: "Invalid credentials" });

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || "secretkey",
        { expiresIn: "7d" }
      );

      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { signup, login };