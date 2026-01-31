import { Queue, Worker } from "bullmq";
import { getRedisClient, isRedisInitialized } from "../config/redis.js";
import { sendEmail } from "./email.service.js";

let emailQueue = null;
let emailWorker = null;
let isInitialized = false;

/**
 * Initialize the email queue and worker
 */
export const initializeEmailQueue = async () => {
    if (isInitialized) {
        return { emailQueue, emailWorker };
    }

    if (!isRedisInitialized()) {
        throw new Error("Redis must be initialized before email queue");
    }
    try {
        const redis = getRedisClient();

        // Create queue
        emailQueue = new Queue("email", {
            connection: redis,
        });

        // Create worker to process email jobs
        emailWorker = new Worker(
            "email",
            async (job) => {
                try {

                    const result = await sendEmail({
                        to: job.data.to,
                        subject: job.data.subject,
                        html: job.data.html,
                    });

                    return {
                        success: true,
                        messageId: result.messageId,
                    };
                } catch (error) {
                    console.error(`Email job ${job.id} failed:`, error.message);

                    // Throw error to trigger retry mechanism
                    throw error;
                }
            },
            {
                connection: redis,
                concurrency: 5, // Process up to 5 emails concurrently
                settings: {
                    attempts: 3, // Retry 3 times on failure
                    backoff: {
                        type: "exponential",
                        delay: 2000, // Start with 2 seconds, exponential backoff
                    },
                    defaultJobOptions: {
                        removeOnComplete: true, // Remove completed jobs after 1 hour
                        removeOnFail: false, // Keep failed jobs for debugging
                    },
                },
            }
        );

        emailQueue.on("error", (error) => {
            console.error("Email queue error:", error);
        });

        isInitialized = true;
        return { emailQueue, emailWorker };
    } catch (error) {
        console.error("Failed to initialize email queue:", error.message);
        throw error;
    }
};

/**
 * Check if email queue is initialized
 */
export const isEmailQueueInitialized = () => isInitialized;

/**
 * Get the email queue instance
 */
export const getEmailQueue = () => {
    if (!emailQueue) {
        throw new Error("Email queue not initialized. Call initializeEmailQueue first.");
    }
    return emailQueue;
};

/**
 * Add email job to queue
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 * @param {Object} options - Job options (priority, delay, etc.)
 * @returns {Promise<Job>} - BullMQ job instance
 */
export const addEmailJob = async (to, subject, html, options = {}) => {
    try {
        const queue = getEmailQueue();

        const job = await queue.add(
            "send-email",
            {
                to,
                subject,
                html,
                timestamp: new Date().toISOString(),
            },
            {
                priority: options.priority || 5, // Default priority (0 = highest)
                delay: options.delay || 0,
                attempts: options.attempts || 3,
                backoff: options.backoff || {
                    type: "exponential",
                    delay: 2000,
                },
                ...options,
            }
        );


        return job;
    } catch (error) {
        console.error("Failed to add email job:", error.message);
        throw error;
    }
};

/**
 * Get job status
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} - Job state and progress
 */
export const getEmailJobStatus = async (jobId) => {
    try {
        const queue = getEmailQueue();
        const job = await queue.getJob(jobId);

        if (!job) return null;

        return {
            id: job.id,
            state: await job.getState(),
            progress: job.progress(),
            attempts: job.attemptsMade,
            failedReason: job.failedReason,
        };
    } catch (error) {
        console.error("Failed to get job status:", error.message);
        return null;
    }
};

/**
 * Close the email queue and worker
 */
export const closeEmailQueue = async () => {
    try {
        if (emailWorker) {
            await emailWorker.close();
            emailWorker = null;
        }
        if (emailQueue) {
            await emailQueue.close();
            emailQueue = null;
        }
    } catch (error) {
        console.error("Error closing email queue:", error.message);
    }
};
