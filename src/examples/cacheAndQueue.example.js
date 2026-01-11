// Example: How to use the caching service in your controllers/services

import { getOrSetCache, setCache, deleteCache, CACHE_KEYS } from "../services/cache.service.js";

// ============================================
// Example 1: Cache exam questions with cache-aside pattern
// ============================================
export const getExamQuestions = async (examId) => {
    return getOrSetCache(
        CACHE_KEYS.EXAM_QUESTIONS(examId),
        async () => {
            // This function is called only on cache miss
            const questions = await Question.findAll({
                where: { examId },
                include: ["options", "numericalAnswer"],
            });
            return questions;
        },
        7200 // Cache for 2 hours
    );
};

// ============================================
// Example 2: Cache user profile
// ============================================
export const getUserProfile = async (userId) => {
    return getOrSetCache(
        CACHE_KEYS.USER_PROFILE(userId),
        async () => {
            const profile = await User.findByPk(userId);
            return profile;
        },
        3600 // Cache for 1 hour
    );
};

// ============================================
// Example 3: Cache exam details
// ============================================
export const getExamDetails = async (examId) => {
    return getOrSetCache(
        CACHE_KEYS.EXAM(examId),
        async () => {
            const exam = await Exam.findByPk(examId, {
                include: ["questions"],
            });
            return exam;
        },
        1800 // Cache for 30 minutes
    );
};

// ============================================
// Example 4: Invalidate cache when data changes
// ============================================
export const updateExamQuestions = async (examId, questionId, updates) => {
    // Update database
    const question = await Question.findByPk(questionId);
    await question.update(updates);

    // Invalidate related caches
    await deleteCache(CACHE_KEYS.EXAM_QUESTIONS(examId));
    await deleteCache(CACHE_KEYS.EXAM(examId));

    return question;
};

// ============================================
// Example 5: How to use sendEmailQueued (BullMQ)
// ============================================
import { sendEmailQueued } from "../services/email.service.js";
import { verifyEmailTemplate } from "../templates/verifyEmail.template.js";

export const sendVerificationEmail = async (email, verificationToken) => {
    const template = verifyEmailTemplate(email, verificationToken);

    // Queue the email - it will be processed asynchronously
    const result = await sendEmailQueued(
        {
            to: email,
            subject: template.subject,
            html: template.html,
        },
        {
            priority: 10, // Higher priority for verification emails
            attempts: 5, // Retry up to 5 times
        }
    );

    return result;
};

// ============================================
// Example 6: Send password reset email
// ============================================
export const sendPasswordResetEmail = async (email, resetToken) => {
    const template = forgotPasswordTemplate(email, resetToken);

    await sendEmailQueued({
        to: email,
        subject: template.subject,
        html: template.html,
    });
};

// ============================================
// Example 7: Cache exam results
// ============================================
export const getExamResult = async (attemptId) => {
    return getOrSetCache(
        CACHE_KEYS.EXAM_RESULT(attemptId),
        async () => {
            const result = await ExamAttempt.findByPk(attemptId, {
                include: ["studentAnswers", "exam"],
            });
            return result;
        },
        7200 // Cache for 2 hours
    );
};

// ============================================
// Integration in your controllers
// ============================================
// Example: In your auth controller where you send verification email
/*
import { sendVerificationEmail } from "../services/authHelper.service.js";

export const register = async (req, res) => {
    try {
        // ... create user ...
        
        // Queue verification email (non-blocking)
        await sendVerificationEmail(user.email, verificationToken);
        
        res.status(201).json({
            message: "User registered. Verification email sent.",
            user: user,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
*/

// ============================================
// Notes on Cache Keys
// ============================================
/*
The CACHE_KEYS object provides standardized cache key generation:
- EXAM(examId): Single exam details
- EXAM_QUESTIONS(examId): Questions for an exam
- QUESTION(questionId): Single question with options
- USER_PROFILE(userId): User profile data
- EXAM_RESULT(attemptId): Exam attempt result
- USER_EXAMS(userId): All exams for a user
- ALL_EXAMS: All exams in system

This ensures consistency and makes it easy to invalidate related caches.
*/
