import sequelize from "../../config/db.js";
import { User, UserProfile } from "../association/index.js"

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
    return res.status(500).json({
      success: false,
      message: "Server error: Failed to fetch profile"
    });
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
      lock: {
        level: transaction.LOCK.UPDATE,
        of: User,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (fullName !== undefined) {
      user.fullName = fullName;
      await user.save({ transaction });
    }

    const profile = await UserProfile.findOne({
      where: { userId },
      transaction,
    });

    if (profile) {
      await profile.update(
        {
          ...(course !== undefined && { course }),
          ...(department !== undefined && { department }),
          ...(year !== undefined && { year }),
          ...(semester !== undefined && { semester }),
          ...(enrollmentNumber !== undefined && { enrollmentNumber }),
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
          ...(course !== undefined && { course }),
          ...(department !== undefined && { department }),
          ...(year !== undefined && { year }),
          ...(semester !== undefined && { semester }),
        },
        { transaction }
      );
    }

    await transaction.commit();

    return res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    if (transaction) await transaction.rollback();

    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error: Failed to update profile",
    });
  }
};