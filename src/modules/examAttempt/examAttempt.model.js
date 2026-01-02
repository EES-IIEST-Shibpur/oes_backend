import { DataTypes } from "sequelize";
import { sequelize } from "../../config/db.js";

const ExamAttempt = sequelize.define(
  "ExamAttempt",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    examId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "IN_PROGRESS",
        "SUBMITTED",
        "AUTO_SUBMITTED"
      ),
      allowNull: false,
      defaultValue: "IN_PROGRESS",
    },

    score: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "exam_attempts",
    timestamps: false,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["exam_id", "user_id"], // prevents multiple attempts
      },
    ],
  }
);

export default ExamAttempt;