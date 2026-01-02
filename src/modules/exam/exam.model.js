import { DataTypes } from "sequelize";
import { sequelize } from "../../config/db.js";

const Exam = sequelize.define(
    "Exam",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },

        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

        durationMinutes: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        startTime: {
            type: DataTypes.DATE,
            allowNull: false,
        },

        endTime: {
            type: DataTypes.DATE,
            allowNull: false,
        },

        state: {
            type: DataTypes.ENUM("DRAFT", "PUBLISHED", "CLOSED"),
            defaultValue: "DRAFT",
            allowNull: false,
        },

        createdBy: {
            type: DataTypes.UUID,
            allowNull: false,
        },
    },
    {
        tableName: "exams",
        timestamps: true,
        underscored: true,
    }
);

export default Exam;