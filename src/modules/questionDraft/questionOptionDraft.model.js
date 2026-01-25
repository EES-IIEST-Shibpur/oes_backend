import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * QuestionOptionDraft Model
 * 
 * Represents draft options for a draft question.
 * Similar to Option model, but linked to QuestionDraft instead of Question.
 * 
 * Contains both AI-predicted and admin-editable fields.
 */
const QuestionOptionDraft = sequelize.define(
    "QuestionOptionDraft",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },

        // Foreign key to draft question
        draftQuestionId: {
            type: DataTypes.UUID,
            allowNull: false,
        },

        // ============ AI PREDICTED FIELDS (READ-ONLY) ============

        predicted_text: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        predicted_isCorrect: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },

        // Confidence score for this specific option (0-100)
        predicted_confidence: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
            comment: "AI confidence score 0-100 for option correctness",
        },

        // ============ ADMIN EDITABLE FIELDS (FINAL_*) ============

        final_text: {
            type: DataTypes.STRING,
            allowNull: true, // Null until admin reviews
        },

        final_isCorrect: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },

        // ============ OPTION METADATA ============

        // Position in options list (0-indexed)
        order: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        // Track if admin manually edited this option
        isEdited: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },

        // Admin notes for this specific option
        adminNotes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        tableName: "question_option_drafts",
        timestamps: false,
    }
);

export default QuestionOptionDraft;
