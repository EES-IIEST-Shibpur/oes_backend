import { Exam, ExamAttempt, Question, Option, StudentAnswer, NumericalAnswer } from "../association/index.js";

// Get all my attempted exams (list view)
export const getMyAttempts = async (req, res) => {
    try {
        const userId = req.user.userId;

        const attempts = await ExamAttempt.findAll({
            where: { userId },
            include: [
                {
                    model: Exam,
                    attributes: ["id", "title", "durationMinutes"],
                }
            ],
            attributes: ["id", "examId", "score", "status", "submittedAt", "startedAt"],
            order: [["submittedAt", "DESC"]],
            raw: false,
        });

        if (attempts.length === 0) {
            return res.status(200).json({
                data: [],
                message: "No exam attempts found"
            });
        }

        // Enrich with exam details and calculate percentage
        const enrichedAttempts = attempts.map(attempt => {
            const exam = attempt.Exam;
            // Get total questions for this exam - approximate from score calculation
            // In real scenario, you'd store totalQuestions in exam or question_count
            return {
                attemptId: attempt.id,
                examId: attempt.examId,
                examTitle: exam.title,
                score: attempt.score,
                status: attempt.status,
                submittedAt: attempt.submittedAt,
                startedAt: attempt.startedAt,
                durationMinutes: exam.durationMinutes,
            };
        });

        res.status(200).json({
            data: enrichedAttempts,
            count: enrichedAttempts.length,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Server error: Unable to fetch attempts"
        });
    }
};

// Get my result (detail view for specific exam)
export const getMyResult = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user.userId;

        // Fetch exam details
        const exam = await Exam.findByPk(examId);
        if (!exam) {
            return res.status(404).json({ message: "Exam not found" });
        }

        if (new Date() < exam.endTime) {
            return res.status(403).json({
                message: "Results will be available after exam ends",
            });
        }

        // Fetch exam attempt with score
        const attempt = await ExamAttempt.findOne({
            where: { examId, userId },
            attributes: ["id", "examId", "userId", "score", "status", "submittedAt", "startedAt"],
        });

        if (!attempt) {
            return res.status(404).json({ message: "No attempt found" });
        }

        // Check if attempt is completed
        if (attempt.status === "IN_PROGRESS") {
            return res.status(400).json({ message: "Exam not yet submitted" });
        }

        // Fetch all questions for this exam with student answers
        const questions = await Question.findAll({
            include: [
                {
                    model: Exam,
                    as: "exams",
                    where: { id: examId },
                    attributes: [],
                    through: { attributes: [] },
                },
                {
                    model: Option,
                    as: "options",
                    attributes: ["id", "text", "isCorrect"],
                },
                {
                    model: NumericalAnswer,
                    attributes: ["value", "tolerance"],
                },
                {
                    model: StudentAnswer,
                    where: { examAttemptId: attempt.id },
                    required: false,
                    attributes: ["selectedOptionIds", "numericalAnswer", "marksObtained"],
                },
            ],
            attributes: ["id", "text", "questionType", "marks", "negativeMarks"],
            order: [["createdAt", "ASC"]],
        });

        // Format questions with student answers and correct answers
        const formattedQuestions = questions.map(q => {
            const question = q.toJSON();
            const studentAnswer = question.StudentAnswers?.[0] || null;

            let correctAnswer = null;

            if (question.questionType === "SINGLE_CORRECT") {
                const correctOption = question.options.find(opt => opt.isCorrect);
                correctAnswer = correctOption ? correctOption.id : null;
            } else if (question.questionType === "MULTIPLE_CORRECT") {
                correctAnswer = question.options
                    .filter(opt => opt.isCorrect)
                    .map(opt => opt.id);
            } else if (question.questionType === "NUMERICAL") {
                correctAnswer = question.NumericalAnswer ? {
                    value: question.NumericalAnswer.value,
                    tolerance: question.NumericalAnswer.tolerance,
                } : null;
            }

            return {
                questionId: question.id,
                text: question.text,
                questionType: question.questionType,
                marks: question.marks,
                negativeMarks: question.negativeMarks,
                options: question.questionType !== "NUMERICAL" ? question.options.map(opt => ({
                    id: opt.id,
                    text: opt.text,
                })) : [],
                studentAnswer: studentAnswer ? {
                    selectedOptionIds: studentAnswer.selectedOptionIds || null,
                    numericalAnswer: studentAnswer.numericalAnswer || null,
                    marksObtained: studentAnswer.marksObtained,
                } : null,
                correctAnswer,
            };
        });

        const totalQuestions = questions.length;
        const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
        const percentage = totalMarks > 0 ? Math.round((attempt.score / totalMarks) * 100) : 0;

        res.status(200).json({
            attemptId: attempt.id,
            examId,
            examTitle: exam.title,
            score: attempt.score,
            totalQuestions,
            totalMarks,
            percentage,
            status: attempt.status,
            submittedAt: attempt.submittedAt,
            startedAt: attempt.startedAt,
            durationMinutes: exam.durationMinutes,
            questions: formattedQuestions,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Server error: Unable to fetch result"
        });
    }
};