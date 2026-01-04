import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const NumericalAnswer = sequelize.define(
  "NumericalAnswer",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true, // one-to-one with Question
    },

    value: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    tolerance: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
  },
  {
    tableName: "numerical_answers",
    timestamps: false,
  }
);

export default NumericalAnswer;