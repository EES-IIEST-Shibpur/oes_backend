/**
 * GitHub Models Question Extractor Service
 * 
 * SAFETY CRITICAL:
 * - AI output is treated as UNTRUSTED and stored ONLY in draft tables
 * - Never writes directly to production question tables
 * - Admin review and confirmation is mandatory before production creation
 * - Invalid or ambiguous AI output results in null fields for human review
 * 
 * Architecture:
 * OCR Text → GitHub Models API → JSON Validation → Draft Tables → Admin Review → Production
 */

import OpenAI from 'openai';
import Joi from 'joi';
import { GITHUB_SYSTEM_PROMPT, buildGitHubUserPrompt } from './prompts.js';

// GitHub Models configuration
const GITHUB_ENDPOINT = "https://models.github.ai/inference";
const GITHUB_MODEL = "gpt-4o-mini"; // Free model via GitHub

// Lazy initialization of GitHub Models client
let githubClient = null;

const getGitHubClient = () => {
    if (!githubClient) {
        const token = process.env.GITHUB_TOKEN;
        
        if (!token) {
            throw new Error(
                'GITHUB_TOKEN not configured in environment variables.\n' +
                'Please add the following to your .env file:\n' +
                'GITHUB_TOKEN=github_pat_your-token-here\n\n' +
                'Get your token from: https://github.com/settings/tokens'
            );
        }
        
        // Create OpenAI client with GitHub endpoint
        githubClient = new OpenAI({
            baseURL: GITHUB_ENDPOINT,
            apiKey: token
        });
    }
    
    return githubClient;
};

/**
 * JSON Schema for validating GitHub Models response
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
 * Call GitHub Models API to extract questions from OCR text
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
export const extractQuestionsWithGitHub = async (rawOcrText, context = {}) => {
    try {
        console.log('[GitHub Extractor] ========== STARTING EXTRACTION ==========');
        console.log(`[GitHub Extractor] OCR text length: ${rawOcrText.length} characters`);
        console.log(`[GitHub Extractor] Context:`, context);

        // Validate input
        if (!rawOcrText || rawOcrText.trim().length === 0) {
            throw new Error('OCR text is empty. Cannot extract questions.');
        }

        // Build the user prompt using imported function
        const userPrompt = buildGitHubUserPrompt(rawOcrText, context);

        console.log('[GitHub Extractor] Calling GitHub Models API...');
        console.log('[GitHub Extractor] Endpoint: https://models.github.ai/inference');
        console.log('[GitHub Extractor] Model: gpt-4o-mini');
        console.log('[GitHub Extractor] Temperature: 0 (deterministic)');

        // Get GitHub client (lazy initialization)
        const client = getGitHubClient();

        // Call GitHub Models API using OpenAI SDK
        const response = await client.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: GITHUB_SYSTEM_PROMPT
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ],
            model: GITHUB_MODEL,
            temperature: 0,
            response_format: { type: "json_object" } // Enforce JSON output
        });

        const responseText = response.choices[0]?.message?.content;

        if (!responseText) {
            throw new Error('GitHub Models returned empty response');
        }

        console.log('[GitHub Extractor] API call successful');
        console.log('[GitHub Extractor] Response length:', responseText.length);

        // Parse JSON
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[GitHub Extractor] JSON parse error:', parseError.message);
            console.error('[GitHub Extractor] Raw response:', responseText);
            throw new Error('GitHub Models response is not valid JSON');
        }

        // Validate against schema
        const { error, value } = extractionResponseSchema.validate(parsedResponse, {
            abortEarly: false,
        });

        if (error) {
            console.error('[GitHub Extractor] Validation error:', error.details);
            console.error('[GitHub Extractor] Invalid response:', JSON.stringify(parsedResponse, null, 2));
            throw new Error(`GitHub Models response validation failed: ${error.message}`);
        }

        console.log('[GitHub Extractor] ========== EXTRACTION SUCCESSFUL ==========');
        console.log(`[GitHub Extractor] Questions extracted: ${value.questions.length}`);

        // Log summary of each question
        value.questions.forEach((q, idx) => {
            console.log(`[GitHub Extractor] Q${idx + 1}: ${q.statement?.substring(0, 60)}...`);
            console.log(`[GitHub Extractor]   Type: ${q.questionType || 'null'}`);
            console.log(`[GitHub Extractor]   Options: ${q.options.length}`);
            console.log(`[GitHub Extractor]   Confidence: Statement=${q.confidence.statement}%, Options=${q.confidence.options}%`);
        });

        console.log('[GitHub Extractor] ================================================');

        return {
            success: true,
            questions: value.questions,
            usage: { 
                model: 'gpt-4o-mini',
                tokens: response.usage?.total_tokens || 0
            },
        };
    } catch (error) {
        console.error('[GitHub Extractor] ========== EXTRACTION FAILED ==========');
        console.error('[GitHub Extractor] Error:', error.message);
        console.error('[GitHub Extractor] Stack:', error.stack);
        console.error('[GitHub Extractor] ==========================================');

        // Re-throw with context
        throw new Error(`GitHub Models extraction failed: ${error.message}`);
    }
};

/**
 * Map GitHub Models question types to OES question types
 * 
 * GitHub Models returns OES types directly: SINGLE_CORRECT, MULTIPLE_CORRECT, NUMERICAL
 * This function is kept for backwards compatibility and validation.
 * 
 * @param {string} githubType - Question type from GitHub Models
 * @returns {string} OES question type
 */
export const mapQuestionType = (githubType) => {
    // GitHub Models returns OES types directly, but validate them
    const validTypes = ['SINGLE_CORRECT', 'MULTIPLE_CORRECT', 'NUMERICAL'];
    
    if (validTypes.includes(githubType)) {
        return githubType;
    }
    
    // Fallback mapping for old format
    const mapping = {
        'MCQ': 'SINGLE_CORRECT',
        'MSQ': 'MULTIPLE_CORRECT',
        'NUMERICAL': 'NUMERICAL',
        'SUBJECTIVE': null, // Subjective not supported yet
    };

    return mapping[githubType] || null;
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
 * Calculate overall confidence from GitHub Models confidence scores
 * 
 * @param {object} confidence - Confidence object from GitHub Models
 * @returns {number} Overall confidence (0-100)
 */
export const calculateOverallConfidence = (confidence) => {
    // Average of statement and options confidence
    return Math.round((confidence.statement + confidence.options) / 2);
};
