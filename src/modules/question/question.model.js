import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const Question = sequelize.define(
    "Question",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },

        statement: {
            type: DataTypes.TEXT,
            allowNull: false,
        },

        questionType: {
            type: DataTypes.ENUM(
                "SINGLE_CORRECT",
                "MULTIPLE_CORRECT",
                "NUMERICAL"
            ),
            allowNull: false,
        },

        domain: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        marks: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },

        negativeMarks: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },

        difficulty: {
            type: DataTypes.ENUM("EASY", "MEDIUM", "HARD"),
            defaultValue: "MEDIUM",
        },
    },
    {
        tableName: "questions",
        timestamps: true,
    }
);

export default Question;