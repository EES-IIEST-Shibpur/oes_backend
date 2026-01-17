import express from "express";
import { getMyResult, getMyScore, getMyAttempts, dummyResultCalculator } from "./result.controller.js";
import { requireAuth, requireEmailVerified } from "../../middlewares/auth.middleware.js";
import requireRole from "../../middlewares/role.middleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireEmailVerified);

// Get all attempts by current user
router.get("/", getMyAttempts);

// Get score only for specific exam (simple view)
router.get("/:examId/score", getMyScore);

// Get detailed result with analysis for specific exam
router.get("/:examId/analysis", getMyResult);

// Calculate/recalculate score (for testing/admin)
router.get("/:examId/calculate", requireRole("admin"), dummyResultCalculator);

export default router;