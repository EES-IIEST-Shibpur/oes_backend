import sequelize from "../../config/db.js";
import {Question, Option, NumericalAnswer} from "../../modules/association/index.js";

// Create a new question
export const createQuestion = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      statement,
      questionType,
      domain,
      marks = 1,
      negativeMarks = 0,
      difficulty = "MEDIUM",
      options,
      numericalAnswer,      // number
      tolerance = 0,        // optional
    } = req.body;

    /* basic validation */
    if (!statement || !questionType || !domain) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    /* create question */
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

    /* MCQ handling */
    if (questionType === "SINGLE_CORRECT" || questionType === "MULTIPLE_CORRECT") {
      if (!options || options.length === 0) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Options are required for MCQ questions",
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

      const optionRecords = options.map((opt, index) => ({
        questionId: question.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
        order: index + 1,
      }));

      await Option.bulkCreate(optionRecords, { transaction: t });
    }

    /* NUMERICAL handling */
    if (questionType === "NUMERICAL") {
      if (numericalAnswer === undefined || numericalAnswer === null) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Numerical answer is required",
        });
      }

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
      data: question,
    });
  } catch (error) {
    await t.rollback();
    console.error("Create question error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create question",
    });
  }
};

// Get all questions with optional filters
export const getQuestions = async (req, res) => {
  try {
    const { domain, difficulty, questionType } = req.query;

    const where = {};
    if (domain) where.domain = domain;
    if (difficulty) where.difficulty = difficulty;
    if (questionType) where.questionType = questionType;

    const questions = await Question.findAll({
      where,
      include: [
        {
          model: Option,
          as: "options",
        },
        {
          model: NumericalAnswer,
        },
      ],
    });

    return res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch questions",
    });
  }
};

// Get a question by ID
export const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findByPk(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const include = [];

    if (question.questionType !== "NUMERICAL") {
      include.push({ model: Option, as: "options" });
    }

    if (question.questionType === "NUMERICAL") {
      include.push({ model: NumericalAnswer });
    }

    const fullQuestion = await Question.findByPk(req.params.id, { include });

    return res.status(200).json({
      success: true,
      data: fullQuestion,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch question",
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
    console.error("Error updating question:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update question",
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
    return res.status(500).json({
      success: false,
      message: "Failed to delete question",
    });
  }
};