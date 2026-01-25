import { createClient } from "redis";

let redisClient = null;
let isInitialized = false;

export const initializeRedis = async () => {
    if (isInitialized) {
        return redisClient;
    }

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
        isInitialized = true;
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

export const isRedisInitialized = () => isInitialized;

export const closeRedis = async () => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        isInitialized = false;
        console.log("Redis connection closed");
    }
};
