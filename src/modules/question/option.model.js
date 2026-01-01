import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Option = sequelize.define(
  "Option",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    text: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    isCorrect: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "options",
    timestamps: false,
  }
);

export default Option;