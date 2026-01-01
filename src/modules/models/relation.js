import User from "../auth/auth.model.js";
import UserProfile from "../profile/profile.model.js";

User.hasOne(UserProfile, {
  foreignKey: "userId",
  as: "profile",
});

UserProfile.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

export {
  User,
  UserProfile,
};