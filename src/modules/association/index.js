import User from "../auth/auth.model.js";
import UserProfile from "../profile/profile.model.js";
import Question from "../question/question.model.js";
import Option from "../question/option.model.js";
import NumericalAnswer from "../question/numericalAnswer.model.js";
import Exam from "../exam/exam.model.js";
import ExamQuestion from "../exam/exam.question.model.js";
import ExamAttempt from "../examAttempt/examAttempt.model.js";
import StudentAnswer from "../examAttempt/studentAnswer.model.js";
import QuestionDraftBatch from "../questionDraft/questionDraftBatch.model.js";
import QuestionDraft from "../questionDraft/questionDraft.model.js";
import QuestionOptionDraft from "../questionDraft/questionOptionDraft.model.js";

/* ---------------- USER ---------------- */

User.hasOne(UserProfile, {
  foreignKey: "userId",
  as: "profile",
  onDelete: "CASCADE",
});

UserProfile.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

/* ---------------- QUESTION ---------------- */

Question.hasMany(Option, {
  foreignKey: "questionId",
  as: "options",
  onDelete: "CASCADE",
});

Option.belongsTo(Question, {
  foreignKey: "questionId",
  as: "question",
});

Question.hasOne(NumericalAnswer, {
  foreignKey: "questionId",
  as: "numericalAnswer",
  onDelete: "CASCADE",
});

NumericalAnswer.belongsTo(Question, {
  foreignKey: "questionId",
  as: "question",
});

/* ---------------- EXAM ↔ QUESTION ---------------- */

// Many-to-Many
Exam.belongsToMany(Question, {
  through: ExamQuestion,
  foreignKey: "examId",
  otherKey: "questionId",
  as: "questions",
});

Question.belongsToMany(Exam, {
  through: ExamQuestion,
  foreignKey: "questionId",
  otherKey: "examId",
  as: "exams",
});

// Direct access to join table (for order, marks)
Exam.hasMany(ExamQuestion, {
  foreignKey: "examId",
  as: "examQuestions",
  onDelete: "CASCADE",
});

Question.hasMany(ExamQuestion, {
  foreignKey: "questionId",
  as: "examQuestions",
  onDelete: "CASCADE",
});

ExamQuestion.belongsTo(Exam, {
  foreignKey: "examId",
  as: "exam",
});

ExamQuestion.belongsTo(Question, {
  foreignKey: "questionId",
  as: "question",
});

Exam.hasMany(ExamAttempt, { foreignKey: "examId", as: "attempts" });
ExamAttempt.belongsTo(Exam, { foreignKey: "examId" });

User.hasMany(ExamAttempt, { foreignKey: "userId" });
ExamAttempt.belongsTo(User, { foreignKey: "userId" });

/* Student Answers */
ExamAttempt.hasMany(StudentAnswer, {
  foreignKey: "examAttemptId",
  as: "answers",
  onDelete: "CASCADE",
});

StudentAnswer.belongsTo(ExamAttempt, {
  foreignKey: "examAttemptId",
});

Question.hasMany(StudentAnswer, { foreignKey: "questionId" });
StudentAnswer.belongsTo(Question, { foreignKey: "questionId" });

/* ---------------- QUESTION DRAFTS ↔ DRAFT OPTIONS ↔ BATCH ---- */

QuestionDraftBatch.hasMany(QuestionDraft, {
  foreignKey: "batchId",
  as: "drafts",
  onDelete: "CASCADE",
});

QuestionDraft.belongsTo(QuestionDraftBatch, {
  foreignKey: "batchId",
  as: "batch",
});

QuestionDraft.hasMany(QuestionOptionDraft, {
  foreignKey: "draftQuestionId",
  as: "options",
  onDelete: "CASCADE",
});

QuestionOptionDraft.belongsTo(QuestionDraft, {
  foreignKey: "draftQuestionId",
  as: "question",
});

export {
  User,
  UserProfile,
  Question,
  Option,
  NumericalAnswer,
  Exam,
  ExamQuestion,
  ExamAttempt,
  StudentAnswer,
  QuestionDraftBatch,
  QuestionDraft,
  QuestionOptionDraft,
};