// backend/utils/validators.js

/**
 * Validates if the given string is a properly formatted email address.
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};



/**
 * Validates if the given password meets strong security requirements.
 * Requirements: Min 8 chars, uppercase, lowercase, number, and a special character.
 * @param {string} password - The password string to validate.
 * @returns {Object} - An object containing `isValid` (boolean) and `message` (string).
 */
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: "Password is required" };
  }
  if (password.length < 8) {
    return { isValid: false, message: "Password must be at least 8 characters long" };
  }

  // Strong password regex from the issue #545 screenshot
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!strongPasswordRegex.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)"
    };
  }
  return { isValid: true, message: "Password is strong" };
};

module.exports = {
  isValidEmail,
  validatePassword,
};