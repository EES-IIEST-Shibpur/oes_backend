import { getRedisClient } from "../config/redis.js";

const DEFAULT_CACHE_TTL = 3600; // 1 hour in seconds

/**
 * Get cached data from Redis
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached data or null if not found
 */
export const getCache = async (key) => {
    try {
        const redis = getRedisClient();
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Cache GET error for key ${key}:`, error.message);
        return null;
    }
};

/**
 * Set data in Redis cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} - Success status
 */
export const setCache = async (key, value, ttl = DEFAULT_CACHE_TTL) => {
    try {
        const redis = getRedisClient();
        const serialized = JSON.stringify(value);
        await redis.setEx(key, ttl, serialized);
        return true;
    } catch (error) {
        console.error(`Cache SET error for key ${key}:`, error.message);
        return false;
    }
};

/**
 * Delete cached data from Redis
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Success status
 */
export const deleteCache = async (key) => {
    try {
        const redis = getRedisClient();
        await redis.del(key);
        return true;
    } catch (error) {
        console.error(`Cache DELETE error for key ${key}:`, error.message);
        return false;
    }
};

/**
 * Delete multiple cached items
 * @param {string[]} keys - Array of cache keys
 * @returns {Promise<boolean>} - Success status
 */
export const deleteCacheMultiple = async (keys) => {
    try {
        if (keys.length === 0) return true;
        const redis = getRedisClient();
        await redis.del(keys);
        return true;
    } catch (error) {
        console.error(`Cache DELETE MULTIPLE error:`, error.message);
        return false;
    }
};

/**
 * Clear all cache
 * @returns {Promise<boolean>} - Success status
 */
export const clearAllCache = async () => {
    try {
        const redis = getRedisClient();
        await redis.flushDb();
        return true;
    } catch (error) {
        console.error(`Cache FLUSH error:`, error.message);
        return false;
    }
};

/**
 * Get or set cache (cache-aside pattern)
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function to fetch data if cache miss
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<any>} - Cached or freshly fetched data
 */
export const getOrSetCache = async (key, fetchFn, ttl = DEFAULT_CACHE_TTL) => {
    try {
        // Try to get from cache
        const cached = await getCache(key);
        if (cached !== null) {
            return cached;
        }

        // Cache miss - fetch data
        const data = await fetchFn();

        // Store in cache
        await setCache(key, data, ttl);

        return data;
    } catch (error) {
        console.error(`Cache-aside error for key ${key}:`, error.message);
        // If caching fails, still return the fetched data
        return await fetchFn();
    }
};

// Cache key prefixes for different data types
export const CACHE_KEYS = {
    EXAM: (examId) => `exam:${examId}`,
    EXAM_QUESTIONS: (examId) => `exam:${examId}:questions`,
    QUESTION: (questionId) => `question:${questionId}`,
    USER_PROFILE: (userId) => `user:${userId}:profile`,
    EXAM_RESULT: (attemptId) => `result:${attemptId}`,
    USER_EXAMS: (userId) => `user:${userId}:exams`,
    ALL_EXAMS: "exams:all",
};
