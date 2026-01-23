import express from "express";
import { getTopScorers } from "./leaderboard.controller.js";

const router = express.Router();

// Get top 5 scorers (leaderboard)
router.get("/top-five", getTopScorers);

export default router;