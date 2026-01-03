export const calculateExamScore = async (answers) => {
    let totalScore = 0;

    for (const ans of answers) {
        const question = ans.Question;
        let marksObtained = 0;

        if (question.questionType === "SINGLE_CORRECT") {
            const correctOption = question.options.find(
                option => option.isCorrect === true
            );

            if (
                correctOption &&
                correctOption.id === ans.selectedOptionId
            ) {
                marksObtained = question.marks;
            } else {
                marksObtained = -question.negativeMarks;
            }
        }

        if (question.questionType === "MULTIPLE_CORRECT") {
            const correctOptionIds = question.options
                .filter(option => option.isCorrect)
                .map(option => option.id);

            const selectedOptionIds = ans.selectedOptionIds || [];

            const selectedSet = new Set(selectedOptionIds);
            const correctSet = new Set(correctOptionIds);

            let isCorrect = true;

            // 1 Must select same count
            if (selectedSet.size !== correctSet.size) {
                isCorrect = false;
            }

            // 2 Every selected option must be correct
            for (const id of selectedSet) {
                if (!correctSet.has(id)) {
                    isCorrect = false;
                    break;
                }
            }

            if (isCorrect) {
                marksObtained = question.marks;
            } else {
                marksObtained = 0;
            }
        }

        if (question.questionType === "NUMERICAL") {
            const numerical = question.NumericalAnswer;

            if (
                numerical &&
                typeof ans.numericalAnswer === "number"
            ) {
                const diff = Math.abs(
                    ans.numericalAnswer - numerical.value
                );

                if (diff <= numerical.tolerance) {
                    marksObtained = question.marks;
                } else {
                    marksObtained = -question.negativeMarks;
                }
            }
        }

        ans.marksObtained = marksObtained;
        totalScore += marksObtained;

        await ans.save();
    }

    return totalScore;
};