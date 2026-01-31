import nodemailer from "nodemailer";
import { addEmailJob, isEmailQueueInitialized } from "./emailQueue.service.js";

let transporter = null;

/**
 * Initialize email transporter
 */
export const initializeEmailTransporter = () => {
    if (transporter) {
        return transporter;
    }

    const SMTP_PORT = Number(process.env.SMTP_PORT);
    const SMTP_SECURE = SMTP_PORT === 465;

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    return transporter;
};

/**
 * Verify email transporter configuration
 */
export const verifyEmailTransporter = async () => {
    try {
        const emailTransporter = initializeEmailTransporter();
        await emailTransporter.verify();
    } catch (error) {
        console.error("SMTP configuration error:", error.message);
        throw error;
    }
};

/**
 * Send email directly (used by BullMQ worker)
 * Internal function - use sendEmailQueued for API endpoints
 */
export const sendEmail = async ({ to, subject, html }) => {
    try {
        const emailTransporter = initializeEmailTransporter();
        const info = await emailTransporter.sendMail({
            from: `"Electrical Engineers' Society" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
        });

        return info;
    } catch (error) {
        console.error("Email sending failed:", {
            to,
            subject,
            error: error.message,
        });

        throw new Error("Failed to send email");
    }
};

/**
 * Queue email for sending (recommended for API endpoints)
 * Email will be processed asynchronously with automatic retries
 * Falls back to direct send if queue is not available
 */
export const sendEmailQueued = async ({ to, subject, html }, options = {}) => {
    // If email queue is not initialized, send directly
    if (!isEmailQueueInitialized()) {
        return await sendEmail({ to, subject, html });
    }

    try {
        const job = await addEmailJob(to, subject, html, options);
        return {
            queued: true,
            jobId: job.id,
            message: "Email queued for sending",
        };
    } catch (error) {
        console.error("Failed to queue email:", {
            to,
            subject,
            error: error.message,
        });

        // Fallback: Try to send directly if queue fails
        try {
            return await sendEmail({ to, subject, html });
        } catch (fallbackError) {
            throw new Error("Failed to send email (queued and direct send failed)");
        }
    }
};