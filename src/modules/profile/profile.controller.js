import sequelize from "../../config/db.js";
import { User, UserProfile } from "../association/index.js"

// Get user profile
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findByPk(userId, {
      attributes: ["id", "fullName", "email", "emailVerified"],
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
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.status(200).json({
      message: "Profile retrieved successfully",
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerified: user.emailVerified,
        profile: user.profile || null,
        profileComplete: !!user.profile && user.profile.enrollmentNumber,
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      message: "Failed to fetch profile. Please try again later."
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

    // Validate required fields
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        message: "Full name is required"
      });
    }

    if (!course) {
      return res.status(400).json({
        message: "Course is required"
      });
    }

    if (!department) {
      return res.status(400).json({
        message: "Department is required"
      });
    }

    if (!year) {
      return res.status(400).json({
        message: "Year is required"
      });
    }

    if (!semester) {
      return res.status(400).json({
        message: "Semester is required"
      });
    }

    if (!enrollmentNumber || !enrollmentNumber.trim()) {
      return res.status(400).json({
        message: "Enrollment number is required"
      });
    }

    // Validate enrollment number format
    if (enrollmentNumber.length < 3) {
      return res.status(400).json({
        message: "Enrollment number must be at least 3 characters"
      });
    }

    const user = await User.findByPk(userId, {
      transaction,
      lock: {
        level: transaction.LOCK.UPDATE,
        of: User,
      },
    });

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Check if enrollment number is already taken by another user
    const existingEnrollment = await UserProfile.findOne({
      where: { enrollmentNumber },
      transaction,
    });

    if (existingEnrollment && existingEnrollment.userId !== userId) {
      await transaction.rollback();
      return res.status(409).json({
        message: "This enrollment number is already registered. Please use a different one."
      });
    }

    // Update user full name
    if (fullName) {
      user.fullName = fullName.trim();
      await user.save({ transaction });
    }

    const profile = await UserProfile.findOne({
      where: { userId },
      transaction,
    });

    if (profile) {
      await profile.update(
        {
          course,
          department,
          year,
          semester,
          enrollmentNumber: enrollmentNumber.trim(),
        },
        { transaction }
      );
    } else {
      await UserProfile.create(
        {
          userId,
          enrollmentNumber: enrollmentNumber.trim(),
          course,
          department,
          year,
          semester,
        },
        { transaction }
      );
    }

    await transaction.commit();

    // Fetch updated profile
    const updatedUser = await User.findByPk(userId, {
      attributes: ["id", "fullName", "email", "emailVerified"],
      include: [
        {
          model: UserProfile,
          as: "profile",
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

    return res.status(200).json({
      message: "Profile updated successfully",
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        emailVerified: updatedUser.emailVerified,
        profile: updatedUser.profile,
        profileComplete: true,
      }
    });
  } catch (error) {
    if (transaction) await transaction.rollback();

    console.error("Update profile error:", error);

    return res.status(500).json({
      message: "Failed to update profile. Please try again later."
    });
  }
};