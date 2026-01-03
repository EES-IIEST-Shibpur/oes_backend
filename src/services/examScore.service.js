export const calculateExamScore = async (answers, transaction) => {
    let totalScore = 0;

    for (const ans of answers) {
        if (ans.marksObtained !== null) continue;

        const question = ans.Question;
        let marksObtained = 0;

        if (question.questionType === "SINGLE_CORRECT") {
            const correct = question.options.find(o => o.isCorrect);
            marksObtained =
                correct && correct.id === ans.selectedOptionId
                    ? question.marks
                    : -question.negativeMarks;
        }

        if (question.questionType === "MULTIPLE_CORRECT") {
            const correctIds = question.options
                .filter(o => o.isCorrect)
                .map(o => o.id);

            const selectedIds = ans.selectedOptionIds || [];

            const isCorrect =
                selectedIds.length === correctIds.length &&
                selectedIds.every(id => correctIds.includes(id));

            marksObtained = isCorrect ? question.marks : 0;
        }

        if (question.questionType === "NUMERICAL") {
            const num = question.NumericalAnswer;
            if (num) {
                const diff = Math.abs(ans.numericalAnswer - num.value);
                marksObtained =
                    diff <= num.tolerance
                        ? question.marks
                        : -question.negativeMarks;
            }
        }

        ans.marksObtained = marksObtained;
        totalScore += marksObtained;

        await ans.save({ transaction });
    }

    return totalScore;
};