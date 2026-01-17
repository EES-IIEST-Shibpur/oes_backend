import sequelize from "../config/db.js";
import { ExamAttempt } from "../modules/association/index.js";
import { addScoreCalculationJob } from "./scoreCalculationQueue.service.js";

/**
 * Submit an exam attempt without score calculation
 * @param {number} attemptId - ExamAttempt ID
 * @param {String} submitType - SUBMITTED | AUTO_SUBMITTED
 * @returns {Promise<Object>} - Updated attempt
 */
export const submitExamWithoutScore = async (attemptId, submitType = "SUBMITTED") => {
    return await sequelize.transaction(async (t) => {
        // Fetch and lock the attempt
        const attempt = await ExamAttempt.findByPk(attemptId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!attempt) {
            throw new Error("Attempt not found");
        }

        if (attempt.status !== "IN_PROGRESS") {
            throw new Error("Attempt already submitted");
        }

        // Update status and submission time
        attempt.status = submitType;
        attempt.submittedAt = new Date();
        await attempt.save({ transaction: t });

        return {
            success: true,
            attempt: attempt.toJSON(),
            alreadySubmitted: false,
        };
    });
};

/**
 * Submit an exam attempt (manual or auto)
 * Only changes the status and queues score calculation
 * @param {Object} attempt - ExamAttempt instance
 * @param {String} submitType - SUBMITTED | AUTO_SUBMITTED
 * @returns {Promise<Object>} - Updated attempt and job
 */
export const submitAttempt = async (attempt, submitType) => {
    return await sequelize.transaction(async (t) => {
        await attempt.reload({ transaction: t, lock: t.LOCK.UPDATE });

        if (attempt.status !== "IN_PROGRESS") {
            return { attempt, job: null, alreadySubmitted: true }; // already submitted
        }

        // Update status and submission time
        attempt.status = submitType;
        attempt.submittedAt = new Date();

        await attempt.save({ transaction: t });

        return { attempt, job: null, alreadySubmitted: false };
    });
};

/**
 * Submit attempt and queue score calculation
 * @param {Object} attempt - ExamAttempt instance
 * @param {String} submitType - SUBMITTED | AUTO_SUBMITTED
 * @returns {Promise<Object>} - Updated attempt and queued job
 */
export const submitAttemptAndQueueScore = async (attempt, submitType) => {
    const result = await submitAttempt(attempt, submitType);
    
    if (!result.alreadySubmitted) {
        // Queue score calculation after submission
        const job = await addScoreCalculationJob(attempt.id);
        result.job = job;
    }
    
    return result;
};