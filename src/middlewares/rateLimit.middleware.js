import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many login attempts. Try again later.",
    },
});

export const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: {
        message: "Too many password reset requests. Try again later.",
    },
});

export const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        message: "Too many OTP attempts. Try again later.",
    },
});

export const refreshTokenLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: {
        message: "Too many token refresh requests.",
    },
});