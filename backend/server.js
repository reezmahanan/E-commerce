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

// init app early so route and middleware registration can safely use it
const app = express();

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
// Import agent routes
const agentRoutes = require('./routes/agentRoutes');
// Import legal routes
const legalRoutes = require('./routes/legalRoutes');
// Add with other route imports
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
const capabilityRoutes = require('./routes/capabilityRoutes');
const { capabilityMappingService } = require('./services/capabilityMappingService');


const versionRoutes = require('./routes/versionRoutes');
const { semanticVersionService } = require('./services/semanticVersionService');


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

// Import routes
const approvalRoutes = require('./routes/approvalRoutes');
const rollbackRoutes = require('./routes/rollbackRoutes');
// Import security routes
const securityRoutes = require('./routes/securityRoutes');

// Add routes
app.use('/api/security', securityRoutes);
// Add routes
app.use('/api/approvals', approvalRoutes);
app.use('/api/rollback', rollbackRoutes);
// Add with other route imports

const aiFinancialRoutes = require('./routes/aiFinancialRoutes');

// Add AI financial routes
app.use('/api/ai/financial', aiFinancialRoutes);


// Add performance routes
app.use('/api/performance', performanceRoutes);


// Initialize capability mapping
await capabilityMappingService.initialize();

// Add capability routes
app.use('/api/capabilities', capabilityRoutes);
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


// Add after other middleware
app.use(addBotDetectionHeaders);
app.use(detectBot);


const { verifyAICrawler } = require('./middleware/aiCrawlerMiddleware');


// Add after other middleware
app.use(verifyAICrawler);



// Add after other middleware
app.use(addBotDetectionHeaders);
app.use(detectBot);
// Add with other route imports
const fraudRoutes = require('./routes/fraudRoutes');

// Add fraud routes
app.use('/api/fraud', fraudRoutes);



// Add after auth middleware
app.use(detectAgenticFraud);
const aiRoutes = require('./routes/aiRoutes');

// Add AI routes
app.use('/api/ai', aiRoutes);

// load environment
dotenv.config();
const { validateEnv } = require('./config/envValidator');
validateEnv();

// database
require("./config/db");

const http = require("node:http");
const server = http.createServer(app);
const { initSocket } = require("./utils/socketManager");
const { accessLogger, errorLogger, devLogger } = require('./config/morganConfig');
// constants
const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5500";

// create logs directory



// trust proxy
app.set("trust proxy", 1);

// security
app.disable("x-powered-by");

// security headers
app.use(helmetMiddleware);

// compression - gzip/brotli
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

// request timeout
app.use(timeout("30s"));

// extend timeout for specific routes
app.use((req, res, next) => {
    if (req.path.startsWith("/api/admin") || 
        req.path === "/api/upload" || 
        req.path === "/api/export" ||
        req.path.startsWith("/api/mcp")) { // ✅ MCP timeout extended
        req.setTimeout(60000);
    }
    next();
});

// cors - allowed origins
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

// initialize websocket server with CORS
initSocket(server, allowedOrigins);

// cors
app.use(corsMiddleware);
app.use(accessLogger);

// log errors to error.log
app.use(errorLogger);

// console logging in development
if (process.env.NODE_ENV !== "production") {
    app.use(devLogger);
}

// body parsers
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

// request logger
if (process.env.NODE_ENV !== "production") {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.originalUrl} - ${req.ip}`);
        next();
    });
}


// apply rate limiting
app.use("/api", apiLimiter);

// auth routes rate limiting
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/refresh-token", authLimiter);

// admin routes rate limiting
app.use("/api/admin", adminLimiter);

// ✅ MCP routes rate limiting
app.use("/api/mcp", mcpLimiter);

// health check
// health check
app.get("/health", (req, res) => {
    const healthData = buildHealthResponse({
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
    });
    return res.status(200).json(healthData);
});;

// root route
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
            mcp: "/api/mcp", // ✅ MCP endpoint added
        },
        security: {
            rateLimiting: "Enabled",
            helmet: "Enabled",
            cors: "Configured",
            mcpSecurity: "Enabled",
        }
    });
});

// api routes
app.use("/api", routes);

// ✅ MCP routes - must be after auth routes but before 404
app.use("/api/mcp", mcpRoutes);

// 404 handler
app.use((req, res) => {
    return res.status(404).json({
        success: false,
        errorCode: "ROUTE_NOT_FOUND",
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});

// Register the extracted global error handler
app.use(globalErrorHandler(errorLogStream));

// unhandled rejection
process.on("unhandledRejection", (reason) => {
    console.error("UNHANDLED REJECTION:", reason);
    errorLogStream.write(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: "UNHANDLED_REJECTION",
        reason: reason?.message || reason,
        stack: reason?.stack,
    }) + "\n");
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// uncaught exception
process.on("uncaughtException", (error) => {
    console.error("UNCAUGHT EXCEPTION:", error);
    errorLogStream.write(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: "UNCAUGHT_EXCEPTION",
        error: error.message,
        stack: error.stack,
    }) + "\n");
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// Initialize graceful shutdown logic
setupGracefulShutdown(server);

// start server
// start server
server.listen(PORT, "0.0.0.0", () => {
    logServerStartup({
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        frontendUrl: FRONTEND_URL,
        logsDir: logDir,
        healthUrl: `http://localhost:${PORT}/health`,
        mcpSecurity: true,
        rateLimiting: true,
        helmet: true,
    });
});

module.exports = app;