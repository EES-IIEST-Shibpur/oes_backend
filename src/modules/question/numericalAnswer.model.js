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

    value: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    tolerance: {
      // optional: for decimal answers
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