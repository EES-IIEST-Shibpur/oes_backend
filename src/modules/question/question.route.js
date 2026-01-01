import express from "express";
import {
  createQuestion,
  deleteQuestion,
  getQuestionById,
  getQuestions,
  updateQuestion,
} from "./question.controller.js";

import {
  requireAuth,
  requireEmailVerified,
} from "../../middlewares/auth.middleware.js";

import requireRole from "../../middlewares/role.middleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireEmailVerified);
router.use(requireRole("ADMIN"));

router.post("/create", createQuestion);
router.get("/all", getQuestions);
router.get("/:id", getQuestionById);
router.put("/:id", updateQuestion);
router.delete("/:id", deleteQuestion);

export default router;