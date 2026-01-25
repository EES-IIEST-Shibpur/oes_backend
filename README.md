# Online Examination System (OES)

A secure, refresh-safe, backend-driven Online Examination System designed to handle real-world online assessments. The system emphasizes server-side control for timing, submissions, and evaluation to prevent cheating and ensure reliability.

---

## Features

### Authentication & Security

* User signup with email verification
* Login with JWT-based authentication
* Forgot password using email OTP
* Password reset via OTP
* Password change using current password

### User Profile

* Fetch authenticated user profile
* Update academic details (course, department, semester, etc.)

### Question Management (Admin)

* Create questions:

  * Single correct MCQ
  * Multiple correct MCQ
  * Numerical type
* Read, update, delete questions
* Domain and difficulty-based classification

### Exam Management (Admin)

* Create exam in draft state
* Add or update questions before publishing
* Publish exam (immutable after publish)
* View all exams
* View live and upcoming exams

### Exam Attempt (Student)

* Start exam attempt (single-time operation)
* Load or resume exam safely on refresh
* Save answers incrementally during exam
* Manual exam submission
* Backend-driven automatic submission on time expiry

### Results

* Secure result fetching after submission

---

## Core Design Principles

* **Backend-controlled timer**: No trust on frontend timers
* **Refresh-safe exam attempts**: Resume seamlessly after reload
* **Last-saved-answer evaluation**: No data loss
* **Clear separation of responsibilities**:

  * `/start` → attempt creation
  * `/attempt` → load/resume exam

---

## 🛠️ Tech Stack (Typical)

* **Backend**: Node.js, Express.js
* **Database**: PostgreSQL (via Sequelize ORM)
* **Authentication**: JWT
* **Email**: SMTP-based email service
* **Scheduling**: Server-side cron / interval jobs

---

## API Overview

### Authentication

* `POST /api/auth/signup`
* `GET /api/auth/verify-email/:token`
* `POST /api/auth/resend-verification`
* `POST /api/auth/login`
* `POST /api/auth/forgot-password`
* `POST /api/auth/reset-password`
* `POST /api/auth/change-password`

### Profile

* `GET /api/profile/me`
* `PUT /api/profile/me`

### Questions (Admin)

* `GET /api/question/all`
* `POST /api/question/create`
* `GET /api/question/:id`
* `PUT /api/question/:id`
* `DELETE /api/question/:id`

### Exams

* `POST /api/exam/create`
* `GET /api/exam/all`
* `GET /api/exam/:examId`
* `POST /api/exam/:examId/questions`
* `PUT /api/exam/:examId/update`
* `POST /api/exam/:examId/publish`
* `GET /api/exam/live`
* `GET /api/exam/upcoming`

### Exam Attempt

* `POST /api/exam-attempt/:examId/start`
* `GET /api/exam-attempt/:examId/attempt`
* `POST /api/exam-attempt/:examId/save`
* `POST /api/exam-attempt/:examId/submit`

### Results

* `GET /api/result`

---

## Exam Flow (Student)

1. User logs in
2. Views live exam
3. Calls `/start` once to create attempt
4. Calls `/attempt` to load questions
5. Saves answers continuously
6. Manual submit **or** backend auto-submit on time expiry
7. Fetch results

---

## ⏱️ Auto-Submit Logic

* Backend checks active exam attempts every **1 minute**
* If remaining time ≤ 0:

  * Attempt state changes to `SUBMITTED`
  * Last saved answers are evaluated
* Frontend has **no control** over submission timing

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL
- Redis (optional, can be disabled)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment files:
   ```bash
   # Copy example to create your development config
   cp .env.example .env.development
   ```

4. Update `.env.development` with your database and service credentials

5. Run database migrations (if applicable) or seed data:
   ```bash
   npm run seed
   ```

### Running the Application

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start

# Run tests
npm test
```

**Note:** `NODE_ENV` is automatically set by npm scripts. See [Environment Configuration](docs/ENVIRONMENT_CONFIG.md) for details.

### Configuration

The application uses environment-specific configuration files:
- `.env.development` - Local development
- `.env.test` - Testing environment
- `.env.production` - Production deployment

For detailed configuration options, see [Environment Configuration Guide](docs/ENVIRONMENT_CONFIG.md).

For modular architecture details, see [Modular Architecture Guide](docs/MODULAR_ARCHITECTURE.md).

---

## License

This project is for educational and evaluation purposes.

---

## Author

Aminul Islam,

Head Web Developer

Electrical Engineers' Society,

Dept of Electrical Engineering, IIEST Shibpur
