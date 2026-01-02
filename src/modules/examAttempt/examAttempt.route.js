import express from "express";
import { getExamForAttempt, saveAnswer, startExam, submitExam } from "./examAttempt.controller";

const router = express.Router();

router.get("/:examId/start", startExam);
router.get("/:examId/attempt", getExamForAttempt);
router.post("/:examId/save", saveAnswer);
router.get("/:examId/submit", submitExam);

export default router;