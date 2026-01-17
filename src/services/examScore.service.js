import { ExamQuestion, NumericalAnswer, Option, Question, StudentAnswer, ExamAttempt } from "../modules/association/index.js";
import sequelize from "../config/db.js";

export const calculateExamScore = async (examId, userId) => {
    const transaction = await sequelize.transaction();

    try {
        // 1. Find and validate exam attempt
        const attempt = await ExamAttempt.findOne({
            where: { userId, examId },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!attempt) {
            await transaction.rollback();
            return {
                success: false,
                error: "NOT_FOUND",
                message: "No exam attempt found",
            };
        }

        // 2. Check if exam is submitted
        if (attempt.status === "IN_PROGRESS") {
            await transaction.rollback();
            return {
                success: false,
                error: "NOT_SUBMITTED",
                message: "Exam not yet submitted",
            };
        }

        // 3. Idempotency check - if already calculated, return existing score
        if (attempt.score !== null) {
            await transaction.rollback();
            return {
                success: true,
                alreadyCalculated: true,
                message: "Score already calculated",
                data: {
                    attemptId: attempt.id,
                    examId,
                    userId,
                    score: attempt.score,
                    status: attempt.status,
                },
            };
        }

        // 4. Load exam questions (authoritative list)
        const examQuestions = await ExamQuestion.findAll({
            where: { examId },
            include: [
                {
                    model: Question,
                    as: "question",
                    include: [
                        { model: Option, as: "options" },
                        { model: NumericalAnswer, as: "numericalAnswer" },
                    ],
                },
            ],
            transaction,
        });

        if (examQuestions.length === 0) {
            await transaction.rollback();
            return {
                success: false,
                error: "NO_QUESTIONS",
                message: "No questions found for this exam",
            };
        }

        // 5. Load student answers once
        const studentAnswers = await StudentAnswer.findAll({
            where: { examAttemptId: attempt.id },
            transaction,
        });

        const answerMap = new Map(
            studentAnswers.map(a => [a.questionId, a])
        );

        let totalScore = 0;

        // 6. Evaluate EACH exam question
        for (const eq of examQuestions) {
            const question = eq.question;
            const marks = eq.marksForEachQuestion;
            const studentAnswer = answerMap.get(question.id);

            let marksObtained = 0;

            // --- UNATTEMPTED ---
            if (!studentAnswer) {
                marksObtained = 0;
            }

            // --- SINGLE CORRECT ---
            else if (question.questionType === "SINGLE_CORRECT") {
                const selectedIds = studentAnswer.selectedOptionIds || [];

                if (selectedIds.length === 0) {
                    marksObtained = 0;
                } else {
                    const correctOption = question.options.find(o => o.isCorrect);
                    marksObtained =
                        correctOption && selectedIds[0] === correctOption.id
                            ? marks
                            : -question.negativeMarks;
                }
            }

            // --- MULTIPLE CORRECT ---
            else if (question.questionType === "MULTIPLE_CORRECT") {
                const selectedIds = studentAnswer.selectedOptionIds || [];
                const correctIds = question.options
                    .filter(o => o.isCorrect)
                    .map(o => o.id);

                if (selectedIds.length === 0) {
                    marksObtained = 0;
                } else {
                    const isExactMatch =
                        selectedIds.length === correctIds.length &&
                        selectedIds.every(id => correctIds.includes(id));

                    marksObtained = isExactMatch
                        ? marks
                        : -question.negativeMarks;
                }
            }

            // --- NUMERICAL ---
            else if (question.questionType === "NUMERICAL") {
                const num = question.numericalAnswer;

                if (
                    num &&
                    studentAnswer.numericalAnswer !== null &&
                    studentAnswer.numericalAnswer !== undefined
                ) {
                    const diff = Math.abs(
                        studentAnswer.numericalAnswer - num.value
                    );

                    marksObtained =
                        diff <= num.tolerance
                            ? marks
                            : -question.negativeMarks;
                } else {
                    marksObtained = 0;
                }
            }

            // Clamp if needed
            marksObtained = Math.max(0, marksObtained);

            // Save per-question marks
            if (studentAnswer) {
                studentAnswer.marksObtained = marksObtained;
                await studentAnswer.save({ transaction });
            }

            totalScore += marksObtained;
        }

        // 7. Update attempt with calculated score
        attempt.score = totalScore;
        await attempt.save({ transaction });

        await transaction.commit();

        return {
            success: true,
            alreadyCalculated: false,
            message: "Score calculated successfully",
            data: {
                attemptId: attempt.id,
                examId,
                userId,
                score: totalScore,
                status: attempt.status,
            },
        };

    } catch (error) {
        await transaction.rollback();
        console.error("Error in calculateExamScore:", error);
        return {
            success: false,
            error: "SERVER_ERROR",
            message: "Server error: Unable to calculate score",
            details: error.message,
        };
    }
};