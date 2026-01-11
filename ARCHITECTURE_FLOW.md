# Architecture & Data Flow

## 🏗️ Overall Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client/API                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Express Server                              │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐     │
│  │  Controllers   │  │  Middleware  │  │   Routes        │     │
│  └────────┬───────┘  └──────────────┘  └─────────────────┘     │
└───────────┼──────────────────────────────────────────────────────┘
            │
            ├──────────────────┬──────────────────┬──────────────────┐
            │                  │                  │                  │
            ▼                  ▼                  ▼                  ▼
     ┌─────────────┐    ┌────────────┐    ┌──────────────┐   ┌──────────┐
     │   Database  │    │  Redis     │    │   Email      │   │ Cron     │
     │  (Postgres) │    │  Cache     │    │   Queue      │   │ Jobs     │
     │             │    │            │    │  (BullMQ)    │   │          │
     └─────────────┘    └────────────┘    └──────────────┘   └──────────┘
                             │                    │
                             │                    └─── SMTP Server
                             │
                        Stores:
                        - Cache data
                        - Job queue
                        - Job status
```

---

## 📊 Caching Data Flow

### 1️⃣ Cache Hit (Optimal Path)
```
API Request
    │
    ▼
Check Redis Cache ─────────────────┐
    │                              │
    │ (Hit)                    (Miss)
    ▼                              │
Return Data ─────────┐             │
                     │             ▼
                     │      Query Database
                     │             │
                     │             ▼
                     │      Store in Redis
                     │             │
                     │             ▼
                     └─────── Return Data
                               (cached for next request)

⏱️  Cache Hit: ~5-10ms  │  Cache Miss: ~50-200ms
```

### 2️⃣ Cache Invalidation
```
Data Update Request
    │
    ▼
Update Database
    │
    ▼
Delete Cache Keys
    │
    ├─ exam:{examId}:questions
    ├─ exam:{examId}
    └─ (other related keys)
    │
    ▼
Next request ─────────────────────┐
              Cache Miss           │
              (keys deleted)       │
                                   ▼
                            Fetch from DB
                                   │
                                   ▼
                            Cache new data
```

### 3️⃣ Cache-Aside Pattern (Recommended)
```
const data = getOrSetCache(key, fetchFn, ttl)
                    │
        ┌───────────┼───────────┐
        │                       │
    (cached)               (not cached)
        │                       │
        ▼                       ▼
    Return              Call fetchFn()
    cached                    │
    data                      ▼
                       Get data from DB
                              │
                              ▼
                       Store in cache
                              │
                              ▼
                           Return
```

---

## 📧 Email Queue Data Flow

### 1️⃣ Email Queueing
```
API Request
│ sendEmailQueued({ to, subject, html })
▼
BullMQ Job Created
│ Job stored in Redis
▼
Immediate Response to Client
│ { queued: true, jobId: "..." }
▼
Background Processing (Non-blocking)
```

### 2️⃣ Email Processing with Retries
```
Job Starts
    │
    ▼
Send Email via SMTP ──── Success ──┐
    │                              │
    │ ────── Failed ───┐          │
    │                  │          │
    ▼                  ▼          ▼
Retry? ─────────── Yes         Success
 │                   │          (logged)
 │                   │          │
 │              Exponential      │
 │              Backoff          │
 │              2s ──→ 4s ──→ 8s │
 │                   │          │
 │              Retry           │
 │              Job             │
 │                               │
 └─── No (Max attempts)          │
      │                          │
      ▼                          ▼
  Failed Log          Completed Log
  (kept for debug)    (removed after 1h)

Max Retries: 3  │  Backoff: Exponential 2s, 4s, 8s
```

### 3️⃣ Job Status Tracking
```
Job States:
    ▼
┌─────────────────────────────────┐
│ waiting ──→ active ──→ completed │
│           ↓                      │
│        delayed ──────────┘       │
│           ↓                      │
│        failed ───────────────────┘
└─────────────────────────────────┘

getEmailJobStatus(jobId) returns:
{
  id: "job-123",
  state: "active",
  progress: 50,
  attempts: 1,
  failedReason: null
}
```

---

## 🔄 Integration Points

### Caching in Controllers
```javascript
// Before (slow - hits DB every time)
const exam = await Exam.findByPk(examId);

// After (cached - hits Redis most of the time)
const exam = await getOrSetCache(
    CACHE_KEYS.EXAM(examId),
    () => Exam.findByPk(examId),
    7200
);
```

### Email in Controllers
```javascript
// Before (blocking - waits for SMTP)
await sendEmail({ to, subject, html });

// After (non-blocking - returns immediately)
await sendEmailQueued({ to, subject, html });
// Worker processes in background with automatic retries
```

---

## 📈 Performance Impact

### Cache Benefits
```
Without Caching:
  100 requests ──→ 100 DB queries ──→ 100-500ms per request

With Caching (60% hit rate):
  100 requests ──→ 40 DB queries  ──→ 10-50ms per request
  
Performance Gain: 10-50x faster for cached queries
```

### Email Queue Benefits
```
Without Queue (Blocking):
  API Response Time = Email Send Time (5-10s)
  If email fails: User sees error

With Queue (Non-blocking):
  API Response Time = Queue Time (~1-5ms)
  User gets response immediately
  Email retries automatically
  
User Experience: Instant response
Reliability: Automatic retries (3x)
```

---

## 🔗 Service Dependencies

```
server.js
├── config/redis.js
│   └── createClient() ──→ Redis Server
│
├── services/emailQueue.service.js
│   ├── new Queue("email", { connection })
│   ├── new Worker("email", processor, { connection })
│   └── services/email.service.js ──→ SMTP Server
│
└── config/db.js
    └── sequelize ──→ PostgreSQL

Controllers (to be updated)
├── services/cache.service.js
│   └── getRedisClient()
│
└── services/email.service.js
    ├── sendEmail() [direct]
    └── sendEmailQueued() [via BullMQ]
```

---

## 🎯 Typical Request Flows

### 1️⃣ Fetch Exam Questions
```
GET /api/exams/{examId}/questions
    │
    ▼
Exam Controller
    │
    ├─→ Check Redis Cache
    │   ├─ (Hit) ──────────────────────┐
    │   │                              │
    │   └─ (Miss) → Query DB → Cache   │
    │                      │           │
    └──────────────────────┴───────────┘
                           │
                           ▼
                     Return to Client
```

### 2️⃣ User Registration (with Email)
```
POST /api/auth/register
    │
    ▼
Auth Controller
    │
    ├─→ Create User (DB)
    │
    ├─→ Queue Verification Email (BullMQ)
    │   └─ Return immediately
    │
    ▼
Send Response to Client

[In Background]
    │
    ├─→ Worker picks up email job
    │
    ├─→ Send via SMTP
    │   ├─ Success → Complete
    │   └─ Failure → Retry (exponential backoff)
    │
    └─→ Log result
```

### 3️⃣ Update Exam Questions
```
PUT /api/exams/{examId}/questions/{questionId}
    │
    ▼
Question Controller
    │
    ├─→ Update in Database
    │
    ├─→ Invalidate Caches
    │   ├─ exam:{examId}:questions
    │   ├─ exam:{examId}
    │   └─ question:{questionId}
    │
    ▼
Send Response to Client

[Next Request]
    │
    └─→ Fresh data from DB
        └─→ Cache new data
```

---

## 📊 Redis Memory Usage

Typical memory estimates:

```
Exam with 50 questions:
  - Cached questions: ~50KB
  - Metadata: ~2KB
  - Total per exam: ~60KB

100 active exams:
  - Questions cache: ~6MB
  - Profiles cache: ~5MB
  - Results cache: ~3MB
  - Job queue data: ~2MB
  ─────────────────────
  Total: ~16MB (very manageable)

Email queue:
  1000 pending jobs: ~5MB
```

---

## ⚡ Performance Metrics

### Cache Performance
```
Redis Hit: 1-5ms
Redis Miss + DB: 50-200ms
No Cache + DB: 100-500ms

Improvement: 20-100x faster with caching
```

### Email Queue Performance
```
Direct SMTP: 5-15s (blocking)
BullMQ Queue: <5ms (non-blocking)
With retries: 0 additional client wait

Improvement: 1000x faster UX response
```

---

**Reference**: See code examples in [src/examples/cacheAndQueue.example.js](src/examples/cacheAndQueue.example.js)
