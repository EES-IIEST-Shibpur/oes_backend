import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

/**
 * QuestionDraftBatch Model
 * 
 * Represents a batch of question drafts created from a single ingestion session.
 * Allows tracking of AI-extracted questions before admin confirmation.
 * 
 * Status: PENDING → CONFIRMED (when all questions are confirmed)
 */
const QuestionDraftBatch = sequelize.define(
    "QuestionDraftBatch",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },

        // Batch metadata
        batchName: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        sourceType: {
            type: DataTypes.ENUM("TEXT", "IMAGE", "PDF", "CSV"),
            allowNull: false,
        },

        // Original uploaded filename
        sourceFileName: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        // Batch status tracking
        status: {
            type: DataTypes.ENUM("PENDING", "PARTIALLY_CONFIRMED", "CONFIRMED", "DISCARDED"),
            defaultValue: "PENDING",
        },

        // Tracking extracted question count
        totalDrafts: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },

        confirmedDrafts: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },

        discardedDrafts: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },

        // Admin who created this batch
        createdByAdminId: {
            type: DataTypes.UUID,
            allowNull: false,
        },

        // Processing metadata
        processingNotes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

        // Track if OCR was needed (for images/PDFs)
        ocrApplied: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "question_draft_batches",
        timestamps: true,
    }
);

export default QuestionDraftBatch;
