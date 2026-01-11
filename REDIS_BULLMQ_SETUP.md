# Redis & BullMQ Implementation Guide

This document explains the Redis and BullMQ setup for the OES backend application.

## Overview

### Redis
- **Purpose**: Caching layer to reduce database queries and improve response times
- **Config**: [src/config/redis.js](src/config/redis.js)
- **Service**: [src/services/cache.service.js](src/services/cache.service.js)

### BullMQ
- **Purpose**: Asynchronous email queue with automatic retries and persistence
- **Config**: Integrated in [src/services/emailQueue.service.js](src/services/emailQueue.service.js)
- **Email Service**: [src/services/email.service.js](src/services/email.service.js)

---

## Installation & Setup

### Prerequisites
1. **Redis Server** must be running
   - Local: `redis-cli` on port 6379
   - Docker: `docker run -d -p 6379:6379 redis:latest`
   - Cloud: Use Redis provider (AWS ElastiCache, Heroku Redis, etc.)

2. **Environment Variables**
   Add to your `.env` file:
   ```env
   REDIS_URL=redis://localhost:6379
   # Or for production:
   # REDIS_URL=redis://:password@host:port
   ```

### Install Dependencies
```bash
npm install redis bullmq
```

Both packages are already installed via `npm install`.

---

## Features Implemented

### 1. Redis Caching Service

**Location**: [src/services/cache.service.js](src/services/cache.service.js)

#### Available Methods:

```javascript
// Get cached data
const data = await getCache(key);

// Set cached data (default TTL: 1 hour)
await setCache(key, value, ttl);

// Delete specific cache
await deleteCache(key);

// Delete multiple caches
await deleteCacheMultiple(keys);

// Get or Set (cache-aside pattern) - automatically fetches if cache miss
const data = await getOrSetCache(key, fetchFunction, ttl);

// Clear all cache
await clearAllCache();
```

#### Predefined Cache Keys:
```javascript
CACHE_KEYS.EXAM(examId)              // Exam details
CACHE_KEYS.EXAM_QUESTIONS(examId)    // Questions in exam
CACHE_KEYS.QUESTION(questionId)      // Single question
CACHE_KEYS.USER_PROFILE(userId)      // User profile
CACHE_KEYS.EXAM_RESULT(attemptId)    // Exam results
CACHE_KEYS.USER_EXAMS(userId)        // User's exams
CACHE_KEYS.ALL_EXAMS                 // All exams
```

#### Cache TTL Recommendations:
- **Static data** (exams, questions): 2-7 hours
- **User profiles**: 1 hour
- **Results/scores**: 2 hours
- **Lists**: 30 minutes - 1 hour

---

### 2. Email Queue Service (BullMQ)

**Location**: [src/services/emailQueue.service.js](src/services/emailQueue.service.js)

#### Features:
✅ Asynchronous email processing  
✅ Automatic retries (configurable, default: 3 attempts)  
✅ Exponential backoff on failures  
✅ Job persistence in Redis  
✅ Concurrent processing (default: 5 emails at once)  
✅ Job priority levels  
✅ Job status tracking  

#### Available Methods:

```javascript
// Initialize queue (done in server.js automatically)
const { emailQueue, emailWorker } = await initializeEmailQueue();

// Queue an email
const job = await addEmailJob(
    to,
    subject,
    html,
    {
        priority: 10,      // Higher = more important (default: 5)
        delay: 0,          // Delay in ms before processing
        attempts: 3,       // Number of retries
    }
);

// Get job status
const status = await getEmailJobStatus(jobId);
// Returns: { id, state, progress, attempts, failedReason }

// Close queue gracefully
await closeEmailQueue();
```

---

## Usage Examples

### Caching Example: Cache Exam Questions

```javascript
import { getOrSetCache, CACHE_KEYS } from "../services/cache.service.js";

export const getExamQuestions = async (examId) => {
    return getOrSetCache(
        CACHE_KEYS.EXAM_QUESTIONS(examId),
        async () => {
            // Fetched only on cache miss
            return await Question.findAll({
                where: { examId },
                include: ["options"],
            });
        },
        7200 // Cache for 2 hours
    );
};
```

### Email Queue Example: Send Verification Email

```javascript
import { sendEmailQueued } from "../services/email.service.js";

export const sendVerificationEmail = async (email, token) => {
    const html = `<a href="...verify?token=${token}">Verify Email</a>`;
    
    const result = await sendEmailQueued(
        {
            to: email,
            subject: "Verify Your Email",
            html,
        },
        {
            priority: 10, // High priority for verification
            attempts: 5,  // Retry up to 5 times
        }
    );
    
    return result; // { queued: true, jobId: "..." }
};
```

### Invalidate Cache on Update

```javascript
import { deleteCache } from "../services/cache.service.js";

export const updateExamQuestions = async (examId, questionId, data) => {
    // Update in database
    await Question.update(data, { where: { id: questionId } });
    
    // Invalidate caches
    await deleteCache(CACHE_KEYS.EXAM_QUESTIONS(examId));
    await deleteCache(CACHE_KEYS.EXAM(examId));
};
```

---

## Server Initialization

The following happens automatically in [src/server.js](src/server.js):

1. **Redis connects** - Initializes Redis client
2. **Email Queue starts** - Sets up BullMQ worker for email processing
3. **Database connects** - Sequelize synchronization
4. **Graceful shutdown** - Properly closes all connections on SIGINT/SIGTERM

---

## Monitoring & Debugging

### Check Email Queue Status

```javascript
const queue = getEmailQueue();
const counts = await queue.getJobCounts();
// Returns: { active, completed, failed, delayed, waiting, paused }
```

### View Failed Jobs
```javascript
const failedJobs = await queue.getFailed();
failedJobs.forEach(job => {
    console.log(`Job ${job.id}: ${job.failedReason}`);
});
```

### Logs
- Redis: Check console output for "Redis connected"
- Queue: Watch for "Email job [ID] completed" or "failed"
- Retries: Exponential backoff starts at 2 seconds

---

## Best Practices

### ✅ DO:
- Use `getOrSetCache` for frequently accessed data
- Set appropriate TTL based on data freshness requirements
- Invalidate related caches when data changes
- Use high priority for critical emails (verification, password reset)
- Monitor queue health and failed jobs

### ❌ DON'T:
- Cache user-sensitive data without encryption
- Set excessively long TTLs that cause stale data
- Forget to invalidate cache after updates
- Send emails directly without queueing (use `sendEmailQueued`)

---

## Troubleshooting

### Redis Connection Failed
- Verify Redis is running: `redis-cli ping` (should return "PONG")
- Check `REDIS_URL` in `.env`
- Ensure port 6379 is accessible

### Emails Not Sending
- Check Redis connection first
- Review failed jobs: `queue.getFailed()`
- Verify SMTP configuration in `.env`
- Check job retry attempts in logs

### Queue Stuck
- Check active jobs: `queue.getActive()`
- Verify worker is running (look for "worker initialized" log)
- Check if Redis has memory issues

---

## Configuration Reference

| Setting | Default | Purpose |
|---------|---------|---------|
| REDIS_URL | localhost:6379 | Redis connection string |
| Email Queue Concurrency | 5 | Max parallel emails |
| Email Retry Attempts | 3 | How many times to retry failed emails |
| Backoff Delay | 2000ms | Initial retry delay (exponential) |
| Cache TTL | 3600s | Default cache expiration |

---

## Architecture Diagram

```
API Request
    ↓
Check Cache (Redis)
    ↓ (Hit)
    └→ Return cached data
    ↓ (Miss)
    └→ Fetch from Database
        ↓
        Store in Cache
        ↓
        Return data

Email Request
    ↓
Queue Job (BullMQ in Redis)
    ↓
Return immediately to client
    ↓
Worker processes from queue
    ↓
Send email via SMTP
    ↓ (Success/Failure)
    └→ Log result, retry if needed
```

---

## Integration with Controllers

When using these services in your controllers, follow this pattern:

```javascript
// In your auth controller
import { sendEmailQueued } from "../services/email.service.js";
import { getOrSetCache, deleteCache } from "../services/cache.service.js";

export const registerUser = async (req, res) => {
    try {
        // Create user in database
        const user = await User.create(req.body);
        
        // Queue verification email (doesn't block)
        await sendEmailQueued({
            to: user.email,
            subject: "Verify Email",
            html: "Click here to verify...",
        });
        
        res.status(201).json({ message: "Check your email" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getExamDetails = async (req, res) => {
    try {
        const exam = await getOrSetCache(
            CACHE_KEYS.EXAM(req.params.examId),
            () => Exam.findByPk(req.params.examId)
        );
        res.json(exam);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
```

---

## Next Steps

1. **Implement caching in controllers** - Start with frequently accessed data
2. **Monitor performance** - Use Redis monitor to check cache hit rates
3. **Set appropriate TTLs** - Based on your data freshness requirements
4. **Test email queue** - Verify retries work as expected
5. **Configure backups** - For production Redis instances

For more examples, see [src/examples/cacheAndQueue.example.js](src/examples/cacheAndQueue.example.js)
