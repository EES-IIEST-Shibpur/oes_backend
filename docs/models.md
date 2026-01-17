# Project Models Reference

This document summarizes all Sequelize models in the project, including fields, options, indexes, and associations.

## User (`users`)

- Fields:
  - `id`: UUID, PK, default `UUIDV4`
  - `fullName`: STRING, required
  - `email`: STRING, required, unique, validate `isEmail`
  - `hashedPassword`: STRING, required
  - `role`: ENUM(`USER`, `ADMIN`), required, default `USER`
  - `emailVerified`: BOOLEAN, required, default `false`
  - `passwordResetOTP`: STRING, optional
  - `passwordResetOTPExpiry`: DATE, optional
- Options: `timestamps: true`, `underscored: false`, `tableName: "users"`
- Associations:
  - `User` hasOne `UserProfile` as `profile`
  - `User` hasMany `ExamAttempt`

## UserProfile (`user_profiles`)

- Fields:
  - `userId`: UUID, PK, required (DB field: `user_id`)
  - `enrollmentNumber`: STRING, required, unique (DB field: `enrollment_number`)
  - `course`: ENUM(`BTECH`, `BARCH`, `MTECH`), required
  - `department`: ENUM(`AEAM`, `CE`, `CST`, `EE`, `ETC`, `IT`, `ME`, `MIN`, `MME`), required
  - `year`: ENUM(`ONE`, `TWO`, `THREE`, `FOUR`, `FIVE`), required
  - `semester`: ENUM(`S1`, `S2`, `S3`, `S4`, `S5`, `S6`, `S7`, `S8`), required
- Options: `timestamps: false`, `underscored: true`, `tableName: "user_profiles"`
- Associations:
  - `UserProfile` belongsTo `User` as `user`

## Question (`questions`)

- Fields:
  - `id`: UUID, PK, default `UUIDV4`
  - `statement`: TEXT, required
  - `questionType`: ENUM(`SINGLE_CORRECT`, `MULTIPLE_CORRECT`, `NUMERICAL`), required
  - `domain`: STRING, required
  - `marks`: INTEGER, default `1`
  - `negativeMarks`: FLOAT, default `0`
  - `difficulty`: ENUM(`EASY`, `MEDIUM`, `HARD`), default `MEDIUM`
- Options: `timestamps: true`, `tableName: "questions"`
- Associations:
  - `Question` hasMany `Option` as `options`
  - `Question` hasOne `NumericalAnswer` as `numericalAnswer`
  - `Question` belongsToMany `Exam` through `ExamQuestion` as `exams`
  - `Question` hasMany `ExamQuestion` as `examQuestions`
  - `Question` hasMany `StudentAnswer`

## Option (`options`)

- Fields:
  - `id`: UUID, PK, default `UUIDV4`
  - `text`: STRING, required
  - `isCorrect`: BOOLEAN, default `false`
  - `order`: INTEGER, required
- Options: `timestamps: false`, `tableName: "options"`
- Associations:
  - `Option` belongsTo `Question` as `question`

## NumericalAnswer (`numerical_answers`)

- Fields:
  - `id`: UUID, PK, default `UUIDV4`
  - `questionId`: UUID, required, unique (one-to-one with `Question`)
  - `value`: FLOAT, required
  - `tolerance`: FLOAT, default `0`
- Options: `timestamps: false`, `tableName: "numerical_answers"`
- Associations:
  - `NumericalAnswer` belongsTo `Question` as `question`

## Exam (`exams`)

- Fields:
  - `id`: UUID, PK, default `UUIDV4`
  - `title`: STRING, required
  - `description`: TEXT, optional
  - `durationMinutes`: INTEGER, required
  - `startTime`: DATE, required
  - `endTime`: DATE, required
  - `state`: ENUM(`DRAFT`, `PUBLISHED`, `CLOSED`), required, default `DRAFT`
  - `createdBy`: UUID, required
- Options: `timestamps: true`, `underscored: true`, `tableName: "exams"`
- Associations:
  - `Exam` belongsToMany `Question` through `ExamQuestion` as `questions`
  - `Exam` hasMany `ExamQuestion` as `examQuestions`
  - `Exam` hasMany `ExamAttempt` as `attempts`

## ExamQuestion (`exam_questions`)

- Fields:
  - `id`: UUID, PK, default `UUIDV4`
  - `examId`: UUID, required
  - `questionId`: UUID, required
  - `questionOrder`: INTEGER, required
  - `marksForEachQuestion`: INTEGER, required, default `1`
- Options: `timestamps: false`, `underscored: true`, `tableName: "exam_questions"`
- Indexes:
  - Unique index on (`exam_id`, `question_id`)
- Associations:
  - `ExamQuestion` belongsTo `Exam` as `exam`
  - `ExamQuestion` belongsTo `Question` as `question`

## ExamAttempt (`exam_attempts`)

- Fields:
  - `id`: UUID, PK, default `UUIDV4`
  - `examId`: UUID, required
  - `userId`: UUID, required
  - `startedAt`: DATE, required, default `NOW`
  - `submittedAt`: DATE, optional
  - `status`: ENUM(`IN_PROGRESS`, `SUBMITTED`, `AUTO_SUBMITTED`), required, default `IN_PROGRESS`
  - `score`: INTEGER, optional
- Options: `timestamps: false`, `underscored: true`, `tableName: "exam_attempts"`
- Indexes:
  - Unique index on (`exam_id`, `user_id`)
- Associations:
  - `ExamAttempt` belongsTo `Exam`
  - `ExamAttempt` belongsTo `User`
  - `ExamAttempt` hasMany `StudentAnswer` as `answers`

## StudentAnswer (`student_answers`)

- Fields:
  - `id`: UUID, PK, default `UUIDV4`
  - `examAttemptId`: UUID, required
  - `questionId`: UUID, required
  - `selectedOptionIds`: ARRAY(UUID), optional
  - `numericalAnswer`: FLOAT, optional
  - `marksObtained`: INTEGER, optional
- Options: `timestamps: false`, `underscored: true`, `tableName: "student_answers"`
- Indexes:
  - Unique index on (`exam_attempt_id`, `question_id`)
- Associations:
  - `StudentAnswer` belongsTo `ExamAttempt`
  - `StudentAnswer` belongsTo `Question`

---

Generated automatically from model definitions and associations in `src/modules`.