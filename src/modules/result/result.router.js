import express from "express";
import { getMyResult, getMyAttempts, dummyResultCalculator } from "./result.controller.js";
import { requireAuth, requireEmailVerified } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireEmailVerified);

// Get all attempts by current user
router.get("/", getMyAttempts);

// Get result for specific exam
router.get("/:examId", getMyResult);

router.get("/:examId/dummy/test", dummyResultCalculator);

export default router;