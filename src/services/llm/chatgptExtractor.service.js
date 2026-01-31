/**
 * ChatGPT Question Extractor Service
 * 
 * SAFETY CRITICAL:
 * - AI output is treated as UNTRUSTED and stored ONLY in draft tables
 * - Never writes directly to production question tables
 * - Admin review and confirmation is mandatory before production creation
 * - Invalid or ambiguous AI output results in null fields for human review
 * 
 * Architecture:
 * OCR Text → ChatGPT API → JSON Validation → Draft Tables → Admin Review → Production
 */

import OpenAI from 'openai';
import Joi from 'joi';
import { CHATGPT_SYSTEM_PROMPT, buildChatGPTUserPrompt } from './prompts.js';

// Lazy initialization of OpenAI client
// Only created when needed, with proper error handling
let openaiClient = null;

const getOpenAIClient = () => {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            throw new Error(
                'OPENAI_API_KEY not configured in environment variables.\n' +
                'Please add the following to your .env file:\n' +
                'OPENAI_API_KEY=sk-proj-your-key-here\n\n' +
                'Get your API key from: https://platform.openai.com/api-keys'
            );
        }
        
        openaiClient = new OpenAI({ apiKey });
    }
    
    return openaiClient;
};

/**
 * JSON Schema for validating ChatGPT response
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
 * Call ChatGPT API to extract questions from OCR text
 * 
 * SAFETY NOTES:
 * - Temperature = 0 for deterministic output
 * - JSON mode enforced to prevent free-form text
 * - Response is validated before returning
 * - Any failure throws error to be handled upstream
 * 
 * @param {string} rawOcrText - Raw OCR extracted text
 * @param {object} context - Optional context about the exam/subject
 * @returns {Promise<object>} Validated JSON with extracted questions
 * @throws {Error} If API fails or response validation fails
 */
export const extractQuestionsWithChatGPT = async (rawOcrText, context = {}) => {
    try {

        // Validate input
        if (!rawOcrText || rawOcrText.trim().length === 0) {
            throw new Error('OCR text is empty. Cannot extract questions.');
        }

        // Build the user prompt using imported function
        const userPrompt = buildChatGPTUserPrompt(rawOcrText, context);

        // Get OpenAI client (lazy initialization with error handling)
        const openai = getOpenAIClient();

        // Call OpenAI API with strict settings
        const completion = await openai.chat.completions.create({
            model: 'gpt-4.1', // Or 'gpt-4' for better accuracy
            temperature: 0, // Deterministic output
            messages: [
                {
                    role: 'system',
                    content: CHATGPT_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: userPrompt,
                },
            ],
            response_format: { type: 'json_object' }, // Enforce JSON mode
        });

        // Extract response content
        const responseContent = completion.choices[0]?.message?.content;

        if (!responseContent) {
            throw new Error('ChatGPT returned empty response');
        }

        // Parse JSON
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseContent);
        } catch (parseError) {
            console.error('[ChatGPT Extractor] JSON parse error:', parseError.message);
            console.error('[ChatGPT Extractor] Raw response:', responseContent);
            throw new Error('ChatGPT response is not valid JSON');
        }

        // Validate against schema
        const { error, value } = extractionResponseSchema.validate(parsedResponse, {
            abortEarly: false,
        });

        if (error) {
            console.error('[ChatGPT Extractor] Validation error:', error.details);
            console.error('[ChatGPT Extractor] Invalid response:', JSON.stringify(parsedResponse, null, 2));
            throw new Error(`ChatGPT response validation failed: ${error.message}`);
        }

        return {
            success: true,
            questions: value.questions,
            usage: completion.usage,
        };
    } catch (error) {
        console.error('[ChatGPT Extractor] ========== EXTRACTION FAILED ==========');
        console.error('[ChatGPT Extractor] Error:', error.message);
        console.error('[ChatGPT Extractor] Stack:', error.stack);
        console.error('[ChatGPT Extractor] ==========================================');

        // Re-throw with context
        throw new Error(`ChatGPT extraction failed: ${error.message}`);
    }
};

/**
 * Map ChatGPT question types to OES question types
 * 
 * ChatGPT now returns OES types directly: SINGLE_CORRECT, MULTIPLE_CORRECT, NUMERICAL
 * This function is kept for backwards compatibility and validation.
 * 
 * @param {string} chatgptType - Question type from ChatGPT
 * @returns {string} OES question type
 */
export const mapQuestionType = (chatgptType) => {
    // ChatGPT now returns OES types directly, but validate them
    const validTypes = ['SINGLE_CORRECT', 'MULTIPLE_CORRECT', 'NUMERICAL'];

    if (validTypes.includes(chatgptType)) {
        return chatgptType;
    }

    // Fallback mapping for old format (if ChatGPT still uses generic types)
    const mapping = {
        'MCQ': 'SINGLE_CORRECT',
        'MSQ': 'MULTIPLE_CORRECT',
        'NUMERICAL': 'NUMERICAL',
        'SUBJECTIVE': null, // Subjective not supported yet
    };

    return mapping[chatgptType] || null;
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
 * Calculate overall confidence from ChatGPT confidence scores
 * 
 * @param {object} confidence - Confidence object from ChatGPT
 * @returns {number} Overall confidence (0-100)
 */
export const calculateOverallConfidence = (confidence) => {
    // Average of statement and options confidence
    return Math.round((confidence.statement + confidence.options) / 2);
};
