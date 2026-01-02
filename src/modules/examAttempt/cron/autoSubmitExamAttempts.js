import cron from "node-cron";
import { Exam, ExamAttempt } from "../../association/index.js";
import { getHardEndTime } from "../../../utils/examTime.js";

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
        attempt.status = "AUTO_SUBMITTED";
        attempt.submittedAt = new Date();
        await attempt.save();

        console.log(
          `Auto-submitted attempt ${attempt.id} (exam ${attempt.examId})`
        );
      }
    }
  } catch (error) {
    console.error("Auto-submit cron error:", error.message);
  }
});