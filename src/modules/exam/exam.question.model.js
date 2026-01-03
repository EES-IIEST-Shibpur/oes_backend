import { DataTypes } from "sequelize";
import sequelize  from "../../config/db.js";

const ExamQuestion = sequelize.define(
    "ExamQuestion",
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

        questionId: {
            type: DataTypes.UUID,
            allowNull: false,
        },

        questionOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        marksForEachQuestion: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            allowNull: false,
        },
    },
    {
        tableName: "exam_questions",
        timestamps: false,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ["exam_id", "question_id"],
            },
        ],
    }
);

export default ExamQuestion;