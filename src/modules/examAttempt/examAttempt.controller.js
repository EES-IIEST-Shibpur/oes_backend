import {
    Exam,
    ExamAttempt,
    Question,
    Option,
    StudentAnswer,
    ExamQuestion
} from "../association/index.js";

import { CACHE_KEYS, getOrSetCache } from "../../services/cache.service.js";
import sequelize from "../../config/db.js";
import { calculateExamScore } from "../../services/examScore.service.js";
import { getHardEndTime } from "../../utils/examTime.util.js";

//Auto-submit attempt helper function
const autoSubmitAttempt = async (attempt) => {
    attempt.status = "AUTO_SUBMITTED";
    attempt.submittedAt = new Date();
    await attempt.save();

    // Calculate score immediately (with error handling)
    try {
        await calculateExamScore(attempt.examId, attempt.userId);
    } catch (error) {
        console.error("Error calculating score in auto-submit:", error);
        // Don't throw - submission already happened
    }
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

        const exam = await getOrSetCache(
            CACHE_KEYS.EXAM(examId),
            async () => {
                const record = await Exam.findByPk(examId, {
                    attributes: ["id", "title", "durationMinutes", "startTime", "endTime"],
                });
                return record ? record.toJSON() : null;
            },
            300 // 5 minutes to keep exam metadata reasonably fresh
        );

        if (!exam) {
            return res.status(403).json({ message: "No exams exist" })
        }

        const attempt = await ExamAttempt.findOne({
            where: { examId, userId, status: "IN_PROGRESS" },
        });

        if (!attempt) {
            return res.status(403).json({ message: "No active attempt" });
        }

        const examQuestions = await getOrSetCache(
            CACHE_KEYS.EXAM_QUESTIONS(examId),
            async () => {
                const rows = await ExamQuestion.findAll({
                    where: { examId },
                    order: [["questionOrder", "ASC"]],
                    include: [
                        {
                            model: Question,
                            as: "question",
                            attributes: ["id", "statement", "questionType", "domain"],
                            include: [
                                {
                                    model: Option,
                                    as: "options",
                                    attributes: ["id", "text"],
                                },
                            ],
                        },
                    ],
                });

                return rows.map((eq) => ({
                    id: eq.id,
                    questionId: eq.questionId,
                    questionOrder: eq.questionOrder,
                    marksForEachQuestion: eq.marksForEachQuestion,
                    question: eq.question
                        ? {
                            id: eq.question.id,
                            statement: eq.question.statement,
                            questionType: eq.question.questionType,
                            domain: eq.question.domain,
                            options: (eq.question.options || []).map((opt) => ({
                                id: opt.id,
                                text: opt.text,
                            })),
                        }
                        : null,
                }));
            },
            600 // 10 minutes cache for static exam paper data
        );

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

        const questionsWithStudentAnswers = examQuestions.map(eq => ({
            examQuestionId: eq.id,
            questionOrder: eq.questionOrder,
            marks: eq.marksForEachQuestion,

            ...(eq.question || {}),

            studentAnswer: answerMap[eq.questionId] || null,
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
                id: exam.id,
                title: exam.title,
                questions: questionsWithStudentAnswers,
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

        // normalize numericalAnswer if present
        const normalizedNumerical =
            numericalAnswer !== undefined && numericalAnswer !== null
                ? Number(numericalAnswer)
                : undefined;

        if (question.questionType === "NUMERICAL") {
            if (normalizedNumerical === undefined || Number.isNaN(normalizedNumerical)) {
                return res.status(400).json({
                    message: "Valid numerical answer is required for this question",
                });
            }
        } else {
            if (numericalAnswer !== undefined) {
                return res.status(400).json({
                    message: "Invalid answer type",
                });
            }
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
    try {
        const { examId } = req.params;
        const userId = req.user.userId;

        const attempt = await ExamAttempt.findOne({
            where: { examId, userId, status: "IN_PROGRESS" },
            include: Exam,
        });

        if (!attempt) {
            return res.status(400).json({ message: "No active attempt" });
        }

        // Check if time is still valid
        const hardEnd = getHardEndTime(attempt.Exam, attempt);
        if (new Date() > hardEnd) {
            await autoSubmitAttempt(attempt);
            return res.status(403).json({
                message: "Time over. Exam auto-submitted.",
            });
        }

        // Submit exam with transaction for atomicity
        await sequelize.transaction(async (t) => {
            // Re-fetch with lock to prevent race conditions
            const lockedAttempt = await ExamAttempt.findOne({
                where: { id: attempt.id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (lockedAttempt.status !== "IN_PROGRESS") {
                throw new Error("Attempt already submitted");
            }

            lockedAttempt.status = "SUBMITTED";
            lockedAttempt.submittedAt = new Date();
            await lockedAttempt.save({ transaction: t });
        });

        // Calculate score asynchronously (don't block response)
        calculateExamScore(examId, userId).catch(error => {
            console.error("Error calculating score after submission:", error);
        });

        res.status(200).json({
            success: true,
            message: "Exam submitted successfully. Score will be shown after window time ends.",
            attemptId: attempt.id,
            status: "SUBMITTED",
        });
    } catch (error) {
        console.error(error.message);

        if (error.message === "Attempt already submitted") {
            return res.status(400).json({
                success: false,
                message: "Exam already submitted",
            });
        }

        res.status(500).json({
            success: false,
            message: "Server Error: Unable to submit exam",
        });
    }
};