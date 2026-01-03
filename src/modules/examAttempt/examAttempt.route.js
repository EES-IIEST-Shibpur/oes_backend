import express from "express";
import { getExamForAttempt, saveAnswer, startExam, submitExam } from "./examAttempt.controller.js";
import { requireAuth, requireEmailVerified } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireEmailVerified);

router.post("/:examId/start", startExam);
router.get("/:examId/attempt", getExamForAttempt);
router.post("/:examId/save", saveAnswer);
router.post("/:examId/submit", submitExam);

export default router;