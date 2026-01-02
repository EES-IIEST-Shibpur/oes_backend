import { DataTypes } from "sequelize";
import { sequelize } from "../../config/db.js";

const StudentAnswer = sequelize.define(
  "StudentAnswer",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    examAttemptId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    selectedOptionId: {
      type: DataTypes.UUID,
      allowNull: true, // for MCQ
    },

    numericalAnswer: {
      type: DataTypes.FLOAT,
      allowNull: true, // for numerical
    },

    descriptiveAnswer: {
      type: DataTypes.TEXT,
      allowNull: true, // for descriptive
    },

    marksObtained: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "student_answers",
    timestamps: false,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["exam_attempt_id", "question_id"],
      },
    ],
  }
);

export default StudentAnswer;