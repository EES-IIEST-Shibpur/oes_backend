import cron from "node-cron";
import { Exam, ExamAttempt } from "../modules/association/index.js";
import { getHardEndTime } from "../utils/examTime.util.js";
import { calculateExamScore } from "../services/examScore.service.js";

let cronJob = null;

/**
 * Initialize the auto-submit cron job
 */
export const initializeAutoSubmitCron = () => {
  if (cronJob) {
    return cronJob;
  }

  // Cron job to auto-submit overdue exam attempts every minute
  cronJob = cron.schedule("*/1 * * * *", async () => {
    try {
      const attempts = await ExamAttempt.findAll({
        where: { status: "IN_PROGRESS" },
        include: Exam,
      });

      const now = new Date();

      for (const attempt of attempts) {
        const hardEnd = getHardEndTime(attempt.Exam, attempt);

        if (now > hardEnd) {
          // Update status and submission time
          attempt.status = "AUTO_SUBMITTED";
          attempt.submittedAt = new Date();
          await attempt.save();

          // Calculate score immediately
          try {
            await calculateExamScore(attempt.examId, attempt.userId);
          } catch (error) {
            console.error(
              `Failed to calculate score for attempt ${attempt.id}:`,
              error.message
            );
          }
        }
      }
    } catch (error) {
      console.error("Auto-submit cron error:", error.message);
    }
  }, {
    scheduled: false // Don't start automatically
  });
  return cronJob;
};

/**
 * Start the auto-submit cron job
 */
export const startAutoSubmitCron = () => {
  if (!cronJob) {
    initializeAutoSubmitCron();
  }

  if (cronJob && !cronJob.running) {
    cronJob.start();
  }
};

/**
 * Stop the auto-submit cron job
 */
export const stopAutoSubmitCron = () => {
  if (cronJob) {
    cronJob.stop();
  }
};

/**
 * Destroy the cron job completely
 */
export const destroyAutoSubmitCron = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
};