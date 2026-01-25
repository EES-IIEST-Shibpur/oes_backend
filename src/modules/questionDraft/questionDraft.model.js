import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * QuestionDraft Model
 * 
 * Represents an individual draft question extracted by AI.
 * Contains both AI-predicted fields and admin-editable final_* fields.
 * 
 * IMPORTANT DESIGN:
 * - AI output goes into: predicted_* fields (read-only for admin UI)
 * - Admin edits go into: final_* fields (used when confirming)
 * - Low confidence fields must be visually flagged in UI
 * 
 * Status: PENDING → MARKED_READY → CONFIRMED (when admin confirms)
 *         PENDING → DISCARDED (when admin discards)
 */
const QuestionDraft = sequelize.define(
    "QuestionDraft",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },

        // Foreign key to batch
        batchId: {
            type: DataTypes.UUID,
            allowNull: false,
        },

        // ============ AI PREDICTED FIELDS (READ-ONLY) ============

        predicted_statement: {
            type: DataTypes.TEXT,
            allowNull: false,
        },

        predicted_questionType: {
            type: DataTypes.ENUM("SINGLE_CORRECT", "MULTIPLE_CORRECT", "NUMERICAL"),
            allowNull: false,
        },

        predicted_domain: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        predicted_difficulty: {
            type: DataTypes.ENUM("EASY", "MEDIUM", "HARD"),
            defaultValue: "MEDIUM",
        },

        // Confidence score (0-100) for the entire question
        predicted_confidence: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
            comment: "AI confidence score 0-100. Flags <60% in UI",
        },

        // ============ ADMIN EDITABLE FIELDS (FINAL_*) ============
        // These are what gets written to production when confirmed

        final_statement: {
            type: DataTypes.TEXT,
            allowNull: true, // Null until admin reviews
        },

        final_questionType: {
            type: DataTypes.ENUM("SINGLE_CORRECT", "MULTIPLE_CORRECT", "NUMERICAL"),
            allowNull: true,
        },

        final_domain: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        final_marks: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },

        final_negativeMarks: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },

        final_difficulty: {
            type: DataTypes.ENUM("EASY", "MEDIUM", "HARD"),
            defaultValue: "MEDIUM",
        },

        // ============ DRAFT METADATA ============

        // Track which fields admin has manually edited
        editedFields: {
            type: DataTypes.JSON,
            defaultValue: [],
            comment: "Array of field names edited by admin, e.g., ['final_statement', 'final_domain']",
        },

        // Admin review notes
        adminNotes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

        // Draft status workflow
        status: {
            type: DataTypes.ENUM("PENDING", "MARKED_READY", "CONFIRMED", "DISCARDED"),
            defaultValue: "PENDING",
        },

        // Order within batch (for UI display)
        orderInBatch: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    },
    {
        tableName: "question_drafts",
        timestamps: true,
    }
);

export default QuestionDraft;
