import { loadEnvironment } from "./config/env.js";

// Load environment variables first, before any other imports
const NODE_ENV = loadEnvironment();

import app from "./app.js";
import { initializeDatabase, closeDatabase, getSequelizeInstance } from "./config/db.js";
import { initializeEmailTransporter, verifyEmailTransporter } from "./services/email.service.js";
import { initializeRedis, closeRedis } from "./config/redis.js";
import { initializeEmailQueue, closeEmailQueue } from "./services/emailQueue.service.js";
import { initializeScoreQueue, closeScoreQueue } from "./services/scoreCalculationQueue.service.js";
import { startAutoSubmitCron, destroyAutoSubmitCron } from "./cron/autoSubmitExamAttempts.cron.js";

const PORT = process.env.PORT || 8000;

// Feature flags from environment variables (default to true for backward compatibility)
const ENABLE_DATABASE = process.env.ENABLE_DATABASE !== "false";
const ENABLE_REDIS = process.env.ENABLE_REDIS !== "false";
const ENABLE_EMAIL_QUEUE = process.env.ENABLE_EMAIL_QUEUE !== "false";
const ENABLE_SCORE_QUEUE = process.env.ENABLE_SCORE_QUEUE !== "false";
const ENABLE_EMAIL_SERVICE = process.env.ENABLE_EMAIL_SERVICE !== "false";
const ENABLE_CRON_JOBS = process.env.ENABLE_CRON_JOBS !== "false";
const ENABLE_ASSOCIATIONS = process.env.ENABLE_ASSOCIATIONS !== "false";

const startServer = async () => {
    const initializedServices = [];

    try {
        console.log("   Starting server with configuration:");
        console.log(`   Environment: ${NODE_ENV}`);
        console.log(`   Database: ${ENABLE_DATABASE ? "enabled" : "disabled"}`);
        console.log(`   Redis: ${ENABLE_REDIS ? "enabled" : "disabled"}`);
        console.log(`   Email Queue: ${ENABLE_EMAIL_QUEUE ? "enabled" : "disabled"}`);
        console.log(`   Score Queue: ${ENABLE_SCORE_QUEUE ? "enabled" : "disabled"}`);
        console.log(`   Email Service: ${ENABLE_EMAIL_SERVICE ? "enabled" : "disabled"}`);
        console.log(`   Cron Jobs: ${ENABLE_CRON_JOBS ? "enabled" : "disabled"}`);
        console.log(`   Associations: ${ENABLE_ASSOCIATIONS ? "enabled" : "disabled"}`);
        console.log("");

        // Database
        if (ENABLE_DATABASE) {
            await initializeDatabase();
            initializedServices.push("database");

            // Load associations if enabled
            if (ENABLE_ASSOCIATIONS) {
                await import("./modules/association/index.js");
                console.log("Database associations loaded");
            }
        }

        // Redis
        if (ENABLE_REDIS) {
            await initializeRedis();
            initializedServices.push("redis");

            // Email Queue (depends on Redis)
            if (ENABLE_EMAIL_QUEUE) {
                await initializeEmailQueue();
                initializedServices.push("emailQueue");
            }

            // Score Calculation Queue (depends on Redis)
            if (ENABLE_SCORE_QUEUE) {
                await initializeScoreQueue();
                initializedServices.push("scoreQueue");
            }
        }

        // Email Service
        if (ENABLE_EMAIL_SERVICE) {
            initializeEmailTransporter();
            await verifyEmailTransporter();
            initializedServices.push("email");
        }

        // Cron Jobs (depends on Database)
        if (ENABLE_CRON_JOBS && ENABLE_DATABASE) {
            startAutoSubmitCron();
            initializedServices.push("cron");
        }

        // Server
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Initialized services: ${initializedServices.join(", ")}`);
            console.log("Process PID: ", process.pid)
        });

        // Graceful shutdown
        const shutdown = async (signal) => {
            console.log(`\n${signal} received, shutting down gracefully...`);
            server.close(async () => {
                // Close in reverse order of initialization
                if (initializedServices.includes("cron")) {
                    destroyAutoSubmitCron();
                }

                if (initializedServices.includes("scoreQueue")) {
                    await closeScoreQueue();
                }

                if (initializedServices.includes("emailQueue")) {
                    await closeEmailQueue();
                }

                if (initializedServices.includes("redis")) {
                    await closeRedis();
                }

                if (initializedServices.includes("database")) {
                    await closeDatabase();
                }

                console.log("All connections closed");
                process.exit(0);
            });
        };

        process.on("SIGINT", () => shutdown("SIGINT"));
        process.on("SIGTERM", () => shutdown("SIGTERM"));
    } catch (error) {
        console.error("Server startup failed:", error);

        // Cleanup on failure
        try {
            if (initializedServices.includes("scoreQueue")) await closeScoreQueue();
            if (initializedServices.includes("emailQueue")) await closeEmailQueue();
            if (initializedServices.includes("redis")) await closeRedis();
            if (initializedServices.includes("database")) await closeDatabase();
        } catch (cleanupError) {
            console.error("Cleanup error:", cleanupError);
        }

        process.exit(1);
    }
};

startServer();