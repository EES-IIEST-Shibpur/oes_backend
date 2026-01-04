import { fromUTC, toUTC } from "../../utils/dateTime.util.js";
import { Exam, Question, ExamQuestion } from "../association/index.js";
import sequelize from "../../config/db.js";
import { Op } from "sequelize";

const timezone = "Asia/Kolkata";

// Create a new exam (initially in DRAFT state)
export const createExam = async (req, res) => {
    try {
        const {
            title,
            description,
            durationMinutes,
            startTime,
            endTime,
        } = req.body;

        if (!title || !durationMinutes || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const startUTC = toUTC(startTime, timezone);
        const endUTC = toUTC(endTime, timezone);

        if (startUTC >= endUTC) {
            return res.status(400).json({
                message: "Start time must be before end time",
            });
        }

        const exam = await Exam.create({
            title,
            description,
            durationMinutes,
            startTime: startUTC,
            endTime: endUTC,
            createdBy: req.user.userId,
            state: "DRAFT",
        });

        res.status(201).json({
            success: true,
            message: "Exam created as draft",
            exam,
        });
    } catch (error) {
        console.error("Error creating exam:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to create exam",
        });
    }
};

// Retrieve all exams with their associated questions
export const getExams = async (req, res) => {
    try {

        const exams = await Exam.findAll({
            include: {
                model: Question,
                as: "questions",
                through: {
                    attributes: ["questionOrder", "marksForEachQuestion"],
                },
            },
        });

        const formattedExams = exams.map(exam => {
            const data = exam.toJSON();

            try {
                return {
                    ...data,
                    startTime: data.startTime
                        ? fromUTC(data.startTime, timezone)
                        : null,
                    endTime: data.endTime
                        ? fromUTC(data.endTime, timezone)
                        : null,
                    createdAt: data.createdAt
                        ? fromUTC(data.createdAt, timezone)
                        : null,
                    updatedAt: data.updatedAt
                        ? fromUTC(data.updatedAt, timezone)
                        : null,
                };
            } catch (formatError) {
                console.error(
                    `Date formatting error for exam ${data.id}:`,
                    formatError.message
                );

                // Fail-safe: return raw UTC values instead of crashing
                return {
                    ...data,
                    startTime: data.startTime,
                    endTime: data.endTime,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                };
            }
        });

        res.status(200).json({
            success: true,
            exams: formattedExams,
        });
    } catch (error) {
        console.error("Error retrieving exams:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to retrieve exams",
        });
    }
};

// Update questions in an exam (add/remove)
export const updateQuestionsToExam = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { examId } = req.params;
        const {
            addQuestionIds = [],
            removeQuestionIds = []
        } = req.body;

        if (
            (!Array.isArray(addQuestionIds) || addQuestionIds.length === 0) &&
            (!Array.isArray(removeQuestionIds) || removeQuestionIds.length === 0)
        ) {
            return res.status(400).json({
                success: false,
                message: "addQuestionIds or removeQuestionIds must be provided",
            });
        }

        const exam = await Exam.findByPk(examId, { transaction });

        if (!exam) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Exam not found",
            });
        }

        if (exam.state !== "DRAFT") {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "Cannot modify a published or closed exam",
            });
        }

        // 1Remove questions
        if (Array.isArray(removeQuestionIds) && removeQuestionIds.length > 0) {
            await ExamQuestion.destroy({
                where: {
                    examId,
                    questionId: removeQuestionIds,
                },
                transaction,
            });
        }

        // Add questions
        if (Array.isArray(addQuestionIds) && addQuestionIds.length > 0) {
            // Find last order
            const lastQuestion = await ExamQuestion.findOne({
                where: { examId },
                order: [["questionOrder", "DESC"]],
                transaction,
            });

            let order = lastQuestion ? lastQuestion.questionOrder + 1 : 1;

            // Prevent duplicates
            const existing = await ExamQuestion.findAll({
                where: {
                    examId,
                    questionId: addQuestionIds.map(q => q.questionId),
                },
                transaction,
            });

            if (existing.length > 0) {
                await transaction.rollback();
                return res.status(409).json({
                    success: false,
                    message: "One or more questions already exist in exam",
                });
            }

            const rows = addQuestionIds.map(q => ({
                examId,
                questionId: q.questionId,
                questionOrder: order++,
                marksForEachQuestion: q.marks ?? 1,
            }));

            await ExamQuestion.bulkCreate(rows, { transaction });
        }

        await transaction.commit();

        res.status(200).json({
            success: true,
            message: "Exam questions updated successfully",
        });
    } catch (error) {
        await transaction.rollback();
        console.error("Error updating exam questions:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to update exam questions",
        });
    }
};

// Get exam details by ID, including associated questions
export const getExamById = async (req, res) => {
    try {
        const { examId } = req.params;

        const exam = await Exam.findByPk(examId, {
            include: {
                model: Question,
                as: "questions",
                through: {
                    attributes: ["questionOrder", "marksForEachQuestion"],
                },
            },
        });

        if (!exam) {
            return res.status(404).json({ message: "Exam not found" });
        }

        const examData = exam.toJSON();

        const formattedExam = {
            ...examData,
            startTime: examData.startTime
                ? fromUTC(examData.startTime, timezone)
                : null,
            endTime: examData.endTime
                ? fromUTC(examData.endTime, timezone)
                : null,
            createdAt: examData.createdAt
                ? fromUTC(examData.createdAt, timezone)
                : null,
            updatedAt: examData.updatedAt
                ? fromUTC(examData.updatedAt, timezone)
                : null,
        };

        res.status(200).json({
            success: true,
            exam: formattedExam,
        });
    } catch (error) {
        console.error("Error retrieving exam by ID:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to retrieve exam details",
        });
    }
};

// Update exam details (only if in DRAFT state)
export const updateDraftExamDetails = async (req, res) => {
    try {
        const { examId } = req.params;
        const {
            title,
            description,
            startTime,
            endTime,
            durationMinutes,
        } = req.body;

        const exam = await Exam.findByPk(examId);

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found",
            });
        }

        if (exam.state !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: "Only draft exams can be updated",
            });
        }

        await exam.update({
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(startTime !== undefined && { startTime }),
            ...(endTime !== undefined && { endTime }),
            ...(durationMinutes !== undefined && { durationMinutes }),
        });

        res.status(200).json({
            success: true,
            message: "Exam details updated successfully",
        });
    } catch (error) {
        console.error("Error updating exam details:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to update exam details",
        });
    }
};

// Publish an exam (change state from DRAFT to PUBLISHED)
export const publishExam = async (req, res) => {
    try {
        const { examId } = req.params;

        const exam = await Exam.findByPk(examId);

        if (!exam) {
            return res.status(404).json({ message: "Exam not found" });
        }

        if (exam.state !== "DRAFT") {
            return res.status(400).json({
                message: "Exam is already published or closed",
            });
        }

        const questionCount = await ExamQuestion.count({
            where: { examId },
        });

        if (questionCount === 0) {
            return res.status(400).json({
                message: "Cannot publish exam without questions",
            });
        }

        exam.state = "PUBLISHED";
        await exam.save();

        res.status(200).json({
            success: true,
            message: "Exam published successfully",
            exam,
        });
    } catch (error) {
        console.error("Error publishing exam:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to publish exam"
        });
    }
};

// Delete an exam (only if in DRAFT state)
export const deleteExam = async (req, res) => {
    try {
        const { examId } = req.params;

        const exam = await Exam.findByPk(examId);

        if (!exam) {
            return res.status(404).json({ message: "Exam not found" });
        }

        if (exam.state !== "DRAFT") {
            return res.status(400).json({
                message: "Only draft exams can be deleted",
            });
        }

        await exam.destroy();

        res.status(200).json({ message: "Exam deleted" });
    } catch (error) {
        console.error("Error deleting exam:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to delete exam"
        });
    }
};

//Get live exams
export const getLiveExams = async (req, res) => {
    try {
        const now = new Date(); // UTC

        const exams = await Exam.findAll({
            where: {
                state: "PUBLISHED",
                startTime: { [Op.lte]: now },
                endTime: { [Op.gte]: now },
            },
            order: [["startTime", "ASC"]],
            attributes: [
                "id",
                "title",
                "description",
                "startTime",
                "endTime",
                "durationMinutes",
            ],
        });

        res.status(200).json({
            success: true,
            exams,
        });
    } catch (error) {
        console.error("Error fetching live exams:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to retrieve live exams",
        });
    }
};

//Get upcoming exams
export const getUpcomingExams = async (req, res) => {
    try {
        const now = new Date(); // UTC

        const exams = await Exam.findAll({
            where: {
                state: "PUBLISHED",
                startTime: { [Op.gt]: now },
            },
            order: [["startTime", "ASC"]],
            attributes: [
                "id",
                "title",
                "description",
                "startTime",
                "endTime",
                "durationMinutes",
            ],
        });

        res.status(200).json({
            success: true,
            exams,
        });
    } catch (error) {
        console.error("Error fetching upcoming exams:", error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to retrieve upcoming exams",
        });
    }
};