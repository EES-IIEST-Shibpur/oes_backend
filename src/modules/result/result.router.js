import express from "express";
import { getMyResult } from "./result.controller";

const router = express.Router();

router.get("/:examId", getMyResult);

export default router;