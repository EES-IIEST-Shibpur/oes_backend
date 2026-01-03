import {
    Exam,
    ExamAttempt,
    Question,
    Option,
    NumericalAnswer,
    StudentAnswer
} from "../association/index.js";

import { getHardEndTime } from "../../utils/examTime.util.js";
import { calculateExamScore } from "../../services/examScore.service.js";

//Auto-submit attempt helper function
const autoSubmitAttempt = async (attempt) => {
    attempt.status = "AUTO_SUBMITTED";
    attempt.submittedAt = new Date();
    await attempt.save();
};

//Start exam
export const startExam = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user.userId;

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
            return res.status(400).json({ message: "Exam already started" });
        }

        const attempt = await ExamAttempt.create({
            examId,
            userId,
        });

        res.status(201).json({
            success: true,
            message: "Exam started",
            attemptId: attempt.id,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: "Server Error: Unable to start exam",
        });
    }
};

//Load exam questions for an active attempt
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
                attributes: ["id", "text", "type"],
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

        const now = new Date();
        const hardEnd = getHardEndTime(exam, attempt);

        const remainingSeconds = Math.max(
            0,
            Math.floor((hardEnd - now) / 1000)
        );

        res.status(200).json({
            success: true,
            message: "Exam loaded",
            exam,
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

        const hardEnd = getHardEndTime(attempt.Exam, attempt);

        if (new Date() > hardEnd) {
            await autoSubmitAttempt(attempt);
            return res.status(403).json({
                message: "Time over. Exam auto-submitted.",
            });
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
        });

        const score = await calculateExamScore(answers);

        attempt.status = "SUBMITTED";
        attempt.submittedAt = new Date();
        attempt.score = score;

        await attempt.save();

        res.status(200).json({
            message: "Exam submitted successfully",
            score,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server Error: Unable to submit exam",
        });
    }
};