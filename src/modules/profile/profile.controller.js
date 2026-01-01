import sequelize from "../../config/db.js";
import User from "../auth/auth.model.js";
import UserProfile from "./profile.model.js";

// Get user profile
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findByPk(userId, {
      attributes: ["id", "fullName", "email"],
      include: [
        {
          model: UserProfile,
          as: "profile",
          required: false,
          attributes: [
            "enrollmentNumber",
            "course",
            "department",
            "year",
            "semester",
          ],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
};

// Update user profile
export const updateMyProfile = async (req, res) => {
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const userId = req.user.userId;
    const {
      fullName,
      course,
      department,
      year,
      semester,
      enrollmentNumber,
    } = req.body;

    const user = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: false
    });


    if (!user) {
      throw new Error("User not found");
    }

    if (fullName) {
      user.fullName = fullName;
      await user.save({ transaction });
    }

    if (user.profile) {
      await user.profile.update(
        {
          ...(course && { course }),
          ...(department && { department }),
          ...(year && { year }),
          ...(semester && { semester }),
          ...(enrollmentNumber && { enrollmentNumber }),
        },
        { transaction }
      );
    } else {
      if (!enrollmentNumber) {
        throw new Error("Enrollment number is required");
      }

      await UserProfile.create(
        {
          userId,
          enrollmentNumber,
          ...(course && { course }),
          ...(department && { department }),
          ...(year && { year }),
          ...(semester && { semester }),
        },
        { transaction }
      );
    }

    await transaction.commit();

    const updatedUser = await User.findByPk(userId, {
      include: [{ model: UserProfile, as: "profile" }],
    });

    return res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Update profile error:", error);
    return res.status(500).json({ error: error.message });
  }
};