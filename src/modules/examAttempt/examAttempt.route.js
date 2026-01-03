import express from "express";
import { getExamForAttempt, saveAnswer, startExam, submitExam } from "./examAttempt.controller";
import { requireAuth, requireEmailVerified } from "../../middlewares/auth.middleware";

const router = express.Router();

router.use(requireAuth);
router.use(requireEmailVerified);

router.get("/:examId/start", startExam);
router.get("/:examId/attempt", getExamForAttempt);
router.post("/:examId/save", saveAnswer);
router.get("/:examId/submit", submitExam);

export default router;