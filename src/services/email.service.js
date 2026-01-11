import nodemailer from "nodemailer";
import { addEmailJob } from "./emailQueue.service.js";

const SMTP_PORT = Number(process.env.SMTP_PORT);

const SMTP_SECURE = SMTP_PORT === 465;

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const verifyEmailTransporter = async () => {
    try {
        await transporter.verify();
        console.log("SMTP server is ready to send emails");
    } catch (error) {
        console.error("SMTP configuration error:", error.message);
    }
};

/**
 * Send email directly (used by BullMQ worker)
 * Internal function - use sendEmailQueued for API endpoints
 */
export const sendEmail = async ({ to, subject, html }) => {
    try {
        const info = await transporter.sendMail({
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
 */
export const sendEmailQueued = async ({ to, subject, html }, options = {}) => {
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
        console.log("Attempting direct send as fallback...");
        try {
            return await sendEmail({ to, subject, html });
        } catch (fallbackError) {
            throw new Error("Failed to send email (queued and direct send failed)");
        }
    }
};