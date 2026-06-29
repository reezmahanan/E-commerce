const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'PORT',
  'FRONTEND_URL',
  'NODE_ENV'
];

const validateEnv = () => {
  // Check for missing or empty environment variables
  const missingVars = requiredEnvVars.filter((varName) => {
    return !process.env[varName] || process.env[varName].trim() === '';
  });

  if (missingVars.length > 0) {
    console.error('❌ Startup Validation Failed: Missing required environment variables.');
    console.error(`   Missing: ${missingVars.join(', ')}`);
    console.error('   Please check your .env file or set the environment variables before starting the server.');
    process.exit(1); // Stop the server immediately with a failure code
  }

  console.log('✅ Environment Variables Validation Passed.');
};

module.exports = { validateEnv };