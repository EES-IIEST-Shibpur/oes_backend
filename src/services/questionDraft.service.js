/**
 * Question Draft Service
 * 
 * Handles all operations related to question drafts:
 * - Creating draft batches and questions
 * - Updating draft fields
 * - Confirming drafts to production
 * - Discarding drafts
 * 
 * Enforces strict separation: AI predictions vs admin edits
 */

import { getSequelizeInstance } from "../config/db.js";
import { QuestionDraftBatch, QuestionDraft, QuestionOptionDraft, Question, Option } from "../modules/association/index.js"

/**
 * Create a new draft batch from AI-extracted questions
 * 
 * @param {Object} params
 * @param {string} params.batchName - Name/description of the batch
 * @param {string} params.sourceType - TEXT | IMAGE | PDF | CSV
 * @param {string} params.sourceFileName - Original filename
 * @param {string} params.adminId - UUID of admin creating batch
 * @param {Array} params.extractedQuestions - Array of AI-extracted questions
 * @param {boolean} params.ocrApplied - Whether OCR was used
 * 
 * @returns {Object} Created batch with all draft questions
 */
export const createDraftBatch = async ({
    batchName,
    sourceType,
    sourceFileName,
    adminId,
    extractedQuestions,
    ocrApplied = false,
}) => {
    const sequelize = getSequelizeInstance();
    const transaction = await sequelize.transaction();

    try {
        // Create the batch
        const batch = await QuestionDraftBatch.create(
            {
                batchName,
                sourceType,
                sourceFileName,
                createdByAdminId: adminId,
                ocrApplied,
                totalDrafts: extractedQuestions.length,
            },
            { transaction }
        );

        // Create draft questions and their options
        for (let i = 0; i < extractedQuestions.length; i++) {
            const aiQuestion = extractedQuestions[i];

            // Create draft question
            const draftQuestion = await QuestionDraft.create(
                {
                    batchId: batch.id,
                    predicted_statement: aiQuestion.statement,
                    predicted_questionType: aiQuestion.questionType,
                    predicted_domain: aiQuestion.domain,
                    predicted_difficulty: aiQuestion.difficulty || "MEDIUM",
                    predicted_confidence: aiQuestion.confidence || 0,
                    orderInBatch: i,
                    // Initialize final fields with AI predictions (admin can edit these)
                    final_statement: aiQuestion.statement,
                    final_questionType: aiQuestion.questionType,
                    final_domain: aiQuestion.domain,
                    final_difficulty: aiQuestion.difficulty || "MEDIUM",
                },
                { transaction }
            );

            // Create draft options
            if (aiQuestion.options && Array.isArray(aiQuestion.options)) {
                for (let j = 0; j < aiQuestion.options.length; j++) {
                    const aiOption = aiQuestion.options[j];

                    await QuestionOptionDraft.create(
                        {
                            draftQuestionId: draftQuestion.id,
                            predicted_text: aiOption.text,
                            predicted_isCorrect: aiOption.isCorrect,
                            predicted_confidence: aiOption.confidence || 0,
                            order: j,
                            final_text: aiOption.text,
                            final_isCorrect: aiOption.isCorrect,
                        },
                        { transaction }
                    );
                }
            }
        }

        await transaction.commit();

        // Fetch the complete batch with all relations
        return await getBatchWithDrafts(batch.id);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Get a batch with all its draft questions and options
 */
export const getBatchWithDrafts = async (batchId) => {
    return await QuestionDraftBatch.findByPk(batchId, {
        include: [
            {
                association: "drafts",
                include: [{ association: "options" }],
            },
        ],
    });
};

/**
 * Get all drafts in a batch
 */
export const getDraftsByBatchId = async (batchId, filters = {}) => {
    const where = { batchId };

    if (filters.status) {
        where.status = filters.status;
    }

    return await QuestionDraft.findAll({
        where,
        include: [{ association: "options" }],
        order: [["orderInBatch", "ASC"]],
    });
};

/**
 * Get a single draft question with options
 */
export const getDraftQuestion = async (draftQuestionId) => {
    return await QuestionDraft.findByPk(draftQuestionId, {
        include: [{ association: "options" }],
    });
};

/**
 * Update admin-editable fields of a draft question
 * 
 * IMPORTANT: This only updates final_* fields, never predicted_* fields
 */
export const updateDraftQuestion = async (draftQuestionId, updates) => {
    const draft = await QuestionDraft.findByPk(draftQuestionId);

    if (!draft) {
        throw new Error("Draft question not found");
    }

    // Only allow updates to final_* fields
    const allowedFields = [
        "final_statement",
        "final_questionType",
        "final_domain",
        "final_marks",
        "final_negativeMarks",
        "final_difficulty",
        "adminNotes",
    ];

    const editedFields = [];
    const updateData = {};

    for (const field of allowedFields) {
        if (field in updates) {
            updateData[field] = updates[field];
            if (field !== "adminNotes") {
                editedFields.push(field);
            }
        }
    }

    // Track which fields were edited by admin
    const currentEdited = draft.editedFields || [];
    const allEdited = [...new Set([...currentEdited, ...editedFields])];

    updateData.editedFields = allEdited;

    await draft.update(updateData);

    return draft;
};

/**
 * Update a draft option
 * 
 * IMPORTANT: This only updates final_* fields
 */
export const updateDraftOption = async (optionId, updates) => {
    const option = await QuestionOptionDraft.findByPk(optionId);

    if (!option) {
        throw new Error("Draft option not found");
    }

    const allowedFields = ["final_text", "final_isCorrect", "adminNotes"];

    const updateData = {};

    for (const field of allowedFields) {
        if (field in updates) {
            updateData[field] = updates[field];
            if (field === "final_text" || field === "final_isCorrect") {
                updateData.isEdited = true;
            }
        }
    }

    await option.update(updateData);

    return option;
};

/**
 * Mark a draft as ready for confirmation
 */
export const markDraftReady = async (draftQuestionId) => {
    const draft = await QuestionDraft.findByPk(draftQuestionId, {
        include: [
            {
                model: QuestionOptionDraft,
                as: "options",
            }
        ]
    });

    if (!draft) {
        throw new Error("Draft question not found");
    }

    // Validate that all required final_* fields are filled
    const validation = validateDraftForConfirmation(draft);

    if (!validation.isValid) {
        const error = new Error("Draft validation failed");
        error.details = validation.errors;
        throw error;
    }

    await draft.update({ status: "MARKED_READY" });

    return draft;
};

/**
 * Discard a draft question
 */
export const discardDraft = async (draftQuestionId) => {
    const draft = await QuestionDraft.findByPk(draftQuestionId);

    if (!draft) {
        throw new Error("Draft question not found");
    }

    const sequelize = getSequelizeInstance();
    const transaction = await sequelize.transaction();

    try {
        await draft.update({ status: "DISCARDED" }, { transaction });

        // Update batch discard count
        const batch = await QuestionDraftBatch.findByPk(draft.batchId, { transaction });

        await batch.update(
            {
                discardedDrafts: batch.discardedDrafts + 1,
            },
            { transaction }
        );

        await transaction.commit();

        return draft;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Confirm a batch of drafts: Create production questions from final_* fields
 * 
 * @param {string} batchId - Batch ID to confirm
 * @param {Array} draftIds - Array of draft IDs to confirm (if null, confirm all MARKED_READY)
 * 
 * @returns {Object} { confirmedCount, failedDrafts, createdQuestions }
 */
export const confirmDraftBatch = async (batchId, draftIds = null) => {
    const sequelize = getSequelizeInstance();
    const transaction = await sequelize.transaction();

    try {
        // Get drafts to confirm
        let draftsToConfirm;

        if (draftIds && draftIds.length > 0) {
            draftsToConfirm = await QuestionDraft.findAll(
                {
                    where: {
                        id: draftIds,
                        batchId,
                    },
                    include: [{ association: "options" }],
                },
                { transaction }
            );
        } else {
            draftsToConfirm = await QuestionDraft.findAll(
                {
                    where: {
                        batchId,
                        status: "MARKED_READY",
                    },
                    include: [{ association: "options" }],
                },
                { transaction }
            );
        }

        const createdQuestions = [];
        const failedDrafts = [];

        for (const draft of draftsToConfirm) {
            try {
                // Validate draft
                const validation = validateDraftForConfirmation(draft);

                if (!validation.isValid) {
                    failedDrafts.push({
                        draftId: draft.id,
                        reason: validation.errors.join("; "),
                    });
                    continue;
                }

                // Create production question from final_* fields
                const question = await Question.create(
                    {
                        statement: draft.final_statement,
                        questionType: draft.final_questionType,
                        domain: draft.final_domain,
                        marks: draft.final_marks,
                        negativeMarks: draft.final_negativeMarks,
                        difficulty: draft.final_difficulty,
                    },
                    { transaction }
                );

                // Create production options
                for (const draftOption of draft.options || []) {
                    await Option.create(
                        {
                            questionId: question.id,
                            text: draftOption.final_text,
                            isCorrect: draftOption.final_isCorrect,
                            order: draftOption.order,
                        },
                        { transaction }
                    );
                }

                // Mark draft as confirmed
                await draft.update({ status: "CONFIRMED" }, { transaction });

                createdQuestions.push({
                    draftId: draft.id,
                    questionId: question.id,
                });
            } catch (error) {
                failedDrafts.push({
                    draftId: draft.id,
                    reason: error.message,
                });
            }
        }

        // Update batch status
        const batch = await QuestionDraftBatch.findByPk(batchId, { transaction });

        const confirmedCount = createdQuestions.length;

        await batch.update(
            {
                confirmedDrafts: batch.confirmedDrafts + confirmedCount,
                status:
                    batch.discardedDrafts + confirmedCount === batch.totalDrafts
                        ? "CONFIRMED"
                        : "PARTIALLY_CONFIRMED",
            },
            { transaction }
        );

        await transaction.commit();

        return {
            success: true,
            confirmedCount,
            failedCount: failedDrafts.length,
            createdQuestions,
            failedDrafts,
        };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Validate a draft is ready for confirmation
 * 
 * Checks that all final_* fields are properly filled
 */
const validateDraftForConfirmation = (draft) => {
    const errors = [];

    if (!draft.final_statement || draft.final_statement.trim().length === 0) {
        errors.push("Question statement is required");
    }

    if (!draft.final_questionType) {
        errors.push("Question type is required");
    }

    if (!draft.final_domain || draft.final_domain.trim().length === 0) {
        errors.push("Domain is required");
    }

    if (!draft.options || draft.options.length < 2) {
        errors.push("Question must have at least 2 options");
    }

    // Validate options
    if (draft.options && draft.options.length > 0) {
        const missingTexts = draft.options.some((o) => !o.final_text || o.final_text.trim().length === 0);

        if (missingTexts) {
            errors.push("All options must have text");
        }

        if (draft.final_questionType !== "NUMERICAL") {
            const correctCount = draft.options.filter((o) => o.final_isCorrect).length;

            if (draft.final_questionType === "SINGLE_CORRECT" && correctCount !== 1) {
                errors.push("SINGLE_CORRECT must have exactly 1 correct option");
            }

            if (draft.final_questionType === "MULTIPLE_CORRECT" && correctCount === 0) {
                errors.push("MULTIPLE_CORRECT must have at least 1 correct option");
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

/**
 * Get batch statistics
 */
export const getBatchStats = async (batchId) => {
    const batch = await QuestionDraftBatch.findByPk(batchId);

    if (!batch) {
        throw new Error("Batch not found");
    }

    const drafts = await QuestionDraft.findAll({
        where: { batchId },
        attributes: ["status"],
    });

    const statusCounts = {
        PENDING: 0,
        MARKED_READY: 0,
        CONFIRMED: 0,
        DISCARDED: 0,
    };

    drafts.forEach((draft) => {
        statusCounts[draft.status]++;
    });

    return {
        batchId: batch.id,
        batchName: batch.batchName,
        totalDrafts: batch.totalDrafts,
        statusCounts,
        confirmedDrafts: batch.confirmedDrafts,
        discardedDrafts: batch.discardedDrafts,
        createdAt: batch.createdAt,
    };
};
