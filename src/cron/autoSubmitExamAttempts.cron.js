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
    console.log("Auto-submit cron job already initialized");
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

          console.log(
            `Auto-submitted attempt ${attempt.id} (exam ${attempt.examId})`
          );

          // Calculate score immediately
          try {
            await calculateExamScore(attempt.examId, attempt.userId);
            console.log(
              `Score calculated for attempt ${attempt.id}`
            );
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

  console.log("Auto-submit cron job initialized (not started)");
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
    console.log("Auto-submit cron job started");
  }
};

/**
 * Stop the auto-submit cron job
 */
export const stopAutoSubmitCron = () => {
  if (cronJob) {
    cronJob.stop();
    console.log("Auto-submit cron job stopped");
  }
};

/**
 * Destroy the cron job completely
 */
export const destroyAutoSubmitCron = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("Auto-submit cron job destroyed");
  }
};