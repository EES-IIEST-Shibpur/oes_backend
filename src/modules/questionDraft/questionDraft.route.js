import express from "express";
import multer from "multer";
import {
    ingestQuestions,
    getBatch,
    getDrafts,
    getDraftQuestionDetails,
    getDraftQuestionOptions,
    updateDraft,
    updateDraftOption,
    markDraftAsReady,
    discardDraftQuestion,
    confirmBatch,
    getBatchStatistics,
} from "./questionDraft.controller.js";

import {
    requireAuth,
    requireEmailVerified,
} from "../../middlewares/auth.middleware.js";

import requireRole from "../../middlewares/role.middleware.js";

const router = express.Router();

// Apply auth middleware for all draft routes
router.use(requireAuth);
router.use(requireEmailVerified);
router.use(requireRole("ADMIN"));

// Setup multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
    },
});

/**
 * Main ingestion endpoint
 * Accepts multipart input (text or file: image, PDF, CSV)
 * Calls AI extraction and creates draft batch
 * 
 * Body:
 * {
 *   sourceType: "TEXT" | "IMAGE" | "PDF" | "CSV"
 *   batchName: string
 *   text?: string (for TEXT source type)
 *   file?: File (for other source types)
 * }
 */
router.post("/ingest", upload.single("file"), ingestQuestions);

/**
 * Get complete batch with all draft questions and options
 */
router.get("/batches/:batchId", getBatch);

/**
 * Get batch statistics (counts by status, etc.)
 */
router.get("/batches/:batchId/stats", getBatchStatistics);

/**
 * Get drafts in a batch with optional filtering
 * 
 * Query params:
 * - batchId (required): UUID of batch
 * - status (optional): PENDING | MARKED_READY | CONFIRMED | DISCARDED
 */
router.get("/", getDrafts);

/**
 * Get single draft question with options
 */
router.get("/:draftQuestionId", getDraftQuestionDetails);

/**
 * Get options for a specific draft question
 */
router.get("/:draftQuestionId/options", getDraftQuestionOptions);

/**
 * Update admin-editable fields (final_*) of a draft question
 * 
 * Body: Partial object with final_* fields, e.g.:
 * {
 *   final_statement: "Updated question text",
 *   final_domain: "Physics",
 *   adminNotes: "Clarified wording"
 * }
 */
router.patch("/:draftQuestionId", updateDraft);

/**
 * Update admin-editable fields (final_*) of a draft option
 * 
 * Body: Partial object with final_* fields, e.g.:
 * {
 *   final_text: "Updated option text",
 *   final_isCorrect: true,
 *   adminNotes: "Fixed typo"
 * }
 */
router.patch("/options/:optionId", updateDraftOption);

/**
 * Mark a draft as ready for confirmation
 * Validates that all required final_* fields are filled
 */
router.post("/:draftQuestionId/mark-ready", markDraftAsReady);

/**
 * Discard a draft question
 */
router.post("/:draftQuestionId/discard", discardDraftQuestion);

/**
 * Confirm batch of drafts: convert from draft to production questions
 * 
 * Body:
 * {
 *   batchId: string (required)
 *   draftIds?: string[] (optional - if not provided, all MARKED_READY are confirmed)
 * }
 */
router.post("/confirm", confirmBatch);

export default router;
