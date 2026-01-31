import express from 'express';
import authRoutes from '../modules/auth/auth.route.js';
import profileRoutes from '../modules/profile/profile.route.js';
import questionRoutes from '../modules/question/question.route.js';
import questionDraftRoutes from '../modules/questionDraft/questionDraft.route.js';
import examRoutes from '../modules/exam/exam.route.js';
import examAttemptRoutes from '../modules/examAttempt/examAttempt.route.js';
import resultRoutes from '../modules/result/result.router.js';
import leaderboardRoutes from '../modules/leaderboard/leaderboard.route.js'

const router = express.Router();

router.get("/health", (req, res) => {
    const corsOrigins = process.env.CORS_ORIGINS || "not set";
    res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        corsOrigins: corsOrigins,
        req_IPaddress: req.ip
    });
});

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/question", questionRoutes);
router.use("/question-drafts", questionDraftRoutes);
router.use("/exam", examRoutes);
router.use("/exam-attempt", examAttemptRoutes);
router.use("/result", resultRoutes);
router.use("/leaderboard", leaderboardRoutes)

export default router;