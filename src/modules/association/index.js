import User from "../auth/auth.model.js";
import UserProfile from "../profile/profile.model.js";
import NumericalAnswer from "../question/numericalAnswer.model.js";
import Option from "../question/option.model.js";
import Question from "../question/question.model.js";

User.hasOne(UserProfile, {
  foreignKey: "userId",
  as: "profile",
});

UserProfile.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

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
  onDelete: "CASCADE",
});

NumericalAnswer.belongsTo(Question, {
  foreignKey: "questionId",
});

export {
  User,
  UserProfile,
  Question,
  Option,
  NumericalAnswer,
};