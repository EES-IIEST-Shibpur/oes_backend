import cron from "node-cron";
import { Exam, ExamAttempt } from "../modules/association/index.js";
import { getHardEndTime } from "../utils/examTime.util.js";
import { addScoreCalculationJob } from "../services/scoreCalculationQueue.service.js";

// Cron job to auto-submit overdue exam attempts every minute
cron.schedule("*/1 * * * *", async () => {
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

        // Queue score calculation
        try {
          await addScoreCalculationJob(attempt.id);
          console.log(
            `Score calculation queued for attempt ${attempt.id}`
          );
        } catch (error) {
          console.error(
            `Failed to queue score calculation for attempt ${attempt.id}:`,
            error.message
          );
        }
      }
    }
  } catch (error) {
    console.error("Auto-submit cron error:", error.message);
  }
});