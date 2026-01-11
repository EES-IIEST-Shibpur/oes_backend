import { createClient } from "redis";

let redisClient = null;

export const initializeRedis = async () => {
    try {
        redisClient = createClient({
            url: process.env.REDIS_URL || "redis://localhost:6379",
            socket: {
                reconnectStrategy: (retries) => Math.min(retries * 50, 500),
            },
        });

        redisClient.on("error", (err) => {
            console.error("Redis Client Error:", err);
        });

        redisClient.on("connect", () => {
            console.log("Redis connected successfully");
        });

        redisClient.on("ready", () => {
            console.log("Redis client ready");
        });

        await redisClient.connect();
        return redisClient;
    } catch (error) {
        console.error("Failed to initialize Redis:", error.message);
        throw error;
    }
};

export const getRedisClient = () => {
    if (!redisClient) {
        throw new Error("Redis client not initialized. Call initializeRedis first.");
    }
    return redisClient;
};

export const closeRedis = async () => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        console.log("Redis connection closed");
    }
};

export default redisClient;
