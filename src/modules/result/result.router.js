import express from "express";
import { getMyResult } from "./result.controller";
import { requireAuth, requireEmailVerified } from "../../middlewares/auth.middleware";

const router = express.Router();

router.use(requireAuth);
router.use(requireEmailVerified);

router.get("/:examId", getMyResult);

export default router;