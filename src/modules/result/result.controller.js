import { Exam, ExamAttempt, Question, Option, StudentAnswer } from "../association/index.js";

// Get my result
export const getMyResult = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user.userId;

        const exam = await Exam.findByPk(examId);
        if (!exam) {
            return res.status(404).json({ message: "Exam not found" });
        }

        if (new Date() < exam.endTime) {
            return res.status(403).json({
                message: "Results will be available after exam ends",
            });
        }

        const attempt = await ExamAttempt.findOne({
            where: { examId, userId },
            include: {
                model: StudentAnswer,
                as: "answers",
                include: {
                    model: Question,
                    include: { model: Option, as: "options" },
                },
            },
        });

        if (!attempt) {
            return res.status(404).json({ message: "No attempt found" });
        }

        res.status(200).json({
            examId,
            score: attempt.score,
            status: attempt.status,
            submittedAt: attempt.submittedAt,
            answers: attempt.answers,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Server error: Unable to fetch result"
        });
    }
};