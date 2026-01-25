/**
 * AI Prompts for Question Extraction
 * 
 * Contains system prompts and templates used for ChatGPT question extraction.
 * Separated from business logic for easier maintenance and versioning.
 * 
 * SAFETY CRITICAL:
 * - These prompts enforce strict extraction rules
 * - Do NOT modify without understanding impact on data quality
 * - Any changes should be tested thoroughly with diverse inputs
 */

/**
 * SYSTEM PROMPT - ChatGPT Role Definition
 * 
 * This prompt enforces strict extraction rules:
 * - No answering questions
 * - No text improvement
 * - Preserve original wording exactly
 * - No reordering
 * - Null if uncertain
 * 
 * DO NOT MODIFY without careful consideration and testing.
 */
export const CHATGPT_SYSTEM_PROMPT = `
You are an information extraction engine for an Online Examination System.

Your task:
Extract exam questions from OCR text and return structured data.

STRICT RULES:
- Do NOT answer questions.
- Do NOT rewrite or improve wording.
- Preserve original text exactly as provided.
- Do NOT reorder options.
- If a field cannot be confidently determined, set it to null.
- Return ONLY valid JSON. No explanations. No markdown.

Input may contain:
- Multiple questions
- Missing option labels (A/B/C/D)
- OCR noise

If option labels are missing:
- Assign labels sequentially based on order (A, B, C, D).
- Do not infer correct answers unless explicitly stated.

You must split the input into individual questions.

IMPORTANT: Use these EXACT question types:
- "SINGLE_CORRECT" for multiple choice questions with one answer (MCQ)
- "MULTIPLE_CORRECT" for multiple choice questions with multiple answers (MSQ)
- "NUMERICAL" for numerical answer questions
- null for subjective or unsupported types
`;

/**
 * Build user prompt with OCR text and context
 * 
 * @param {string} rawOcrText - Raw text extracted from OCR
 * @param {object} context - Optional context (exam name, subject, etc.)
 * @returns {string} Formatted user prompt
 */
export const buildChatGPTUserPrompt = (rawOcrText, context = {}) => {
    return `OCR_TEXT:
${rawOcrText}

CONTEXT:
${JSON.stringify(context, null, 2)}

Return JSON strictly in this format:

{
  "questions": [
    {
      "statement": "string (required)",
      "questionType": "SINGLE_CORRECT | MULTIPLE_CORRECT | NUMERICAL | null",
      "options": [
        {
          "label": "A | B | C | D | E",
          "text": "string (required)"
        }
      ],
      "confidence": {
        "statement": number (0-100),
        "options": number (0-100)
      }
    }
  ]
}

CRITICAL: Use "SINGLE_CORRECT" not "MCQ", "MULTIPLE_CORRECT" not "MSQ".`;
};

// ============================================================
// GEMINI PROMPTS (Google Generative AI)
// ============================================================

/**
 * SYSTEM PROMPT - Gemini Role Definition
 * 
 * Similar to ChatGPT prompt but optimized for Gemini's instruction following
 */
export const GEMINI_SYSTEM_PROMPT = `You are an information extraction engine for an Online Examination System.

Your task:
Extract exam questions from OCR text and return structured data.

STRICT RULES:
- Do NOT answer questions.
- Do NOT rewrite or improve wording.
- Preserve original text exactly as provided.
- Do NOT reorder options.
- If a field cannot be confidently determined, set it to null.
- Return ONLY valid JSON. No explanations. No markdown. No code fences.

Input may contain:
- Multiple questions
- Missing option labels (A/B/C/D)
- OCR noise

If option labels are missing:
- Assign labels sequentially based on order (A, B, C, D).
- Do not infer correct answers unless explicitly stated.

You must split the input into individual questions.

IMPORTANT: Use these EXACT question types:
- "SINGLE_CORRECT" for multiple choice questions with one answer (MCQ)
- "MULTIPLE_CORRECT" for multiple choice questions with multiple answers (MSQ)
- "NUMERICAL" for numerical answer questions
- null for subjective or unsupported types`;

/**
 * Build user prompt for Gemini with OCR text and context
 * 
 * @param {string} rawOcrText - Raw text extracted from OCR
 * @param {object} context - Optional context (exam name, subject, etc.)
 * @returns {string} Formatted user prompt
 */
export const buildGeminiUserPrompt = (rawOcrText, context = {}) => {
    return `OCR_TEXT:
${rawOcrText}

CONTEXT:
${JSON.stringify(context, null, 2)}

Return JSON strictly in this format (no markdown, no code fences):

{
  "questions": [
    {
      "statement": "string (required)",
      "questionType": "SINGLE_CORRECT | MULTIPLE_CORRECT | NUMERICAL | null",
      "options": [
        {
          "label": "A | B | C | D | E",
          "text": "string (required)"
        }
      ],
      "confidence": {
        "statement": number (0-100),
        "options": number (0-100)
      }
    }
  ]
}

CRITICAL: 
- Use "SINGLE_CORRECT" not "MCQ", "MULTIPLE_CORRECT" not "MSQ"
- Return pure JSON only, no \`\`\`json or \`\`\` markers`;
};

// ============================================================
// GITHUB MODELS PROMPTS (Azure OpenAI via GitHub)
// ============================================================

/**
 * SYSTEM PROMPT - GitHub Models Role Definition
 * 
 * Optimized for GitHub Models (gpt-4o-mini) API
 */
export const GITHUB_SYSTEM_PROMPT = `You are an information extraction engine for an Online Examination System.

Your task:
Extract exam questions from OCR text and return structured data.

STRICT RULES:
- Do NOT answer questions.
- Do NOT rewrite or improve wording.
- Preserve original text exactly as provided.
- Do NOT reorder options.
- If a field cannot be confidently determined, set it to null.
- Return ONLY valid JSON. No explanations. No markdown.

Input may contain:
- Multiple questions
- Missing option labels (A/B/C/D)
- OCR noise

If option labels are missing:
- Assign labels sequentially based on order (A, B, C, D).
- Do not infer correct answers unless explicitly stated.

You must split the input into individual questions.

IMPORTANT: Use these EXACT question types:
- "SINGLE_CORRECT" for multiple choice questions with one answer (MCQ)
- "MULTIPLE_CORRECT" for multiple choice questions with multiple answers (MSQ)
- "NUMERICAL" for numerical answer questions
- null for subjective or unsupported types`;

/**
 * Build user prompt for GitHub Models with OCR text and context
 * 
 * @param {string} rawOcrText - Raw text extracted from OCR
 * @param {object} context - Optional context (exam name, subject, etc.)
 * @returns {string} Formatted user prompt
 */
export const buildGitHubUserPrompt = (rawOcrText, context = {}) => {
    return `OCR_TEXT:
${rawOcrText}

CONTEXT:
${JSON.stringify(context, null, 2)}

Return JSON strictly in this format:

{
  "questions": [
    {
      "statement": "string (required)",
      "questionType": "SINGLE_CORRECT | MULTIPLE_CORRECT | NUMERICAL | null",
      "options": [
        {
          "label": "A | B | C | D | E",
          "text": "string (required)"
        }
      ],
      "confidence": {
        "statement": number (0-100),
        "options": number (0-100)
      }
    }
  ]
}

CRITICAL: Use "SINGLE_CORRECT" not "MCQ", "MULTIPLE_CORRECT" not "MSQ".`;
};


