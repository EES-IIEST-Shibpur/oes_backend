import express from 'express';
import { login, resendVerificationEmail, signup, verifyEmail } from './auth.controller.js';

const router = express();

router.post('/signup', signup)
router.post('/login', login);

router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

export default router;