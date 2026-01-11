import app from "./app.js";
import sequelize from "./config/db.js";
import { verifyEmailTransporter } from "./services/email.service.js";
import { initializeRedis, closeRedis } from "./config/redis.js";
import { initializeEmailQueue, closeEmailQueue } from "./services/emailQueue.service.js";
import { initializeScoreQueue, closeScoreQueue } from "./services/scoreCalculationQueue.service.js";

const PORT = process.env.PORT || 8000;

const startServer = async () => {
    try {
        // Redis
        await initializeRedis();
        console.log("Redis initialized");

        // Email Queue (depends on Redis)
        await initializeEmailQueue();
        console.log("Email queue initialized");

        // Score Calculation Queue (depends on Redis)
        await initializeScoreQueue();
        console.log("Score calculation queue initialized");

        // Database
        await sequelize.authenticate();
        await sequelize.sync();
        console.log("Database connected & synced");

        // Email
        verifyEmailTransporter();
        console.log("Email transporter verified");

        // Server
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        // Graceful shutdown
        process.on("SIGINT", async () => {
            console.log("Shutting down gracefully...");
            server.close(async () => {
                await closeScoreQueue();
                await closeEmailQueue();
                await closeRedis();
                await sequelize.close();
                console.log("All connections closed");
                process.exit(0);
            });
        });

        process.on("SIGTERM", async () => {
            console.log("SIGTERM received, shutting down...");
            server.close(async () => {
                await closeScoreQueue();
                await closeEmailQueue();
                await closeRedis();
                await sequelize.close();
                console.log("All connections closed");
                process.exit(0);
            });
        });
    } catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
};

startServer();