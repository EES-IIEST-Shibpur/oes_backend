/**
 * Question Draft Validation Utilities
 * 
 * Centralized validation logic for draft questions and options
 */

/**
 * Validates a complete draft question object
 * Used when marking drafts ready and confirming
 */
export const validateDraftQuestion = (draft) => {
    const errors = [];

    // Validate statement
    if (!draft.final_statement) {
        errors.push({
            field: "final_statement",
            message: "Question statement is required",
            severity: "error",
        });
    } else if (draft.final_statement.trim().length === 0) {
        errors.push({
            field: "final_statement",
            message: "Question statement cannot be empty",
            severity: "error",
        });
    } else if (draft.final_statement.length > 5000) {
        errors.push({
            field: "final_statement",
            message: "Question statement cannot exceed 5000 characters",
            severity: "error",
        });
    }

    // Validate question type
    if (!draft.final_questionType) {
        errors.push({
            field: "final_questionType",
            message: "Question type is required",
            severity: "error",
        });
    } else if (!["SINGLE_CORRECT", "MULTIPLE_CORRECT", "NUMERICAL"].includes(draft.final_questionType)) {
        errors.push({
            field: "final_questionType",
            message: "Invalid question type",
            severity: "error",
        });
    }

    // Validate domain
    if (!draft.final_domain) {
        errors.push({
            field: "final_domain",
            message: "Domain is required",
            severity: "error",
        });
    } else if (draft.final_domain.trim().length === 0) {
        errors.push({
            field: "final_domain",
            message: "Domain cannot be empty",
            severity: "error",
        });
    }

    // Validate difficulty
    if (draft.final_difficulty && !["EASY", "MEDIUM", "HARD"].includes(draft.final_difficulty)) {
        errors.push({
            field: "final_difficulty",
            message: "Invalid difficulty level",
            severity: "error",
        });
    }

    // Validate marks
    if (typeof draft.final_marks !== "number" || draft.final_marks < 0) {
        errors.push({
            field: "final_marks",
            message: "Marks must be a non-negative number",
            severity: "error",
        });
    }

    // Validate negative marks
    if (typeof draft.final_negativeMarks !== "number" || draft.final_negativeMarks < 0) {
        errors.push({
            field: "final_negativeMarks",
            message: "Negative marks must be a non-negative number",
            severity: "error",
        });
    }

    // Validate options (if not NUMERICAL)
    if (draft.final_questionType !== "NUMERICAL") {
        if (!draft.options || draft.options.length === 0) {
            errors.push({
                field: "options",
                message: "Question must have at least one option",
                severity: "error",
            });
        } else if (draft.options.length < 2) {
            errors.push({
                field: "options",
                message: "Question must have at least 2 options",
                severity: "error",
            });
        } else if (draft.options.length > 10) {
            errors.push({
                field: "options",
                message: "Question cannot have more than 10 options",
                severity: "error",
            });
        } else {
            // Validate each option
            const optionErrors = validateDraftOptions(draft.options, draft.final_questionType);

            errors.push(...optionErrors);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings: extractWarnings(draft),
    };
};

/**
 * Validates draft option objects
 */
export const validateDraftOptions = (options, questionType) => {
    const errors = [];

    // Check for empty options
    const emptyTexts = options.filter((o) => !o.final_text || o.final_text.trim().length === 0);

    if (emptyTexts.length > 0) {
        errors.push({
            field: "options[].final_text",
            message: `${emptyTexts.length} option(s) have empty text`,
            severity: "error",
        });
    }

    // Check for duplicate options
    const texts = options
        .filter((o) => o.final_text)
        .map((o) => o.final_text.toLowerCase());

    const duplicates = texts.filter((item, index) => texts.indexOf(item) !== index);

    if (duplicates.length > 0) {
        errors.push({
            field: "options",
            message: "Duplicate option text found",
            severity: "warning",
        });
    }

    // Validate correct answers based on question type
    const correctCount = options.filter((o) => o.final_isCorrect === true).length;

    if (questionType === "SINGLE_CORRECT") {
        if (correctCount === 0) {
            errors.push({
                field: "options[].final_isCorrect",
                message: "SINGLE_CORRECT must have exactly 1 correct option",
                severity: "error",
            });
        } else if (correctCount > 1) {
            errors.push({
                field: "options[].final_isCorrect",
                message: "SINGLE_CORRECT must have exactly 1 correct option, found " + correctCount,
                severity: "error",
            });
        }
    } else if (questionType === "MULTIPLE_CORRECT") {
        if (correctCount === 0) {
            errors.push({
                field: "options[].final_isCorrect",
                message: "MULTIPLE_CORRECT must have at least 1 correct option",
                severity: "error",
            });
        }
    }

    return errors;
};

/**
 * Extract non-critical warnings that should be shown to admin
 */
const extractWarnings = (draft) => {
    const warnings = [];

    // Low confidence warning
    if (draft.predicted_confidence && draft.predicted_confidence < 60) {
        warnings.push({
            field: "predicted_confidence",
            message: `Low AI confidence (${draft.predicted_confidence}%). Please review carefully.`,
            severity: "warning",
        });
    }

    // Short statement warning
    if (draft.final_statement && draft.final_statement.length < 20) {
        warnings.push({
            field: "final_statement",
            message: "Question statement is quite short. Consider adding more detail.",
            severity: "info",
        });
    }

    // Check for low confidence options
    const lowConfidenceOptions = draft.options?.filter(
        (o) => o.predicted_confidence && o.predicted_confidence < 60
    ) || [];

    if (lowConfidenceOptions.length > 0) {
        warnings.push({
            field: "options",
            message: `${lowConfidenceOptions.length} option(s) have low AI confidence. Review before confirming.`,
            severity: "warning",
        });
    }

    return warnings;
};

/**
 * Validates request body for draft updates
 * Ensures only allowed fields are being updated
 */
export const validateDraftUpdateRequest = (updates) => {
    const allowedFields = [
        "final_statement",
        "final_questionType",
        "final_domain",
        "final_marks",
        "final_negativeMarks",
        "final_difficulty",
        "adminNotes",
    ];

    const forbiddenFields = Object.keys(updates).filter(
        (key) => !allowedFields.includes(key) && !key.startsWith("_")
    );

    if (forbiddenFields.length > 0) {
        return {
            isValid: false,
            errors: [
                {
                    field: "body",
                    message: `Cannot update fields: ${forbiddenFields.join(", ")}. Only final_* fields are editable.`,
                    severity: "error",
                },
            ],
        };
    }

    // Check for predicted_* attempts
    const predictedAttempts = Object.keys(updates).filter((key) => key.startsWith("predicted_"));

    if (predictedAttempts.length > 0) {
        return {
            isValid: false,
            errors: [
                {
                    field: "body",
                    message: "Cannot edit predicted_* fields. These are AI-generated and read-only.",
                    severity: "error",
                },
            ],
        };
    }

    return { isValid: true, errors: [] };
};

/**
 * Validates request body for draft option updates
 */
export const validateOptionUpdateRequest = (updates) => {
    const allowedFields = ["final_text", "final_isCorrect", "adminNotes"];

    const forbiddenFields = Object.keys(updates).filter(
        (key) => !allowedFields.includes(key) && !key.startsWith("_")
    );

    if (forbiddenFields.length > 0) {
        return {
            isValid: false,
            errors: [
                {
                    field: "body",
                    message: `Cannot update fields: ${forbiddenFields.join(", ")}. Only final_* fields are editable.`,
                    severity: "error",
                },
            ],
        };
    }

    // Check for predicted_* attempts
    const predictedAttempts = Object.keys(updates).filter((key) => key.startsWith("predicted_"));

    if (predictedAttempts.length > 0) {
        return {
            isValid: false,
            errors: [
                {
                    field: "body",
                    message: "Cannot edit predicted_* fields. These are AI-generated and read-only.",
                    severity: "error",
                },
            ],
        };
    }

    return { isValid: true, errors: [] };
};

/**
 * Validates ingest request body
 */
export const validateIngestRequest = (body, hasFile) => {
    const errors = [];

    if (!body.sourceType) {
        errors.push({
            field: "sourceType",
            message: "sourceType is required",
            severity: "error",
        });
    } else if (!["TEXT", "IMAGE", "PDF", "CSV"].includes(body.sourceType)) {
        errors.push({
            field: "sourceType",
            message: "Invalid sourceType. Must be TEXT, IMAGE, PDF, or CSV",
            severity: "error",
        });
    }

    if (!body.batchName || body.batchName.trim().length === 0) {
        errors.push({
            field: "batchName",
            message: "batchName is required and cannot be empty",
            severity: "error",
        });
    }

    if (body.sourceType === "TEXT" && !body.text) {
        errors.push({
            field: "text",
            message: "text field is required for TEXT source type",
            severity: "error",
        });
    }

    if (body.sourceType !== "TEXT" && !hasFile) {
        errors.push({
            field: "file",
            message: `file upload is required for ${body.sourceType} source type`,
            severity: "error",
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

/**
 * Formats validation response for API
 */
export const formatValidationResponse = (validation, includeWarnings = true) => {
    const response = {
        isValid: validation.isValid,
        errorCount: validation.errors.length,
        errors: validation.errors,
    };

    if (includeWarnings && validation.warnings && validation.warnings.length > 0) {
        response.warningCount = validation.warnings.length;
        response.warnings = validation.warnings;
    }

    return response;
};
