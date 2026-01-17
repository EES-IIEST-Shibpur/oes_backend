import { Exam, ExamAttempt, Question, Option, StudentAnswer, NumericalAnswer, User, ExamQuestion } from "../association/index.js";
import { calculateExamScore } from "../../services/examScore.service.js";

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

// Get score only (simple view)
export const getMyScore = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user.userId;

        const attempt = await ExamAttempt.findOne({
            where: { examId, userId },
            include: [
                {
                    model: Exam,
                    attributes: ["id", "title", "endTime"]
                }
            ],
            attributes: ["id", "examId", "score", "status", "submittedAt", "startedAt"],
        });

        if (!attempt) {
            return res.status(404).json({ message: "No attempt found" });
        }

        if (attempt.status === "IN_PROGRESS") {
            return res.status(400).json({ message: "Exam not yet submitted" });
        }

        // Check if results are available
        if (new Date() < attempt.Exam.endTime) {
            return res.status(403).json({
                message: "Results will be available after exam ends",
            });
        }

        // Check if score is calculated
        if (attempt.score === null) {
            return res.status(202).json({
                message: "Score calculation in progress. Please check back later.",
                attemptId: attempt.id,
                status: attempt.status,
            });
        }

        res.status(200).json({
            attemptId: attempt.id,
            examId,
            examTitle: attempt.Exam.title,
            score: attempt.score,
            status: attempt.status,
            submittedAt: attempt.submittedAt,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Server error: Unable to fetch score"
        });
    }
};

// Get detailed result with analysis (includes questions, answers, correct answers)
export const getMyResult = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user.userId;

        // Fetch exam attempt
        const attempt = await ExamAttempt.findOne({
            where: { examId, userId },
            include: [
                {
                    model: Exam,
                    attributes: ["id", "title", "durationMinutes", "endTime"]
                }
            ],
        });

        if (!attempt) {
            return res.status(404).json({ message: "No attempt found" });
        }

        if (attempt.status === "IN_PROGRESS") {
            return res.status(400).json({ message: "Exam not yet submitted" });
        }

        // Check if results are available
        if (new Date() < attempt.Exam.endTime) {
            return res.status(403).json({
                message: "Results will be available after exam ends",
            });
        }

        // Check if score is calculated
        if (attempt.score === null) {
            return res.status(202).json({
                message: "Score calculation in progress. Please check back later.",
                attemptId: attempt.id,
                status: attempt.status,
            });
        }

        // Fetch all exam questions with details
        const examQuestions = await ExamQuestion.findAll({
            where: { examId },
            include: [
                {
                    model: Question,
                    as: "question",
                    include: [
                        {
                            model: Option,
                            as: "options",
                            attributes: ["id", "text", "isCorrect"],
                        },
                        {
                            model: NumericalAnswer,
                            as: "numericalAnswer",
                            attributes: ["value", "tolerance"],
                        }
                    ],
                }
            ],
            order: [["questionOrder", "ASC"]],
        });

        // Fetch student answers
        const studentAnswers = await StudentAnswer.findAll({
            where: { examAttemptId: attempt.id },
        });

        const answerMap = new Map(
            studentAnswers.map(ans => [ans.questionId, ans])
        );

        // Format questions with student answers and correct answers
        const formattedQuestions = examQuestions.map(eq => {
            const question = eq.question;
            const studentAnswer = answerMap.get(question.id);

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
                questionOrder: eq.questionOrder,
                statement: question.statement,
                questionType: question.questionType,
                marks: eq.marksForEachQuestion,
                negativeMarks: question.negativeMarks,
                options: question.questionType !== "NUMERICAL" ? question.options.map(opt => ({
                    id: opt.id,
                    text: opt.text,
                    isCorrect: opt.isCorrect,
                })) : [],
                studentAnswer: studentAnswer ? {
                    selectedOptionIds: studentAnswer.selectedOptionIds || null,
                    numericalAnswer: studentAnswer.numericalAnswer || null,
                    marksObtained: studentAnswer.marksObtained,
                } : {
                    selectedOptionIds: null,
                    numericalAnswer: null,
                    marksObtained: 0,
                },
                correctAnswer,
            };
        });

        const totalQuestions = examQuestions.length;
        const totalMarks = examQuestions.reduce((sum, eq) => sum + eq.marksForEachQuestion, 0);
        const percentage = totalMarks > 0 ? Math.round((attempt.score / totalMarks) * 100) : 0;

        res.status(200).json({
            attemptId: attempt.id,
            examId,
            examTitle: attempt.Exam.title,
            score: attempt.score,
            totalQuestions,
            totalMarks,
            percentage,
            status: attempt.status,
            submittedAt: attempt.submittedAt,
            startedAt: attempt.startedAt,
            durationMinutes: attempt.Exam.durationMinutes,
            questions: formattedQuestions,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            message: "Server error: Unable to fetch result"
        });
    }
};

export const dummyResultCalculator = async (req, res) => {
    try {
        const userId = req.user.userId;
        const examId = req.params.examId;

        // Call service with all validations handled inside
        const result = await calculateExamScore(examId, userId);

        if (!result.success) {
            // Map error types to appropriate HTTP status codes
            const statusCodes = {
                NOT_FOUND: 404,
                NOT_SUBMITTED: 400,
                NO_QUESTIONS: 404,
                SERVER_ERROR: 500,
            };

            const statusCode = statusCodes[result.error] || 500;
            return res.status(statusCode).json({
                message: result.message,
                error: result.error,
            });
        }

        // Success response
        res.status(200).json({
            message: result.message,
            ...result.data,
            alreadyCalculated: result.alreadyCalculated,
        });

    } catch (error) {
        console.error("Error in dummyResultCalculator:", error);
        res.status(500).json({
            message: "Server error: Unable to calculate result",
        });
    }
};
