# Quick Start: Redis & BullMQ

## 1️⃣ Start Redis

### Option A: Local Redis (development)
```bash
# Using redis-cli
redis-server

# Or using Docker
docker run -d -p 6379:6379 --name redis redis:latest
```

### Option B: Cloud Redis (production)
Set `REDIS_URL` in `.env` to your cloud Redis URL

---

## 2️⃣ Configure Environment

Add to `.env`:
```env
REDIS_URL=redis://localhost:6379
```

---

## 3️⃣ Start Your Application

```bash
npm run dev
# or
npm start
```

You should see:
```
Redis initialized
Email queue initialized
Database connected & synced
Email transporter verified
Server running on port 8000
```

---

## 🚀 Quick Usage

### Cache Data
```javascript
import { getOrSetCache, CACHE_KEYS } from "../services/cache.service.js";

// Automatically caches exam questions
const questions = await getOrSetCache(
    CACHE_KEYS.EXAM_QUESTIONS(examId),
    () => Question.findAll({ where: { examId } })
);
```

### Queue Email
```javascript
import { sendEmailQueued } from "../services/email.service.js";

// Non-blocking email (automatically retries on failure)
await sendEmailQueued({
    to: "user@example.com",
    subject: "Verify Email",
    html: "<p>Click to verify</p>"
});
```

---

## 📊 Check Queue Status

```bash
# View Redis
redis-cli

# Check queue
> KEYS email:*
> LLEN bull:email:active
> LLEN bull:email:failed
```

---

## ⚠️ Common Issues

| Issue | Solution |
|-------|----------|
| "Redis not connected" | Start Redis server, verify `REDIS_URL` |
| Emails not sending | Check SMTP config, verify Redis is running |
| Cache not working | Ensure Redis is accessible |
| Jobs stuck | Check Redis memory, restart worker |

---

## 📚 Full Documentation

See [REDIS_BULLMQ_SETUP.md](REDIS_BULLMQ_SETUP.md) for complete guide.
