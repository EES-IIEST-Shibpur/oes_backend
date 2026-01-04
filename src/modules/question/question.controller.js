import sequelize from "../../config/db.js";
import { Question, Option, NumericalAnswer } from "../association/index.js";

// Create a new question
export const createQuestion = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    let {
      statement,
      questionType,
      domain,
      marks = 1,
      negativeMarks = 0,
      difficulty = "MEDIUM",
      options,
      numericalAnswer,
      tolerance = 0,
    } = req.body;

    // Normalize inputs
    questionType = questionType?.toUpperCase();
    difficulty = difficulty?.toUpperCase();
    domain = domain?.toLowerCase();

    if (!statement || !questionType || !domain) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    // Validate based on question type
    if (
      questionType === "SINGLE_CORRECT" ||
      questionType === "MULTIPLE_CORRECT"
    ) {
      if (!Array.isArray(options) || options.length === 0) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Options are required for MCQ questions",
        });
      }

      if (options.some(o => !o.text)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Option text cannot be empty",
        });
      }

      const correctCount = options.filter(o => o.isCorrect).length;

      if (questionType === "SINGLE_CORRECT" && correctCount !== 1) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "SINGLE_CORRECT must have exactly one correct option",
        });
      }

      if (questionType === "MULTIPLE_CORRECT" && correctCount < 1) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "MULTIPLE_CORRECT must have at least one correct option",
        });
      }
    }

    if (questionType === "NUMERICAL") {
      if (numericalAnswer === undefined || numericalAnswer === null) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Numerical answer is required",
        });
      }
    }

    // Create Question
    const question = await Question.create(
      {
        statement,
        questionType,
        domain,
        marks,
        negativeMarks,
        difficulty,
      },
      { transaction: t }
    );

    if (
      questionType === "SINGLE_CORRECT" ||
      questionType === "MULTIPLE_CORRECT"
    ) {
      const optionRecords = options.map((opt, index) => ({
        questionId: question.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
        order: index + 1,
      }));

      await Option.bulkCreate(optionRecords, { transaction: t });
    }

    if (questionType === "NUMERICAL") {
      await NumericalAnswer.create(
        {
          questionId: question.id,
          value: numericalAnswer,
          tolerance,
        },
        { transaction: t }
      );
    }

    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Question created successfully",
      data: { id: question.id },
    });
  } catch (error) {
    await t.rollback();
    console.error("Create question error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error: Failed to create question",
    });
  }
};

// Get all questions with optional filters
export const getQuestions = async (req, res) => {
  try {
    let {
      domain,
      difficulty,
      questionType,
      page = 1,
      limit = 10,
    } = req.query;

    domain = domain?.toLowerCase();
    difficulty = difficulty?.toUpperCase();
    questionType = questionType?.toUpperCase();

    page = Math.max(parseInt(page, 10), 1);
    limit = Math.min(parseInt(limit, 10), 100); // safety cap
    const offset = (page - 1) * limit;

    const where = {};
    if (domain) where.domain = domain;
    if (difficulty) where.difficulty = difficulty;
    if (questionType) where.questionType = questionType;

    const { rows: questions, count: total } =
      await Question.findAndCountAll({
        where,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          { model: Option, as: "options" },
          { model: NumericalAnswer, as: "numericalAnswer" },
        ],
      });

    return res.status(200).json({
      success: true,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
      data: questions,
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to fetch questions",
    });
  }
};

// Get a question by ID
export const getQuestionById = async (req, res) => {
  try {
    const { id: questionId } = req.params;

    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: "Question ID is required",
      });
    }

    // First fetch only to determine questionType
    const baseQuestion = await Question.findByPk(questionId, {
      attributes: ["id", "questionType"],
    });

    if (!baseQuestion) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const include = [];

    if (baseQuestion.questionType !== "NUMERICAL") {
      include.push({ model: Option, as: "options" });
    } else {
      include.push({
        model: NumericalAnswer,
        as: "numericalAnswer",
      });
    }

    const fullQuestion = await Question.findByPk(questionId, {
      include,
    });

    return res.status(200).json({
      success: true,
      data: fullQuestion,
    });
  } catch (error) {
    console.error("Error fetching question by ID:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to fetch question",
    });
  }
};

// Update a question by ID
export const updateQuestion = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      statement,
      domain,
      marks,
      negativeMarks,
      difficulty,
      options,
      numericalAnswer,
      tolerance = 0,
    } = req.body;

    const question = await Question.findByPk(id, { transaction: t });

    if (!question) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // 1. update question fields
    await question.update(
      { statement, domain, marks, negativeMarks, difficulty },
      { transaction: t }
    );

    // 2. MCQ update
    if (question.questionType !== "NUMERICAL" && options) {
      await Option.destroy({
        where: { questionId: id },
        transaction: t,
      });

      const optionRecords = options.map((opt, index) => ({
        questionId: id,
        text: opt.text,
        isCorrect: opt.isCorrect,
        order: index + 1,
      }));

      await Option.bulkCreate(optionRecords, { transaction: t });
    }

    // 3. Numerical update
    if (question.questionType === "NUMERICAL" && numericalAnswer !== undefined) {
      await NumericalAnswer.upsert(
        {
          questionId: id,
          value: numericalAnswer,
          tolerance,
        },
        { transaction: t }
      );
    }

    await t.commit();

    return res.status(200).json({
      success: true,
      message: "Question updated successfully",
    });
  } catch (error) {
    await t.rollback();
    console.error("Error updating question:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error: Failed to update question",
    });
  }
};

// Delete a question by ID
export const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findByPk(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    await question.destroy(); // cascades to options & numerical answer

    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting question:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to delete question",
    });
  }
};