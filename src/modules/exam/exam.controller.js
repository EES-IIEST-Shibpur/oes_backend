import { Exam, Question, ExamQuestion } from "../association/index.js";

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

        const exam = await Exam.create({
            title,
            description,
            durationMinutes,
            startTime,
            endTime,
            createdBy: req.user.userId,
            state: "DRAFT",
        });

        res.status(201).json({
            success: true,
            message: "Exam created as draft",
            exam,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to create exam",
        });
    }
};

// Add a question to an exam
export const addQuestionToExam = async (req, res) => {
    try {
        const { examId } = req.params;
        const { questionId, questionOrder, marksForEachQuestion } = req.body;

        const exam = await Exam.findByPk(examId);

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found"
            });
        }

        if (exam.state !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: "Cannot modify a published or closed exam",
            });
        }

        const examQuestion = await ExamQuestion.create({
            examId,
            questionId,
            questionOrder,
            marksForEachQuestion,
        });

        res.status(201).json({
            success: true,
            message: "Question added to exam",
            examQuestion,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to add question to exam"
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

        res.status(200).json({
            success: true,
            exam
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to retrieve exam details"
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
        console.error(error.message);
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
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: "Server error: Failed to delete exam"
        });
    }
};