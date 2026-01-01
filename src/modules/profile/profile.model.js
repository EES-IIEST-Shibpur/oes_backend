import { DataTypes } from "sequelize";
import sequelize from "../../config/db.js";

const UserProfile = sequelize.define(
  "UserProfile",
  {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      field: "user_id",
    },

    enrollmentNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "enrollment_number",
    },

    course: {
      type: DataTypes.ENUM("BTECH", "BARCH", "MTECH"),
      allowNull: false,
    },

    department: {
      type: DataTypes.ENUM(
        "AEAM",
        "CE",
        "CST",
        "EE",
        "ETC",
        "IT",
        "ME",
        "MIN",
        "MME"
      ),
      allowNull: false,
    },

    year: {
      type: DataTypes.ENUM("ONE", "TWO", "THREE", "FOUR", "FIVE"),
      allowNull: false,
    },

    semester: {
      type: DataTypes.ENUM(
        "S1",
        "S2",
        "S3",
        "S4",
        "S5",
        "S6",
        "S7",
        "S8"
      ),
      allowNull: false,
    },
  },
  {
    tableName: "user_profiles",
    timestamps: false,
    underscored: true,
  }
);

export default UserProfile;