// src/utils/gracefulShutdown.js

/**
 * Sets up graceful shutdown handlers for SIGINT and SIGTERM signals.
 * @param {http.Server} server - The HTTP server instance to shut down.
 */
const setupGracefulShutdown = (server) => {
  const shutdown = () => {
    console.log("\nShutting down server gracefully...");
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Force shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

module.exports = setupGracefulShutdown;