const express = require("express");
const { helmetMiddleware } = require("./middleware/helmetMiddleware");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const globalErrorHandler = require('./middleware/errorHandler');
const compression = require("compression");
const morgan = require("morgan");
const timeout = require("connect-timeout");
const fs = require("fs");
const path = require("path");
const setupGracefulShutdown = require('./utils/gracefulShutdown');

const { apiLimiter, adminLimiter, mcpLimiter } = require('./config/rateLimiters');
const dotenv = require("dotenv");
const helmet = require("helmet");
const corsMiddleware = require("./middleware/corsMiddleware");

// Add with other imports
// init app early so route and middleware registration can safely use it
const app = express();

const responseExampleRoutes = require('./routes/responseExampleRoutes');
const { standardizeResponse } = require('./middleware/responseStandardizer');

// Add response standardization middleware BEFORE routes
app.use(standardizeResponse);

// Add response example routes (for testing)
app.use('/api/response-example', responseExampleRoutes);

const { buildHealthResponse } = require("./utils/healthResponseBuilder");
const { logServerStartup } = require("./utils/serverStartupLogger");
const { errorLogStream } = require("./utils/logstreams");

const logDir = path.join(process.cwd(), "logs");
// Add with other route imports
const aiFeedRoutes = require('./routes/aiFeedRoutes');
const agentRoutes = require('./routes/agentRoutes');
const legalRoutes = require('./routes/legalRoutes');
const aiLegalRoutes = require('./routes/aiLegalRoutes');

// Add AI Legal routes
app.use('/api/ai-legal', aiLegalRoutes);
// Add routes
app.use('/api/legal', legalRoutes);
// Add routes
app.use('/api/agents', agentRoutes);
// Add AI feed routes
app.use('/api/ai-feed', aiFeedRoutes);

const routes = require("./routes/index");
const { authLimiter } = require("./middleware/authLimiter");
const mcpRoutes = require("./routes/mcpRoutes"); // ✅ MCP Routes added
// Add with other imports

const dependencyRoutes = require('./routes/dependencyRoutes');
const { dependencyGraphService } = require('./services/dependencyGraphService');


const healthRoutes = require('./routes/healthRoutes');
const { healthScoreService } = require('./services/healthScoreService');

const discoveryRoutes = require('./routes/discoveryRoutes');
const { capabilityDiscoveryService } = require('./services/capabilityDiscoveryService');

// Initialize capability discovery
await capabilityDiscoveryService.initialize();

// Add discovery routes
app.use('/api/discovery', discoveryRoutes);

const metricsRoutes = require('./routes/metricsRoutes');
const { metricsAggregationService } = require('./services/metricsAggregationService');

// Initialize metrics service
await metricsAggregationService.initialize();

// Add metrics routes
app.use('/api/metrics', metricsRoutes);


const notificationBrokerRoutes = require('./routes/notificationBrokerRoutes');
const { 
    notificationBroker, 
    inAppChannel, 
    emailChannel, 
    webhookChannel 
} = require('./services/notificationBrokerService');

// Register channels
notificationBroker.registerChannel('in_app', inAppChannel.handler);
notificationBroker.registerChannel('email', emailChannel.handler);
notificationBroker.registerChannel('webhook', webhookChannel.handler);

// Initialize notification broker
await notificationBroker.initialize();


// Add notification routes
app.use('/api/notifications', notificationBrokerRoutes);

// Add config routes
app.use('/api/config', configRoutes);

// Add with other imports
const { evaluateRisk } = require('./middleware/riskMiddleware');


// Add risk evaluation middleware after authentication
app.use(evaluateRisk);

const tracingRoutes = require('./routes/tracingRoutes');
const { traceRequest } = require('./middleware/tracingMiddleware');
const { tracingService } = require('./services/tracingService');


// Initialize tracing service
await tracingService.initialize();

// Add tracing middleware BEFORE any routes
app.use(traceRequest);

// Add tracing routes
app.use('/api/tracing', tracingRoutes);

// Add shutdown handler for tracing
process.on('SIGTERM', async () => {
    await tracingService.shutdown();
});

process.on('SIGINT', async () => {
    await tracingService.shutdown();
});


const policyRoutes = require('./routes/policyRoutes');
const { policyEngine } = require('./services/policyEngineService');


// Initialize policy engine
await policyEngine.initialize();

// Add policy routes
app.use('/api/policies', policyRoutes);


// Add with other imports
const outboxRoutes = require('./routes/outboxRoutes');
const { outboxService } = require('./services/outboxService');


// Initialize outbox service
outboxService.initialize().catch(err => console.error('Outbox initialization failed:', err));

// Add outbox routes
app.use('/api/outbox', outboxRoutes);


// Add with other route imports
const cqrsRoutes = require('./routes/cqrsRoutes');
const { readModelSynchronizer } = require('./services/cqrsService');

// Start read model synchronization
readModelSynchronizer.start();


// Add CQRS routes
app.use('/api/cqrs', cqrsRoutes);
// Add with other imports


const jobRoutes = require('./routes/jobRoutes');
const { jobQueue, jobHandlers, JOB_TYPES } = require('./services/jobQueueService');

// Register job handlers
for (const [type, handler] of Object.entries(jobHandlers)) {
    jobQueue.registerHandler(type, handler);
}

// Initialize job queue
await jobQueue.initialize();

// Add job routes
app.use('/api/jobs', jobRoutes);

const flagRoutes = require('./routes/flagRoutes');
const { featureFlagService } = require('./services/featureFlagService');

// Initialize feature flag service
featureFlagService.initialize().catch(err => console.error('Feature flag initialization failed:', err));

// Add flag routes
app.use('/api/flags', flagRoutes);


const correlationRoutes = require('./routes/correlationRoutes');
const { correlationIdMiddleware, logCompletionMiddleware } = require('./middleware/correlationIdMiddleware');

// Add correlation ID middleware BEFORE any other middleware
app.use(correlationIdMiddleware);
app.use(logCompletionMiddleware);

// Add correlation routes
app.use('/api/correlation', correlationRoutes);


// Add with other route imports



const recommendationRoutes = require('./routes/recommendationRoutes');

// Add recommendation routes
app.use('/api/recommendations', recommendationRoutes);

const ruleRoutes = require('./routes/ruleRoutes');

// Add rule routes
app.use('/api/rules', ruleRoutes);


const pluginRoutes = require('./routes/pluginRoutes');
const { pluginSystem } = require('./services/pluginSystemService');

// Initialize plugin system
pluginSystem.initialize().catch(err => console.error('Plugin system initialization failed:', err));

// Add plugin routes
app.use('/api/plugins', pluginRoutes);


const eventRoutes = require('./routes/eventRoutes');
const { setupAllSubscribers } = require('./services/eventSubscribers');

// Add event routes
app.use('/api/events', eventRoutes);

// Setup event subscribers after all services are initialized
setupAllSubscribers();
// Add with other route imports
const performanceRoutes = require('./routes/performanceRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const rollbackRoutes = require('./routes/rollbackRoutes');
const securityRoutes = require('./routes/securityRoutes');
const aiFinancialRoutes = require('./routes/aiFinancialRoutes');

// Add AI financial routes
app.use('/api/ai/financial', aiFinancialRoutes);


// Add performance routes
app.use('/api/performance', performanceRoutes);



// Initialize dependency graph service
await dependencyGraphService.initialize();

// Add dependency routes
app.use('/api/dependencies', dependencyRoutes);
// Add with other route imports

const copywriterRoutes = require('./routes/copywriterRoutes');
// Add with other imports
const experimentRoutes = require('./routes/experimentRoutes');

// Add experiment routes
app.use('/api/experiments', experimentRoutes);
// Add copywriter routes
app.use('/api/copywriter', copywriterRoutes);
// Add with other imports

const { detectAgenticFraud } = require('./middleware/agenticFraudMiddleware');
const { detectBot, addBotDetectionHeaders } = require('./middleware/botProtectionMiddleware');
const { verifyAICrawler } = require('./middleware/aiCrawlerMiddleware');

// Create logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Create error log stream
const errorLogStream = fs.createWriteStream(
    path.join(logsDir, 'error.log'),
    { flags: 'a' }
);

// Build health response
function buildHealthResponse(data) {
    return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        ...data
    };
}

// Server startup logger
function logServerStartup(options) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    SERVER STARTUP INFO                       ║
╠══════════════════════════════════════════════════════════════╣
║  Status:        ✅ Running                                   ║
║  Port:          ${String(options.port).padEnd(45)}║
║  Environment:   ${String(options.environment).padEnd(45)}║
║  Health Check:  ${String(options.healthUrl).padEnd(45)}║
╠══════════════════════════════════════════════════════════════╣
║                    SECURITY FEATURES                         ║
╠══════════════════════════════════════════════════════════════╣
║  Rate Limiting:  ${String(options.rateLimiting ? '✅ Enabled' : '❌ Disabled').padEnd(44)}║
║  Helmet:         ${String(options.helmet ? '✅ Enabled' : '❌ Disabled').padEnd(44)}║
║  MCP Security:   ${String(options.mcpSecurity ? '✅ Enabled' : '❌ Disabled').padEnd(44)}║
╚══════════════════════════════════════════════════════════════╝
    `);
}

// Load environment
dotenv.config();
const { validateEnv } = require('./config/envValidator');
validateEnv();

// Initialize database
require("./config/db");

const http = require("node:http");
const server = http.createServer(app);
const { initSocket } = require("./utils/socketManager");
const { accessLogger, errorLogger, devLogger } = require('./config/morganConfig');

// Constants
const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5500";

// Trust proxy
app.set("trust proxy", 1);

// Disable x-powered-by header
app.disable("x-powered-by");

// Security headers
app.use(helmetMiddleware);

// Compression
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers["x-no-compression"]) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// Request timeout
app.use(timeout("30s"));

// Extend timeout for specific routes
app.use((req, res, next) => {
    if (req.path.startsWith("/api/admin") || 
        req.path === "/api/upload" || 
        req.path === "/api/export" ||
        req.path.startsWith("/api/mcp")) {
        req.setTimeout(60000);
    }
    next();
});

// CORS - allowed origins
const allowedOrigins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5501",
    "http://127.0.0.1:5501",
    "http://localhost:5502",
    "http://127.0.0.1:5502",
    "http://172.18.208.1:5500",
    "http://172.18.208.1:5501",
    "http://172.18.208.1:5502",
    FRONTEND_URL,
    "https://e-commerce-git-main-bhuvanshs-projects.vercel.app",
    "https://www.bhuvansh.xyz",
    "https://e-commerce-production-d546.up.railway.app"
];

// Initialize websocket server with CORS
initSocket(server, allowedOrigins);

// CORS middleware
app.use(corsMiddleware);
app.use(accessLogger);

// Log errors to error.log
app.use(errorLogger);

// Console logging in development
if (process.env.NODE_ENV !== "production") {
    app.use(devLogger);
}

// Body parsers
app.use(
    express.json({
        limit: "10mb",
    }),
);

app.use(cookieParser());

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb",
    }),
);

// ✅ Security headers for MCP endpoints
app.use('/api/mcp', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
});

// Request logger
if (process.env.NODE_ENV !== "production") {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.originalUrl} - ${req.ip}`);
        next();
    });
}

// Apply rate limiting
app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/refresh-token", authLimiter);
app.use("/api/admin", adminLimiter);
app.use("/api/mcp", mcpLimiter);

// Bot detection middleware (only once, not duplicated)
app.use(addBotDetectionHeaders);
app.use(detectBot);

// AI Crawler verification middleware
app.use(verifyAICrawler);

// Agent fraud detection middleware
app.use(detectAgenticFraud);

// Health check endpoint
app.get("/health", (req, res) => {
    const healthData = buildHealthResponse({
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
    });
    return res.status(200).json(healthData);
});

// Root route
app.get("/", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "E-Commerce Backend Running",
        version: "2.0.0",
        endpoints: {
            health: "/health",
            api: "/api",
            auth: "/api/auth",
            admin: "/api/admin",
            mcp: "/api/mcp"
        },
        security: {
            rateLimiting: "Enabled",
            helmet: "Enabled",
            cors: "Configured",
            mcpSecurity: "Enabled"
        }
    });
});

// API routes
app.use("/api", routes);
app.use("/api/ai", aiRoutes);
app.use("/api/ai-feed", aiFeedRoutes);
app.use("/api/ai/financial", aiFinancialRoutes);
app.use("/api/ai-legal", aiLegalRoutes);
app.use("/api/legal", legalRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/rollback", rollbackRoutes);
app.use("/api/copywriter", copywriterRoutes);
app.use("/api/fraud", fraudRoutes);
app.use("/api/mcp", mcpRoutes);

// 404 handler
app.use((req, res) => {
    return res.status(404).json({
        success: false,
        errorCode: "ROUTE_NOT_FOUND",
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});

// Global error handler
app.use(globalErrorHandler(errorLogStream));

setupProcessEventHandlers(errorLogStream);

// Initialize graceful shutdown logic
setupGracefulShutdown(server);

// start server
// start server
server.listen(PORT, "0.0.0.0", () => {
    logServerStartup({
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        frontendUrl: FRONTEND_URL,
        logsDir: logsDir,
        healthUrl: `http://localhost:${PORT}/health`,
        mcpSecurity: true,
        rateLimiting: true,
        helmet: true,
    });
});

module.exports = app;