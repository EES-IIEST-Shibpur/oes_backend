# Database Seeding

## Overview
This seed script populates the database with sample data for testing and development purposes.

## What Gets Created

- **30 Students** with profiles (various departments, years, and courses)
- **1 Admin User**
- **5 Exams** (Data Structures, Algorithms, Database Systems, Operating Systems, Computer Networks)
- **10 Questions per exam** (mix of Single Correct, Multiple Correct, and Numerical questions)
- **Multiple Exam Attempts** with randomized scores for each exam

## Usage

### Run the Seed Script

```bash
npm run seed
```

**⚠️ WARNING:** This command will **DROP ALL EXISTING TABLES** and recreate them with fresh data. All existing data will be lost.

## Test Credentials

After seeding, you can login with:

**Admin Account:**
- Email: `admin@college.edu`
- Password: `password123`

**Student Accounts:**
- Email: `student1@college.edu` to `student30@college.edu`
- Password: `password123` (for all students)

## Sample Data Details

### Students
- Names: Various Indian names
- Enrollment Numbers: Format `{YEAR}CS{NUMBER}` (e.g., 2020CS0001)
- Departments: AEAM, CE, CST, EE, ETC, IT, ME, MIN, MME
- Years: ONE, TWO, THREE, FOUR
- Courses: BTECH, MTECH

### Exams
- All exams are set to past dates (completed)
- Duration: 60 minutes each
- Status: PUBLISHED
- 15-24 random students attempt each exam
- Scores range from 0-100

### Questions
- 6 Single Correct (4 options each)
- 2 Multiple Correct (4 options each)
- 2 Numerical questions
- Each question worth 10 marks

## Leaderboard Endpoint

After seeding, test the leaderboard endpoint:

```
GET /api/result/leaderboard
```

**Authorization Required:** Bearer token (any authenticated user)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "name": "Student Name",
      "department": "CST",
      "year": "THREE",
      "score": 98
    },
    ...
  ],
  "count": 5
}
```

## Development Workflow

1. Set up your `.env` file with database credentials
2. Run `npm run seed` to populate the database
3. Start the development server with `npm run dev`
4. Test the leaderboard endpoint with Postman or your frontend
5. Login with test credentials to explore the application

## Notes

- The seed script automatically syncs the database schema before seeding
- Student answers are randomly generated and may not match the actual scores
- Exam timestamps are set to past dates so results are immediately available
- All users have email verification enabled by default
