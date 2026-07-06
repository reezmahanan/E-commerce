// backend/utils/validators.js

/**
 * Validates if the given string is a properly formatted email address.
 * @param {string} email - The email string to validate.
 * @returns {boolean} - True if the email format is valid, false otherwise.
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};
module.exports = { isValidEmail };