/**
 * Gemini Question Extractor Service
 * 
 * SAFETY CRITICAL:
 * - AI output is treated as UNTRUSTED and stored ONLY in draft tables
 * - Never writes directly to production question tables
 * - Admin review and confirmation is mandatory before production creation
 * - Invalid or ambiguous AI output results in null fields for human review
 * 
 * Architecture:
 * OCR Text → Gemini API → JSON Validation → Draft Tables → Admin Review → Production
 */

import { GoogleGenAI } from '@google/genai';
import Joi from 'joi';
import { GEMINI_SYSTEM_PROMPT, buildGeminiUserPrompt } from './prompts.js';

// Lazy initialization of Gemini client
// Only created when needed, with proper error handling
let geminiClient = null;

const getGeminiClient = () => {
    if (!geminiClient) {
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            throw new Error(
                'GEMINI_API_KEY not configured in environment variables.\n' +
                'Please add the following to your .env file:\n' +
                'GEMINI_API_KEY=your-key-here\n\n' +
                'Get your FREE API key from: https://aistudio.google.com/app/apikey'
            );
        }
        
        geminiClient = new GoogleGenAI({ apiKey });
    }
    
    return geminiClient;
};

/**
 * JSON Schema for validating Gemini response
 * 
 * Enforces strict structure to prevent malformed data from entering drafts.
 * Matches OES database schema:
 * - Question types: SINGLE_CORRECT, MULTIPLE_CORRECT, NUMERICAL
 * - Option requires: text (required), label (optional)
 * - Confidence scores: 0-100
 */
const extractionResponseSchema = Joi.object({
    questions: Joi.array().items(
        Joi.object({
            statement: Joi.string().allow(null, '').required(),
            questionType: Joi.string()
                .valid('SINGLE_CORRECT', 'MULTIPLE_CORRECT', 'NUMERICAL', null)
                .required(),
            options: Joi.array()
                .items(
                    Joi.object({
                        label: Joi.string().allow('', null).optional(),
                        text: Joi.string().allow(null, '').required(),
                    })
                )
                .min(0)
                .required(),
            confidence: Joi.object({
                statement: Joi.number().min(0).max(100).required(),
                options: Joi.number().min(0).max(100).required(),
            }).required(),
        })
    ).required(),
});

/**
 * Call Gemini API to extract questions from OCR text
 * 
 * SAFETY NOTES:
 * - Temperature = 0 for deterministic output
 * - Response is validated before returning
 * - Any failure throws error to be handled upstream
 * 
 * @param {string} rawOcrText - Raw OCR extracted text
 * @param {object} context - Optional context about the exam/subject
 * @returns {Promise<object>} Validated JSON with extracted questions
 * @throws {Error} If API fails or response validation fails
 */
export const extractQuestionsWithGemini = async (rawOcrText, context = {}) => {
    try {
        console.log('[Gemini Extractor] ========== STARTING EXTRACTION ==========');
        console.log(`[Gemini Extractor] OCR text length: ${rawOcrText.length} characters`);
        console.log(`[Gemini Extractor] Context:`, context);

        // Validate input
        if (!rawOcrText || rawOcrText.trim().length === 0) {
            throw new Error('OCR text is empty. Cannot extract questions.');
        }

        // Build the user prompt using imported function
        const userPrompt = buildGeminiUserPrompt(rawOcrText, context);

        console.log('[Gemini Extractor] Calling Google Gemini API...');
        console.log('[Gemini Extractor] Model: gemini-2.0-flash');
        console.log('[Gemini Extractor] Temperature: 0 (deterministic)');

        // Get Gemini client (lazy initialization with error handling)
        const ai = getGeminiClient();
        
        // Combine system prompt and user prompt
        const fullPrompt = `${GEMINI_SYSTEM_PROMPT}\n\n${userPrompt}`;

        // Call Gemini API with new syntax
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: fullPrompt,
            generationConfig: {
                temperature: 0,
                responseMimeType: 'application/json', // Enforce JSON output
            },
        });

        const responseText = response.text;

        console.log('[Gemini Extractor] API call successful');
        console.log('[Gemini Extractor] Response length:', responseText.length);

        // Parse JSON
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Gemini Extractor] JSON parse error:', parseError.message);
            console.error('[Gemini Extractor] Raw response:', responseText);
            throw new Error('Gemini response is not valid JSON');
        }

        // Validate against schema
        const { error, value } = extractionResponseSchema.validate(parsedResponse, {
            abortEarly: false,
        });

        if (error) {
            console.error('[Gemini Extractor] Validation error:', error.details);
            console.error('[Gemini Extractor] Invalid response:', JSON.stringify(parsedResponse, null, 2));
            throw new Error(`Gemini response validation failed: ${error.message}`);
        }

        console.log('[Gemini Extractor] ========== EXTRACTION SUCCESSFUL ==========');
        console.log(`[Gemini Extractor] Questions extracted: ${value.questions.length}`);

        // Log summary of each question
        value.questions.forEach((q, idx) => {
            console.log(`[Gemini Extractor] Q${idx + 1}: ${q.statement?.substring(0, 60)}...`);
            console.log(`[Gemini Extractor]   Type: ${q.questionType || 'null'}`);
            console.log(`[Gemini Extractor]   Options: ${q.options.length}`);
            console.log(`[Gemini Extractor]   Confidence: Statement=${q.confidence.statement}%, Options=${q.confidence.options}%`);
        });

        console.log('[Gemini Extractor] ================================================');

        return {
            success: true,
            questions: value.questions,
            usage: { model: 'gemini-2.0-flash' },
        };
    } catch (error) {
        console.error('[Gemini Extractor] ========== EXTRACTION FAILED ==========');
        console.error('[Gemini Extractor] Error:', error.message);
        console.error('[Gemini Extractor] Stack:', error.stack);
        console.error('[Gemini Extractor] ==========================================');

        // Re-throw with context
        throw new Error(`Gemini extraction failed: ${error.message}`);
    }
};

/**
 * Map Gemini question types to OES question types
 * 
 * Gemini now returns OES types directly: SINGLE_CORRECT, MULTIPLE_CORRECT, NUMERICAL
 * This function is kept for backwards compatibility and validation.
 * 
 * @param {string} geminiType - Question type from Gemini
 * @returns {string} OES question type
 */
export const mapQuestionType = (geminiType) => {
    // Gemini returns OES types directly, but validate them
    const validTypes = ['SINGLE_CORRECT', 'MULTIPLE_CORRECT', 'NUMERICAL'];
    
    if (validTypes.includes(geminiType)) {
        return geminiType;
    }
    
    // Fallback mapping for old format (if Gemini still uses generic types)
    const mapping = {
        'MCQ': 'SINGLE_CORRECT',
        'MSQ': 'MULTIPLE_CORRECT',
        'NUMERICAL': 'NUMERICAL',
        'SUBJECTIVE': null, // Subjective not supported yet
    };

    return mapping[geminiType] || null;
};

/**
 * Extract domain/subject from context or infer from content
 * 
 * @param {object} context - Context object
 * @param {string} statement - Question statement
 * @returns {string} Domain name
 */
export const extractDomain = (context, statement) => {
    // Use context if provided
    if (context.subject) {
        return context.subject;
    }

    if (context.domain) {
        return context.domain;
    }

    // Default fallback
    return 'General Knowledge';
};

/**
 * Calculate overall confidence from Gemini confidence scores
 * 
 * @param {object} confidence - Confidence object from Gemini
 * @returns {number} Overall confidence (0-100)
 */
export const calculateOverallConfidence = (confidence) => {
    // Average of statement and options confidence
    return Math.round((confidence.statement + confidence.options) / 2);
};
