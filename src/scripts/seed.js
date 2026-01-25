import { loadEnvironment } from "../config/env.js";

// Load environment first
loadEnvironment();

import bcrypt from "bcrypt";
import sequelize from "../config/db.js";
import { User, UserProfile, Exam, Question, Option, NumericalAnswer, ExamQuestion, ExamAttempt, StudentAnswer } from "../modules/association/index.js";

const departments = ["AEAM", "CE", "CST", "EE", "ETC", "IT", "ME", "MIN", "MME"];
const years = ["ONE", "TWO", "THREE", "FOUR"];
const courses = ["BTECH", "MTECH"];

// Sample names
const names = [
    "Rahul Sharma", "Priya Patel", "Amit Kumar", "Sneha Singh", "Vijay Verma",
    "Anjali Gupta", "Rohan Mehta", "Pooja Reddy", "Arjun Rao", "Divya Joshi",
    "Karan Kapoor", "Neha Desai", "Aditya Nair", "Kavya Iyer", "Siddharth Bose",
    "Riya Malhotra", "Varun Khanna", "Shreya Das", "Nikhil Pandey", "Ananya Roy",
    "Akash Sinha", "Meera Chopra", "Vishal Agarwal", "Tanvi Shah", "Harsh Mishra",
    "Sakshi Bansal", "Manish Yadav", "Ritika Saxena", "Gaurav Tiwari", "Ishita Jain"
];

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const generateEnrollmentNumber = (index) => {
    const year = 2020 + Math.floor(index / 10);
    const num = String(index).padStart(4, '0');
    return `${year}CS${num}`;
};

async function seed() {
    try {
        await sequelize.authenticate();
        console.log("Database connected");

        // Drop all tables and recreate
        await sequelize.sync({ force: true });
        console.log("Database synced (tables recreated)");

        // Create students
        const students = [];
        const hashedPassword = await hashPassword("password123");

        for (let i = 0; i < 30; i++) {
            const user = await User.create({
                fullName: names[i],
                email: `student${i + 1}@college.edu`,
                hashedPassword,
                role: "USER",
                emailVerified: true,
            });

            await UserProfile.create({
                userId: user.id,
                enrollmentNumber: generateEnrollmentNumber(i),
                course: courses[Math.floor(Math.random() * courses.length)],
                department: departments[Math.floor(Math.random() * departments.length)],
                year: years[Math.floor(Math.random() * years.length)],
                semester: `S${Math.floor(Math.random() * 8) + 1}`,
            });

            students.push(user);
        }
        console.log(`✓ Created ${students.length} students`);

        // Create admin
        const admin = await User.create({
            fullName: "Admin User",
            email: "admin@college.edu",
            hashedPassword,
            role: "ADMIN",
            emailVerified: true,
        });
        console.log("✓ Created admin user");

        // Create exams
        const exams = [];
        const examTitles = ["Data Structures", "Algorithms", "Database Systems", "Operating Systems", "Computer Networks"];

        for (let i = 0; i < 5; i++) {
            const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
            const endTime = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000); // 6 days ago

            const exam = await Exam.create({
                title: examTitles[i],
                description: `Exam on ${examTitles[i]}`,
                durationMinutes: 60,
                startTime,
                endTime,
                state: "PUBLISHED",
                createdBy: admin.id,
            });

            // Create 10 questions per exam
            for (let j = 0; j < 10; j++) {
                const questionType = j < 6 ? "SINGLE_CORRECT" : (j < 8 ? "MULTIPLE_CORRECT" : "NUMERICAL");

                const question = await Question.create({
                    statement: `Question ${j + 1} for ${examTitles[i]}?`,
                    questionType,
                    domain: examTitles[i],
                    createdBy: admin.id,
                });

                // Create exam-question link
                await ExamQuestion.create({
                    examId: exam.id,
                    questionId: question.id,
                    questionOrder: j + 1,
                    marksForEachQuestion: 10,
                });

                if (questionType === "SINGLE_CORRECT" || questionType === "MULTIPLE_CORRECT") {
                    // Create 4 options
                    const correctCount = questionType === "SINGLE_CORRECT" ? 1 : 2;
                    for (let k = 0; k < 4; k++) {
                        await Option.create({
                            questionId: question.id,
                            text: `Option ${String.fromCharCode(65 + k)}`,
                            isCorrect: k < correctCount,
                            order: k + 1,
                        });
                    }
                } else {
                    // Numerical question
                    await NumericalAnswer.create({
                        questionId: question.id,
                        value: 42 + j,
                        tolerance: 0.5,
                    });
                }
            }

            exams.push(exam);
        }
        console.log(`✓ Created ${exams.length} exams with questions`);

        // Create exam attempts with varying scores
        let attemptCount = 0;
        for (const exam of exams) {
            // Random subset of students attempt each exam
            const numAttempts = 15 + Math.floor(Math.random() * 10); // 15-24 students per exam
            const shuffledStudents = [...students].sort(() => Math.random() - 0.5);

            for (let i = 0; i < numAttempts; i++) {
                const student = shuffledStudents[i];
                const score = Math.floor(Math.random() * 101); // 0-100

                const attempt = await ExamAttempt.create({
                    examId: exam.id,
                    userId: student.id,
                    startedAt: new Date(exam.startTime.getTime() + Math.random() * 60 * 60 * 1000),
                    submittedAt: new Date(exam.startTime.getTime() + Math.random() * 60 * 60 * 1000 + 60 * 60 * 1000),
                    status: "SUBMITTED",
                    score,
                });

                attemptCount++;

                // Create some student answers
                const examQuestions = await ExamQuestion.findAll({
                    where: { examId: exam.id },
                    include: [{ model: Question, as: "question", include: [{ model: Option, as: "options" }] }],
                });

                for (const eq of examQuestions) {
                    // Randomly answer some questions
                    if (Math.random() > 0.2) { // 80% answer rate
                        const question = eq.question;

                        if (question.questionType === "NUMERICAL") {
                            await StudentAnswer.create({
                                examAttemptId: attempt.id,
                                questionId: question.id,
                                numericalAnswer: 40 + Math.floor(Math.random() * 10),
                            });
                        } else {
                            const options = question.options;
                            const selectedOptions = question.questionType === "SINGLE_CORRECT"
                                ? [options[Math.floor(Math.random() * options.length)].id]
                                : options.slice(0, 1 + Math.floor(Math.random() * 2)).map(o => o.id);

                            await StudentAnswer.create({
                                examAttemptId: attempt.id,
                                questionId: question.id,
                                selectedOptionIds: selectedOptions,
                            });
                        }
                    }
                }
            }
        }
        console.log(`✓ Created ${attemptCount} exam attempts with answers`);

        console.log("\n✅ Database seeded successfully!");
        console.log("\nTest credentials:");
        console.log("Admin: admin@college.edu / password123");
        console.log("Student: student1@college.edu / password123");
        console.log("(All users have password: password123)");

        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seed();
