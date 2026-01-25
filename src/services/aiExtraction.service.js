/**
 * AI Question Extraction Service
 * 
 * Handles integration with third-party AI models for question extraction.
 * Initially mocked with sample data; can be swapped with real AI API calls.
 * 
 * Responsibilities:
 * - Call OCR if needed (stub)
 * - Call AI model to extract questions (mock)
 * - Parse and structure AI response
 * - Calculate confidence scores
 */

/**
 * Mock AI Model: Simulates calling an external AI service
 * 
 * Real implementation would call services like:
 * - OpenAI GPT-4 Vision (for images/PDFs)
 * - Claude API
 * - Google Gemini
 * - Specialized question extraction APIs
 */
export const callAIQuestionExtraction = async (content, sourceType) => {
    // In production, implement actual API calls here
    // For now, return mock data with realistic structure

    return {
        success: true,
        questionsExtracted: 3,
        questions: [
            {
                statement: "What is the capital of France?",
                questionType: "SINGLE_CORRECT",
                domain: "Geography",
                difficulty: "EASY",
                confidence: 95,
                options: [
                    {
                        text: "Paris",
                        isCorrect: true,
                        confidence: 98,
                    },
                    {
                        text: "Lyon",
                        isCorrect: false,
                        confidence: 95,
                    },
                    {
                        text: "Marseille",
                        isCorrect: false,
                        confidence: 96,
                    },
                    {
                        text: "Toulouse",
                        isCorrect: false,
                        confidence: 94,
                    },
                ],
            },
            {
                statement: "Which of the following are valid JavaScript data types? (Select all that apply)",
                questionType: "MULTIPLE_CORRECT",
                domain: "Programming",
                difficulty: "MEDIUM",
                confidence: 87,
                options: [
                    {
                        text: "String",
                        isCorrect: true,
                        confidence: 99,
                    },
                    {
                        text: "Integer",
                        isCorrect: false,
                        confidence: 92,
                    },
                    {
                        text: "Object",
                        isCorrect: true,
                        confidence: 99,
                    },
                    {
                        text: "Boolean",
                        isCorrect: true,
                        confidence: 99,
                    },
                ],
            },
            {
                statement: "What is the atomic number of Carbon?",
                questionType: "SINGLE_CORRECT",
                domain: "Chemistry",
                difficulty: "MEDIUM",
                confidence: 92,
                options: [
                    {
                        text: "4",
                        isCorrect: true,
                        confidence: 99,
                    },
                    {
                        text: "6",
                        isCorrect: false,
                        confidence: 88,
                    },
                    {
                        text: "8",
                        isCorrect: false,
                        confidence: 89,
                    },
                    {
                        text: "12",
                        isCorrect: false,
                        confidence: 90,
                    },
                ],
            },
        ],
    };
};

/**
 * Mock OCR Service: Simulates extracting text from images/PDFs
 * 
 * Real implementation would call:
 * - Tesseract.js
 * - AWS Textract
 * - Google Cloud Vision API
 * - Azure Computer Vision
 */
export const performOCR = async (fileBuffer, fileType) => {
    // In production, implement actual OCR here
    // This is a stub that pretends to extract text

    console.log(`[OCR Stub] Processing ${fileType} file`);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
        success: true,
        extractedText: "Sample text extracted from image/PDF",
        confidence: 85,
    };
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

    if (question.questionType !== "NUMERICAL") {
        const correctCount = question.options.filter((o) => o.isCorrect).length;

        if (question.questionType === "SINGLE_CORRECT" && correctCount !== 1) {
            errors.push("SINGLE_CORRECT must have exactly 1 correct option");
        }

        if (question.questionType === "MULTIPLE_CORRECT" && correctCount === 0) {
            errors.push("MULTIPLE_CORRECT must have at least 1 correct option");
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};
