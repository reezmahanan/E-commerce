module.exports = {
  // Previous constants...
  MAX_WISHLIST_SYNC_LIMIT: 200,
  MAX_BATCH_OPERATION_LIMIT: 50,
  SUPPORTED_EXPORT_FORMATS: ['csv', 'json'],

  // 🔥 NEW: Share token validation patterns
  SHARE_TOKEN_MAX_LENGTH: 64,
  // Regex for standard UUID v4 format (e.g., 123e4567-e89b-12d3-a456-426614174000)
  SHARE_TOKEN_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
};