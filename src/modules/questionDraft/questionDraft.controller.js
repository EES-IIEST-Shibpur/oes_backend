/**
 * Question Draft Controller
 * 
 * Handles HTTP requests for draft question operations.
 * Manages validation, service calls, and response formatting.
 */

import {
    createDraftBatch,
    getDraftsByBatchId,
    getDraftQuestion,
    updateDraftQuestion,
    updateDraftOption as updateDraftOptionService,
    markDraftReady,
    discardDraft,
    confirmDraftBatch,
    getBatchWithDrafts,
    getBatchStats,
} from "../../services/questionDraft.service.js";
import {
    callAIQuestionExtraction,
    performOCR,
    validateExtractedQuestion,
} from "../../services/aiExtraction.service.js";
import {
    validateIngestRequest,
    validateDraftUpdateRequest,
    validateOptionUpdateRequest,
    formatValidationResponse,
} from "../../utils/draftValidation.util.js";

/**
 * POST /api/question-drafts/ingest
 * 
 * Main ingestion endpoint. Accepts multipart input (text, file),
 * performs OCR if needed, calls AI extraction, saves drafts.
 */
export const ingestQuestions = async (req, res) => {
    try {
        const adminId = req.user.userId; // From auth middleware

        // Handle file upload - supports both upload.single() and upload.any()
        // upload.single() populates req.file, upload.any() populates req.files
        const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

        console.log("Req file", req.file?.filename, "source Type", req.body.sourceType, "batchName", req.body.batchName);
        // Validate request
        const validation = validateIngestRequest(req.body, !!uploadedFile);

        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                validation: formatValidationResponse(validation),
            });
        }

        const { sourceType, batchName } = req.body;

        let extractedContent = req.body.text || "";
        let sourceFileName = null;
        let ocrApplied = false;

        // Handle file upload (multipart)
        if (uploadedFile) {
            sourceFileName = uploadedFile.originalname;

            // If image or PDF, perform OCR
            if (["IMAGE", "PDF"].includes(sourceType)) {
                const ocrResult = await performOCR(uploadedFile.buffer, sourceType);

                if (!ocrResult.success) {
                    return res.status(500).json({
                        success: false,
                        message: "OCR extraction failed",
                        error: ocrResult.error,
                    });
                }

                extractedContent = ocrResult.extractedText;
                ocrApplied = true;
            } else if (sourceType === "CSV") {
                // For CSV, file content as string
                extractedContent = uploadedFile.buffer.toString("utf-8");
            }
        }

        if (!extractedContent || extractedContent.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "No content to process. Provide text or upload a file.",
            });
        }

        // Build context for AI extraction (optional metadata)
        const context = {
            batchName: batchName,
            sourceType: sourceType,
            subject: req.body.subject || req.body.domain, // Optional: subject/domain hint
        };

        // Call AI to extract questions
        // SAFETY: AI output goes to draft tables only, never to production
        const aiResponse = await callAIQuestionExtraction(extractedContent, sourceType, context);

        if (!aiResponse.success) {
            return res.status(500).json({
                success: false,
                message: "AI extraction failed",
                error: aiResponse.error,
            });
        }

        // Validate each extracted question
        const validatedQuestions = [];
        const validationErrors = [];

        for (let i = 0; i < aiResponse.questions.length; i++) {
            const question = aiResponse.questions[i];
            const validation = validateExtractedQuestion(question);

            if (validation.isValid) {
                validatedQuestions.push(question);
            } else {
                validationErrors.push({
                    questionIndex: i,
                    statement: question.statement?.substring(0, 50) || "Unknown",
                    errors: validation.errors,
                });
            }
        }

        // Warn if some questions failed validation
        if (validationErrors.length > 0) {
            console.warn(`[Question Ingestion] ${validationErrors.length} questions failed validation`);
        }

        if (validatedQuestions.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid questions extracted",
                validationErrors,
            });
        }

        // Create draft batch with validated questions
        const batch = await createDraftBatch({
            batchName,
            sourceType,
            sourceFileName,
            adminId,
            extractedQuestions: validatedQuestions,
            ocrApplied,
        });

        return res.status(201).json({
            success: true,
            message: `Ingestion successful. ${validatedQuestions.length} draft questions created.`,
            data: batch,
            skippedCount: validationErrors.length,
            validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
        });
    } catch (error) {
        console.error("[Ingest Error]", error);
        return res.status(500).json({
            success: false,
            message: "Ingestion failed",
            error: error.message,
        });
    }
};

/**
 * GET /api/question-drafts/batches/:batchId
 * 
 * Get a complete batch with all draft questions and options
 */
export const getBatch = async (req, res) => {
    try {
        const { batchId } = req.params;

        const batch = await getBatchWithDrafts(batchId);

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: batch,
        });
    } catch (error) {
        console.error("[Get Batch Error]", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch batch",
            error: error.message,
        });
    }
};

/**
 * GET /api/question-drafts
 * 
 * Get drafts by batch, with optional filtering by status
 */
export const getDrafts = async (req, res) => {
    try {
        const { batchId, status } = req.query;

        if (!batchId) {
            return res.status(400).json({
                success: false,
                message: "batchId query parameter is required",
            });
        }

        const drafts = await getDraftsByBatchId(batchId, { status });

        return res.status(200).json({
            success: true,
            count: drafts.length,
            data: drafts,
        });
    } catch (error) {
        console.error("[Get Drafts Error]", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch drafts",
            error: error.message,
        });
    }
};

/**
 * GET /api/question-drafts/:draftQuestionId
 * 
 * Get a single draft question with its options
 */
export const getDraftQuestionDetails = async (req, res) => {
    try {
        const { draftQuestionId } = req.params;

        const draft = await getDraftQuestion(draftQuestionId);

        if (!draft) {
            return res.status(404).json({
                success: false,
                message: "Draft question not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: draft,
        });
    } catch (error) {
        console.error("[Get Draft Question Error]", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch draft question",
            error: error.message,
        });
    }
};

/**
 * GET /api/question-drafts/:draftQuestionId/options
 * 
 * Get options for a draft question
 */
export const getDraftQuestionOptions = async (req, res) => {
    try {
        const { draftQuestionId } = req.params;

        const draft = await getDraftQuestion(draftQuestionId);

        if (!draft) {
            return res.status(404).json({
                success: false,
                message: "Draft question not found",
            });
        }

        return res.status(200).json({
            success: true,
            count: draft.options?.length || 0,
            data: draft.options || [],
        });
    } catch (error) {
        console.error("[Get Options Error]", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch options",
            error: error.message,
        });
    }
};

/**
 * PATCH /api/question-drafts/:draftQuestionId
 * 
 * Update admin-editable fields (final_*) of a draft question
 */
export const updateDraft = async (req, res) => {
    try {
        const { draftQuestionId } = req.params;
        const updates = req.body;

        // Validate request body
        const validation = validateDraftUpdateRequest(updates);

        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                validation: formatValidationResponse(validation),
            });
        }

        const updatedDraft = await updateDraftQuestion(draftQuestionId, updates);

        return res.status(200).json({
            success: true,
            message: "Draft question updated",
            data: updatedDraft,
        });
    } catch (error) {
        console.error("[Update Draft Error]", error);

        if (error.message === "Draft question not found") {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update draft",
            error: error.message,
        });
    }
};

/**
 * PATCH /api/question-drafts/options/:optionId
 * 
 * Update admin-editable fields (final_*) of a draft option
 */
export const updateDraftOption = async (req, res) => {
    try {
        const { optionId } = req.params;
        const updates = req.body;

        // Validate request body
        const validation = validateOptionUpdateRequest(updates);

        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                validation: formatValidationResponse(validation),
            });
        }

        const updatedOption = await updateDraftOptionService(optionId, updates);

        return res.status(200).json({
            success: true,
            message: "Draft option updated",
            data: updatedOption,
        });
    } catch (error) {
        console.error("[Update Option Error]", error);

        if (error.message === "Draft option not found") {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update option",
            error: error.message,
        });
    }
};

/**
 * POST /api/question-drafts/:draftQuestionId/mark-ready
 * 
 * Mark a draft as ready for confirmation (validates all final_* fields)
 */
export const markDraftAsReady = async (req, res) => {
    try {
        const { draftQuestionId } = req.params;

        const updatedDraft = await markDraftReady(draftQuestionId);

        return res.status(200).json({
            success: true,
            message: "Draft marked as ready",
            data: updatedDraft,
        });
    } catch (error) {
        console.error("[Mark Ready Error]", error);

        if (error.message === "Draft question not found") {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }

        if (error.details) {
            return res.status(400).json({
                success: false,
                message: "Draft validation failed",
                validationErrors: error.details,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to mark draft ready",
            error: error.message,
        });
    }
};

/**
 * POST /api/question-drafts/:draftQuestionId/discard
 * 
 * Discard a draft question
 */
export const discardDraftQuestion = async (req, res) => {
    try {
        const { draftQuestionId } = req.params;

        const discardedDraft = await discardDraft(draftQuestionId);

        return res.status(200).json({
            success: true,
            message: "Draft discarded",
            data: discardedDraft,
        });
    } catch (error) {
        console.error("[Discard Error]", error);

        if (error.message === "Draft question not found") {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to discard draft",
            error: error.message,
        });
    }
};

/**
 * POST /api/question-drafts/confirm
 * 
 * Confirm batch of drafts: converts them to production questions.
 * 
 * Body:
 * {
 *   batchId: string (required)
 *   draftIds: string[] (optional - if not provided, confirms all MARKED_READY)
 * }
 */
export const confirmBatch = async (req, res) => {
    try {
        const { batchId, draftIds } = req.body;

        if (!batchId) {
            return res.status(400).json({
                success: false,
                message: "batchId is required",
            });
        }

        const result = await confirmDraftBatch(batchId, draftIds);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: `Confirmation complete. ${result.confirmedCount} questions created.`,
                data: result,
            });
        }
    } catch (error) {
        console.error("[Confirm Batch Error]", error);
        return res.status(500).json({
            success: false,
            message: "Confirmation failed",
            error: error.message,
        });
    }
};

/**
 * GET /api/question-drafts/batches/:batchId/stats
 * 
 * Get batch statistics
 */
export const getBatchStatistics = async (req, res) => {
    try {
        const { batchId } = req.params;

        const stats = await getBatchStats(batchId);

        return res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error("[Batch Stats Error]", error);

        if (error.message === "Batch not found") {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to fetch statistics",
            error: error.message,
        });
    }
};
