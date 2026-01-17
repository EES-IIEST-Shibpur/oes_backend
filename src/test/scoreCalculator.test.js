// scoreCalculator.test.js
import { calculateExamScore } from '../services/examScore.service.js';

// Mock save function
const mockSave = () => Promise.resolve();

describe('calculateExamScore', () => {

    test('returns full score when all SINGLE_CORRECT answers are correct', async () => {
        const saveSpy1 = { called: false };
        const saveSpy2 = { called: false };

        const mockAnswers = [
            {
                marksObtained: null,
                selectedOptionId: 1,
                Question: {
                    questionType: 'SINGLE_CORRECT',
                    marks: 1,
                    negativeMarks: 0.25,
                    options: [
                        { id: 1, isCorrect: true },
                        { id: 2, isCorrect: false }
                    ]
                },
                save: () => { saveSpy1.called = true; return Promise.resolve(); }
            },
            {
                marksObtained: null,
                selectedOptionId: 3,
                Question: {
                    questionType: 'SINGLE_CORRECT',
                    marks: 1,
                    negativeMarks: 0.25,
                    options: [
                        { id: 3, isCorrect: true },
                        { id: 4, isCorrect: false }
                    ]
                },
                save: () => { saveSpy2.called = true; return Promise.resolve(); }
            }
        ];

        const result = await calculateExamScore(mockAnswers, null);
        expect(result).toBe(2);
        expect(mockAnswers[0].marksObtained).toBe(1);
        expect(mockAnswers[1].marksObtained).toBe(1);
    });

    test('applies negative marking for wrong SINGLE_CORRECT answers', async () => {
        const mockAnswers = [
            {
                marksObtained: null,
                selectedOptionId: 1,
                Question: {
                    questionType: 'SINGLE_CORRECT',
                    marks: 1,
                    negativeMarks: 0.25,
                    options: [
                        { id: 1, isCorrect: true },
                        { id: 2, isCorrect: false }
                    ]
                },
                save: mockSave
            },
            {
                marksObtained: null,
                selectedOptionId: 4,
                Question: {
                    questionType: 'SINGLE_CORRECT',
                    marks: 1,
                    negativeMarks: 0.25,
                    options: [
                        { id: 3, isCorrect: true },
                        { id: 4, isCorrect: false }
                    ]
                },
                save: mockSave
            }
        ];

        const result = await calculateExamScore(mockAnswers, null);
        expect(result).toBe(0.75);
        expect(mockAnswers[0].marksObtained).toBe(1);
        expect(mockAnswers[1].marksObtained).toBe(-0.25);
    });

    test('correctly scores MULTIPLE_CORRECT questions', async () => {
        const mockAnswers = [
            {
                marksObtained: null,
                selectedOptionIds: [1, 2],
                Question: {
                    questionType: 'MULTIPLE_CORRECT',
                    marks: 2,
                    negativeMarks: 0,
                    options: [
                        { id: 1, isCorrect: true },
                        { id: 2, isCorrect: true },
                        { id: 3, isCorrect: false }
                    ]
                },
                save: mockSave
            },
            {
                marksObtained: null,
                selectedOptionIds: [4, 5],
                Question: {
                    questionType: 'MULTIPLE_CORRECT',
                    marks: 2,
                    negativeMarks: 0,
                    options: [
                        { id: 4, isCorrect: true },
                        { id: 5, isCorrect: false },
                        { id: 6, isCorrect: false }
                    ]
                },
                save: mockSave
            }
        ];

        const result = await calculateExamScore(mockAnswers, null);
        expect(result).toBe(2);
        expect(mockAnswers[0].marksObtained).toBe(2);
        expect(mockAnswers[1].marksObtained).toBe(0);
    });

    test('correctly scores NUMERICAL questions within tolerance', async () => {
        const mockAnswers = [
            {
                marksObtained: null,
                numericalAnswer: 10.5,
                Question: {
                    questionType: 'NUMERICAL',
                    marks: 2,
                    negativeMarks: 0.5,
                    NumericalAnswer: {
                        value: 10.0,
                        tolerance: 0.5
                    }
                },
                save: mockSave
            },
            {
                marksObtained: null,
                numericalAnswer: 15.0,
                Question: {
                    questionType: 'NUMERICAL',
                    marks: 2,
                    negativeMarks: 0.5,
                    NumericalAnswer: {
                        value: 10.0,
                        tolerance: 0.5
                    }
                },
                save: mockSave
            }
        ];

        const result = await calculateExamScore(mockAnswers, null);
        expect(result).toBe(1.5);
        expect(mockAnswers[0].marksObtained).toBe(2);
        expect(mockAnswers[1].marksObtained).toBe(-0.5);
    });

    test('skips already scored answers', async () => {
        let saveCalled = false;
        const mockAnswers = [
            {
                marksObtained: 5,
                selectedOptionId: 1,
                Question: {
                    questionType: 'SINGLE_CORRECT',
                    marks: 1,
                    negativeMarks: 0.25,
                    options: [
                        { id: 1, isCorrect: true }
                    ]
                },
                save: () => { saveCalled = true; return Promise.resolve(); }
            }
        ];

        const result = await calculateExamScore(mockAnswers, null);
        expect(result).toBe(0);  // Already scored answers are not added to total
        expect(saveCalled).toBe(false);
    });
});
