import {
    Exam,
    ExamAttempt,
    Question,
    Option,
    StudentAnswer,
    ExamQuestion
} from "../association/index.js";

import { getHardEndTime } from "../../utils/examTime.util.js";
import { submitAttempt } from "../../services/examSubmission.service.js";

//Auto-submit attempt helper function
const autoSubmitAttempt = async (attempt) => {
    attempt.status = "AUTO_SUBMITTED";
    attempt.submittedAt = new Date();
    await attempt.save();
};

//Start exam
export const startExam = async (req, res) => {
    const { examId } = req.params;
    const userId = req.user.userId;

    try {
        const exam = await Exam.findByPk(examId);

        if (!exam || exam.state !== "PUBLISHED") {
            return res.status(400).json({ message: "Exam not available" });
        }

        const now = new Date();
        if (now < exam.startTime || now > exam.endTime) {
            return res.status(400).json({ message: "Exam not active" });
        }

        const existingAttempt = await ExamAttempt.findOne({
            where: { examId, userId },
        });

        if (existingAttempt) {
            return res.status(400).json({
                message: "You have already attempted this exam",
            });
        }


        const attempt = await sequelize.transaction(async (t) => {
            return await ExamAttempt.create(
                { examId, userId },
                { transaction: t }
            );
        });

        return res.status(201).json({
            success: true,
            message: "Exam started",
            attemptId: attempt.id,
        });
    } catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") {
            return res.status(400).json({
                message: "Exam already started",
            });
        }

        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server Error: Unable to start exam",
        });
    }
};

//Load exam questions for an active attempt including saved answers
export const getExamForAttempt = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user.userId;

        const attempt = await ExamAttempt.findOne({
            where: { examId, userId, status: "IN_PROGRESS" },
        });

        if (!attempt) {
            return res.status(403).json({ message: "No active attempt" });
        }

        const exam = await Exam.findByPk(examId, {
            include: {
                model: Question,
                as: "questions",
                attributes: ["id", "text", "type", "questionType"],
                include: {
                    model: Option,
                    as: "options",
                    attributes: ["id", "text"],
                },
                through: {
                    attributes: ["questionOrder", "marksForEachQuestion"],
                },
            },
            order: [[{ model: Question, as: "questions" }, "questionOrder", "ASC"]],
        });

        // Load any saved student answers for this attempt
        const savedAnswers = await StudentAnswer.findAll({
            where: { examAttemptId: attempt.id },
        });

        const answerMap = {};
        savedAnswers.forEach(ans => {
            answerMap[ans.questionId] = {
                selectedOptionIds: ans.selectedOptionIds,
                numericalAnswer: ans.numericalAnswer,
            };
        });

        const questionsWithAnswers = exam.questions.map(q => ({
            ...q.toJSON(),
            studentAnswer: answerMap[q.id] || null,
        }));

        // Calculate remaining time
        const now = new Date();
        const hardEnd = getHardEndTime(exam, attempt);
        const remainingSeconds = Math.max(0, Math.floor((hardEnd - now) / 1000));

        if (remainingSeconds === 0) {
            await autoSubmitAttempt(attempt);
            return res.status(403).json({
                message: "Time over. Exam auto-submitted.",
            });
        }

        res.status(200).json({
            success: true,
            message: "Exam loaded",
            exam: {
                ...exam.toJSON(),
                questions: questionsWithAnswers,
            },
            attemptId: attempt.id,
            remainingSeconds,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: "Server Error: Unable to load exam",
        });
    }
};

// Save answer
export const saveAnswer = async (req, res) => {
    try {
        const { examId } = req.params;
        const { questionId, selectedOptionIds, numericalAnswer } = req.body;
        const userId = req.user.userId;

        const attempt = await ExamAttempt.findOne({
            where: { examId, userId, status: "IN_PROGRESS" },
            include: Exam,
        });

        if (!attempt) {
            return res.status(403).json({ message: "Attempt not active" });
        }

        const hardEnd = getHardEndTime(attempt.Exam, attempt);

        if (new Date() > hardEnd) {
            await autoSubmitAttempt(attempt);
            return res.status(403).json({
                message: "Time over. Exam auto-submitted.",
            });
        }

        const question = await Question.findByPk(questionId);

        if (!question) {
            return res.status(404).json({ message: "Question not found" });
        }

        const examQuestion = await ExamQuestion.findOne({
            where: { examId, questionId },
        });

        if (!examQuestion) {
            return res.status(400).json({
                message: "Question does not belong to this exam",
            });
        }


        if (question.questionType === "SINGLE_CORRECT") {
            if (
                Array.isArray(selectedOptionIds) &&
                selectedOptionIds.length > 1
            ) {
                return res.status(400).json({
                    message:
                        "Only one option can be selected for SINGLE_CORRECT question",
                });
            }
        }

        if (question.questionType === "NUMERICAL") {
            if (typeof numericalAnswer !== "number") {
                return res.status(400).json({
                    message: "Numerical answer is required for this question",
                });
            }
        }

        if (question.questionType !== "NUMERICAL" && numericalAnswer !== undefined) {
            return res.status(400).json({ message: "Invalid answer type" });
        }

        await StudentAnswer.upsert({
            examAttemptId: attempt.id,
            questionId,
            selectedOptionIds,
            numericalAnswer,
        });

        res.status(200).json({
            success: true,
            message: "Answer saved",
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: "Server Error: Unable to save answer",
        });
    }
};

//Submit exam
export const submitExam = async (req, res) => {
    const { examId } = req.params;
    const userId = req.user.userId;

    const attempt = await ExamAttempt.findOne({
        where: { examId, userId, status: "IN_PROGRESS" },
    });

    if (!attempt) {
        return res.status(400).json({ message: "No active attempt" });
    }

    await submitAttempt(attempt, "SUBMITTED");

    res.status(200).json({
        message: "Exam submitted successfully",
        score: attempt.score,
    });
};