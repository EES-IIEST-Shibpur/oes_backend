import { Queue, Worker } from "bullmq";
import { getRedisClient, isRedisInitialized } from "../config/redis.js";
import { calculateExamScore } from "./examScore.service.js";
import {
    ExamAttempt,
    StudentAnswer,
    Question,
    Option,
    NumericalAnswer
} from "../modules/association/index.js";
import sequelize from "../config/db.js";

let scoreQueue = null;
let scoreWorker = null;
let isInitialized = false;

/**
 * Initialize the score calculation queue and worker
 */
export const initializeScoreQueue = async () => {
    if (isInitialized) {
        return { scoreQueue, scoreWorker };
    }

    if (!isRedisInitialized()) {
        throw new Error("Redis must be initialized before score calculation queue");
    }

    try {
        const redis = getRedisClient();

        // Create queue
        scoreQueue = new Queue("score-calculation", {
            connection: redis,
        });

        // Create worker to process score calculation jobs
        scoreWorker = new Worker(
            "score-calculation",
            async (job) => {
                try {
                    console.log(`Processing score calculation for attempt ${job.data.attemptId}`);

                    const { attemptId } = job.data;

                    // Calculate score in transaction
                    const result = await sequelize.transaction(async (t) => {
                        // Fetch the attempt
                        const attempt = await ExamAttempt.findByPk(attemptId, {
                            transaction: t,
                            lock: t.LOCK.UPDATE,
                        });

                        if (!attempt) {
                            throw new Error(`Attempt ${attemptId} not found`);
                        }

                        // Skip if already calculated
                        if (attempt.score !== null) {
                            console.log(`Score already calculated for attempt ${attemptId}`);
                            return {
                                success: true,
                                attemptId,
                                score: attempt.score,
                                alreadyCalculated: true,
                            };
                        }

                        // Fetch all answers for this attempt
                        const answers = await StudentAnswer.findAll({
                            where: { examAttemptId: attemptId },
                            include: {
                                model: Question,
                                include: [
                                    { model: Option, as: "options" },
                                    { model: NumericalAnswer },
                                ],
                            },
                            transaction: t,
                            lock: t.LOCK.UPDATE,
                        });

                        // Calculate score
                        const score = await calculateExamScore(answers, t);

                        // Update attempt with score
                        attempt.score = score;
                        await attempt.save({ transaction: t });

                        console.log(`Score calculated for attempt ${attemptId}: ${score}`);

                        return {
                            success: true,
                            attemptId,
                            score,
                            alreadyCalculated: false,
                        };
                    });

                    return result;
                } catch (error) {
                    console.error(`Score calculation job failed for attempt ${job.data.attemptId}:`, error.message);
                    throw error;
                }
            },
            {
                connection: redis,
                concurrency: 3, // Process up to 3 score calculations concurrently
                settings: {
                    attempts: 3, // Retry 3 times on failure
                    backoff: {
                        type: "exponential",
                        delay: 1000, // Start with 1 second
                    },
                },
            }
        );

        // Event listeners
        scoreWorker.on("completed", (job, result) => {
            console.log(`Score calculation job ${job.id} completed for attempt ${result.attemptId} with score ${result.score}`);
        });

        scoreWorker.on("failed", (job, error) => {
            console.error(`Score calculation job ${job.id} failed after retries:`, error.message);
        });

        scoreQueue.on("error", (error) => {
            console.error("Score calculation queue error:", error);
        });

        console.log("Score calculation queue and worker initialized");
        isInitialized = true;
        return { scoreQueue, scoreWorker };
    } catch (error) {
        console.error("Failed to initialize score calculation queue:", error.message);
        throw error;
    }
};

/**
 * Check if score queue is initialized
 */
export const isScoreQueueInitialized = () => isInitialized;

/**
 * Get the score calculation queue instance
 */
export const getScoreQueue = () => {
    if (!scoreQueue) {
        throw new Error("Score queue not initialized. Call initializeScoreQueue first.");
    }
    return scoreQueue;
};

/**
 * Add score calculation job to queue
 * @param {string} attemptId - ExamAttempt ID
 * @param {Object} options - Job options (priority, delay, etc.)
 * @returns {Promise<Job>} - BullMQ job instance
 */
export const addScoreCalculationJob = async (attemptId, options = {}) => {
    try {
        const queue = getScoreQueue();

        const job = await queue.add(
            "calculate-score",
            { attemptId },
            {
                priority: options.priority || 1,
                delay: options.delay || 0,
                removeOnComplete: {
                    age: 3600, // Keep completed jobs for 1 hour
                    count: 1000, // Keep last 1000 completed jobs
                },
                removeOnFail: false, // Keep failed jobs for debugging
                ...options,
            }
        );

        console.log(`Score calculation job ${job.id} added for attempt ${attemptId}`);
        return job;
    } catch (error) {
        console.error(`Failed to add score calculation job for attempt ${attemptId}:`, error.message);
        throw error;
    }
};

/**
 * Close queue and worker connections
 */
export const closeScoreQueue = async () => {
    try {
        if (scoreWorker) {
            await scoreWorker.close();
            scoreWorker = null;
            console.log("Score calculation worker closed");
        }
        if (scoreQueue) {
            await scoreQueue.close();
            scoreQueue = null;
            console.log("Score calculation queue closed");
        }
        isInitialized = false;
    } catch (error) {
        console.error("Error closing score calculation queue:", error.message);
        throw error;
    }
};
