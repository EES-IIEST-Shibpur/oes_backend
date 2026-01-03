import sequelize from "../config/db.js";
import {
    ExamAttempt,
    StudentAnswer,
    Question,
    Option,
    NumericalAnswer
} from "../modules/association/index.js";
import { calculateExamScore } from "./examScore.service.js";

/**
 * Submit an exam attempt (manual or auto)
 * @param {Object} attempt - ExamAttempt instance
 * @param {String} submitType - SUBMITTED | AUTO_SUBMITTED
 */
export const submitAttempt = async (attempt, submitType) => {
    return await sequelize.transaction(async (t) => {
        await attempt.reload({ transaction: t, lock: t.LOCK.UPDATE });

        if (attempt.status !== "IN_PROGRESS") {
            return attempt; // already submitted
        }

        const answers = await StudentAnswer.findAll({
            where: { examAttemptId: attempt.id },
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

        const score = await calculateExamScore(answers, t);

        attempt.status = submitType;
        attempt.submittedAt = new Date();
        attempt.score = score;

        await attempt.save({ transaction: t });

        return attempt;
    });
};