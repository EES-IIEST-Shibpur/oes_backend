import { ExamAttempt, User, UserProfile, Exam, ExamQuestion } from "../association/index.js";
import { Op } from "sequelize";

// Get top 5 scorers for the last exam that happened
export const getTopScorers = async (req, res) => {
    try {
        // Find the most recent exam that has ended
        const lastExam = await Exam.findOne({
            where: {
                endTime: { [Op.lt]: new Date() },
                state: 'PUBLISHED'
            },
            order: [['endTime', 'DESC']],
            attributes: ['id', 'title', 'startTime', 'endTime']
        });

        if (!lastExam) {
            return res.status(404).json({
                success: false,
                message: "No completed exams found"
            });
        }

        // Calculate total marks for the exam
        const totalMarks = await ExamQuestion.sum('marksForEachQuestion', {
            where: { examId: lastExam.id }
        });

        // Get total number of participants for this exam
        const totalParticipants = await ExamAttempt.count({
            where: {
                examId: lastExam.id,
                status: ['SUBMITTED', 'AUTO_SUBMITTED'],
                score: { [Op.not]: null }
            }
        });

        // Get top 5 scorers for this exam
        const topScorers = await ExamAttempt.findAll({
            where: {
                examId: lastExam.id,
                status: ['SUBMITTED', 'AUTO_SUBMITTED'],
                score: { [Op.not]: null }
            },
            include: [
                {
                    model: User,
                    attributes: ['fullName'],
                    include: [
                        {
                            model: UserProfile,
                            as: 'profile',
                            attributes: ['department', 'year']
                        }
                    ]
                }
            ],
            order: [['score', 'DESC']],
            limit: 5
        });

        const leaderboard = topScorers.map((attempt, index) => ({
            rank: index + 1,
            name: attempt.User.fullName,
            department: attempt.User.profile.department,
            year: attempt.User.profile.year,
            score: attempt.score
        }));

        res.status(200).json({
            success: true,
            exam: {
                id: lastExam.id,
                title: lastExam.title,
                examDate: lastExam.startTime,
                endTime: lastExam.endTime,
                totalMarks: totalMarks || 0
            },
            data: leaderboard,
            count: leaderboard.length,
            totalParticipants
        });
    } catch (error) {
        console.error("Error fetching top scorers:", error);
        res.status(500).json({
            success: false,
            message: "Server error: Unable to fetch leaderboard"
        });
    }
};