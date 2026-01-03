import express from 'express';
import { changePassword, forgotPassword, login, resendVerificationEmail, resetPassword, signup, verifyEmail } from './auth.controller.js';

const router = express();

router.post('/signup', signup)
router.post('/login', login);

router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/resend-otp', changePassword);

export default router;