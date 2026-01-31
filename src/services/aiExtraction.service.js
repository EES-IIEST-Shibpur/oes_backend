/**
 * AI Question Extraction Service
 * 
 * Handles integration with AI models for question extraction.
 * Uses GitHub Models (Azure OpenAI) for extraction, Tesseract.js for OCR.
 * 
 * SAFETY CRITICAL:
 * - AI output is UNTRUSTED and goes ONLY to draft tables
 * - Never writes to production question tables
 * - Admin confirmation is mandatory
 * 
 * Responsibilities:
 * - Call OCR using Tesseract.js (real implementation)
 * - Call GitHub Models to extract questions (real implementation)
 * - Parse and structure AI response
 * - Calculate confidence scores
 */

import Tesseract from 'tesseract.js';

// ACTIVE AI SERVICE: GitHub Models (Free via GitHub)
import {
    extractQuestionsWithGitHub,
    mapQuestionType,
    extractDomain,
    calculateOverallConfidence,
} from './llm/githubExtractor.service.js';

// BACKUP AI SERVICES (Kept for reference)
// Gemini (Free)
// import {
//     extractQuestionsWithGemini,
//     mapQuestionType,
//     extractDomain,
//     calculateOverallConfidence,
// } from './llm/geminiExtractor.service.js';
//
// ChatGPT (Paid)
// import {
//     extractQuestionsWithChatGPT,
//     mapQuestionType,
//     extractDomain,
//     calculateOverallConfidence,
// } from './llm/chatgptExtractor.service.js';

/**
 * Real AI Model using GitHub Models (Azure OpenAI)
 * 
 * IMPORTANT SAFETY NOTES:
 * - AI output is treated as UNTRUSTED data
 * - All extracted questions go to DRAFT tables only
 * - Admin must review and confirm before production creation
 * - Invalid/ambiguous output results in null fields for human review
 * 
 * @param {string} content - Extracted text from OCR or user input
 * @param {string} sourceType - TEXT | IMAGE | PDF | CSV
 * @param {object} context - Optional context (exam name, subject, etc.)
 * @returns {Promise<object>} Extracted questions in standard format
 */
export const callAIQuestionExtraction = async (content, sourceType, context = {}) => {

    try {
        // Call GitHub Models to extract questions (FREE via GitHub token)
        const githubResult = await extractQuestionsWithGitHub(content, context);

        if (!githubResult.success || !githubResult.questions || githubResult.questions.length === 0) {
            console.warn('[AI Extraction] GitHub Models returned no questions');
            return {
                success: true,
                questionsExtracted: 0,
                questions: [],
            };
        }

        // Transform GitHub Models output to OES format
        const transformedQuestions = githubResult.questions.map((githubQuestion) => {
            // Map question type from GitHub Models format to OES format
            const oesQuestionType = mapQuestionType(githubQuestion.questionType);

            // Extract domain (from context or default)
            const domain = extractDomain(context, githubQuestion.statement);

            // Calculate overall confidence
            const overallConfidence = calculateOverallConfidence(githubQuestion.confidence);

            // Transform options
            // WHY: OES requires specific format with isCorrect flags
            // NOTE: GitHub Models does NOT determine correct answers (safety rule)
            const options = githubQuestion.options.map((option, index) => ({
                text: option.text || '',
                isCorrect: false, // NEVER auto-mark correct answers - admin must decide
                confidence: githubQuestion.confidence.options,
            }));

            return {
                statement: githubQuestion.statement || '',
                questionType: oesQuestionType,
                domain: domain,
                difficulty: 'MEDIUM', // Default, admin can change
                confidence: overallConfidence,
                options: options,
            };
        });


        return {
            success: true,
            questionsExtracted: transformedQuestions.length,
            questions: transformedQuestions,
        };
    } catch (error) {
        console.error('[AI Extraction] ========== EXTRACTION FAILED ==========');
        console.error('[AI Extraction] Error:', error.message);
        console.error('[AI Extraction] ====================================');

        // Return error but don't crash - upstream will handle
        return {
            success: false,
            error: error.message,
            questionsExtracted: 0,
            questions: [],
        };
    }
};

/**
 * OCR Service: Uses Tesseract.js to extract text from images/PDFs
 * 
 * Real implementation using Tesseract.js for text recognition
 */
export const performOCR = async (fileBuffer, fileType) => {
    try {

        // Convert buffer to format Tesseract can process
        const { data: { text, confidence } } = await Tesseract.recognize(
            fileBuffer,
            'eng', // Language code (English)
        );

        return {
            success: true,
            extractedText: text,
            confidence: confidence,
        };
    } catch (error) {
        console.error('[OCR] Tesseract error:', error);
        return {
            success: false,
            error: error.message,
            extractedText: '',
            confidence: 0,
        };
    }
};

/**
 * Validates AI-extracted question data before saving to draft
 */
export const validateExtractedQuestion = (question) => {
    const errors = [];

    if (!question.statement || question.statement.trim().length === 0) {
        errors.push("Question statement is empty");
    }

    if (!["SINGLE_CORRECT", "MULTIPLE_CORRECT", "NUMERICAL"].includes(question.questionType)) {
        errors.push("Invalid question type");
    }

    if (!question.options || question.options.length < 2) {
        errors.push("Question must have at least 2 options");
    }

    // NOTE: We do NOT validate correct answers here
    // WHY: AI output has all isCorrect=false by design (safety rule)
    // Admin must manually mark correct answers during review
    // This validation is only for basic structure, not correctness

    return {
        isValid: errors.length === 0,
        errors,
    };
};
