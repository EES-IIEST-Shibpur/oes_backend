# Troubleshooting Guide

## Redis Connection Issues

### Error: "Redis Client Error"
```
Problem: Redis server not running or unreachable
```

**Solution:**
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start it:
redis-server

# Or using Docker:
docker run -d -p 6379:6379 redis:latest

# Verify connection:
redis-cli
> PING
PONG
```

### Error: "REDIS_URL not set"
```
Problem: Missing environment variable configuration
```

**Solution:**
```bash
# Add to .env file:
REDIS_URL=redis://localhost:6379

# For production (cloud Redis):
REDIS_URL=redis://:password@host:port
```

### Error: "connect ECONNREFUSED 127.0.0.1:6379"
```
Problem: Redis port not accessible or firewall blocked
```

**Solution:**
```bash
# Check if port 6379 is open
netstat -an | grep 6379

# If using Docker, ensure port mapping:
docker run -d -p 6379:6379 redis:latest

# If behind firewall, open port 6379
```

---

## Email Queue Issues

### Emails Not Being Sent
```
Problem: BullMQ queue initialized but emails not processing
```

**Checklist:**
- [ ] Redis is running: `redis-cli ping`
- [ ] Email queue initialized: Check server logs for "Email queue initialized"
- [ ] SMTP configuration correct: Check `.env` SMTP_HOST, SMTP_USER, SMTP_PASS
- [ ] Using `sendEmailQueued()` not `sendEmail()`

**Debug Steps:**
```javascript
// Check queue status
const queue = getEmailQueue();
const counts = await queue.getJobCounts();
console.log(counts); // { active, completed, failed, waiting }

// Check failed jobs
const failed = await queue.getFailed();
failed.forEach(job => console.log(job.failedReason));

// Check active jobs
const active = await queue.getActive();
console.log('Active jobs:', active.length);
```

### Emails Queued But Not Processing
```
Problem: Jobs stuck in queue, not being processed
```

**Possible Causes:**
1. Worker crashed
2. Redis connection lost
3. Too many concurrent jobs

**Solution:**
```bash
# Restart server (restarts worker)
npm run dev

# Or manually clear stuck jobs:
redis-cli
> DEL bull:email:active
> DEL bull:email:waiting

# Restart server
npm run dev
```

### Email Job Keeps Retrying
```
Problem: Job retries multiple times, indicates SMTP failure
```

**Debug:**
```javascript
const job = await queue.getJob(jobId);
console.log({
  state: await job.getState(),
  attempts: job.attemptsMade,
  failedReason: job.failedReason,
  stacktrace: job.stacktrace
});
```

**Common SMTP Issues:**
- [ ] Wrong host/port
- [ ] Invalid credentials
- [ ] Firewall blocking SMTP port
- [ ] Email quota exceeded

---

## Caching Issues

### Cache Not Working (Always Hits DB)
```
Problem: Cache is not reducing database queries
```

**Checklist:**
- [ ] Redis running: `redis-cli ping`
- [ ] Using `getOrSetCache()` not `getCache()`
- [ ] Cache keys are consistent
- [ ] TTL is set appropriately

**Debug:**
```javascript
// Check if cache has data
redis-cli
> KEYS exam:*
> GET exam:123
> TTL exam:123  // -2 = key doesn't exist, -1 = no expiry

// Or programmatically:
const data = await getCache(CACHE_KEYS.EXAM(123));
console.log('Cached:', data);
```

### Cache Hit Rate is Low
```
Problem: Cache hit rate <40% (expected >60%)
```

**Causes:**
1. TTL too short - data expires before reuse
2. Keys not consistent - same data requested with different keys
3. Queries too varied - each query different
4. TTL needs tuning based on access patterns

**Solution:**
```javascript
// Increase TTL for static data
const data = await getOrSetCache(
    CACHE_KEYS.EXAM_QUESTIONS(examId),
    () => Question.findAll({ where: { examId } }),
    14400 // Increase from 7200 to 14400 seconds
);

// Monitor hit rate:
redis-cli
> INFO stats
// Check: keyspace_hits and keyspace_misses
// Hit rate = hits / (hits + misses)
```

### Redis Running Out of Memory
```
Problem: Redis error "OOM command not allowed when used memory > maxmemory"
```

**Solution:**
```bash
# Check memory usage
redis-cli
> INFO memory
> DBSIZE

# Clear cache if needed (careful!)
> FLUSHDB  # Clear current database
> FLUSHALL # Clear all databases

# Or programmatically:
const { clearAllCache } = require("./services/cache.service.js");
await clearAllCache();

# In production, increase Redis memory limit:
# - Cloud provider: Upgrade Redis plan
# - Self-hosted: Modify redis.conf, maxmemory setting
```

### Cache Key Collisions
```
Problem: Wrong data returned from cache
```

**Cause:** Inconsistent key generation

**Solution:**
```javascript
// Always use CACHE_KEYS helpers
const key = CACHE_KEYS.EXAM(examId);

// NOT: `exam-${examId}` or `exam_${examId}` 
// These create inconsistency!

// For custom keys, use a clear format:
const key = `prefix:type:id:subtype`;  // exam:123:questions
```

---

## Server Startup Issues

### "Cannot find module redis"
```
Problem: Package not installed
```

**Solution:**
```bash
npm install redis bullmq
npm install  # Install all dependencies
```

### "Port 8000 already in use"
```
Problem: Another process using port 8000
```

**Solution:**
```bash
# Find process using port
netstat -tlnp | grep 8000

# Kill process
kill -9 <PID>

# Or use different port:
PORT=3000 npm run dev
```

### "Connection timeout waiting for database"
```
Problem: Database not responding
```

**Solution:**
```bash
# Check database connection:
psql $PGDATABASE -U $PGUSER -h $PGHOST

# Verify .env variables:
# PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE

# Check network connectivity:
ping $PGHOST
```

---

## Performance Issues

### Slow API Responses Despite Cache
```
Problem: Still getting 100-500ms responses (expected <50ms)
```

**Debug:**
```javascript
// Add timing logs
const start = Date.now();
const data = await getOrSetCache(...);
const time = Date.now() - start;
console.log(`Cache lookup: ${time}ms`);

// Check if cache hit or miss
redis-cli MONITOR  // Watch all Redis commands
```

**Solutions:**
1. Add more data to cache
2. Increase TTL for stable data
3. Cache at multiple levels (DB → Cache)
4. Optimize database queries

### Queue Processing Too Slow
```
Problem: Emails taking >30s to process
```

**Solution:**
```javascript
// Increase concurrency (default: 5)
// In emailQueue.service.js:
emailWorker = new Worker("email", processor, {
    connection: redis,
    concurrency: 10, // Increase from 5 to 10
    // ... rest of config
});

// Monitor queue health:
const counts = await queue.getJobCounts();
console.log({
    active: counts.active,
    waiting: counts.waiting,
    completed: counts.completed,
    failed: counts.failed
});
```

---

## Testing & Debugging

### Manual Email Queue Test
```javascript
// In a test file
import { addEmailJob, getEmailQueue } from "./services/emailQueue.service.js";

// Test queueing
const job = await addEmailJob(
    "test@example.com",
    "Test Subject",
    "<p>Test content</p>"
);

console.log(`Job created: ${job.id}`);

// Wait for completion
await job.waitUntilFinished(eventEmitter);
console.log('Email sent!');
```

### Manual Cache Test
```javascript
import { setCache, getCache } from "./services/cache.service.js";

// Test setting
await setCache("test:key", { data: "value" }, 3600);

// Test getting
const data = await getCache("test:key");
console.log(data); // { data: "value" }

// Test deletion
await deleteCache("test:key");
const deletedData = await getCache("test:key");
console.log(deletedData); // null
```

### Monitor Redis in Real Time
```bash
# Connect to Redis CLI
redis-cli

# Monitor all commands
> MONITOR

# Check keys
> KEYS *
> KEYS exam:*
> KEYS bull:email:*

# Get key info
> GET key_name
> TTL key_name  # Time left before expiry
> DBSIZE        # Total keys in database
> INFO stats    # Statistics
```

---

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| ECONNREFUSED | Redis not running | `redis-server` |
| WRONGTYPE | Wrong data type | Delete and recreate key |
| OOM | Redis out of memory | Clear cache or upgrade Redis |
| TIMEOFDAY | Time sync issue | Sync server time |
| LOADING | Redis loading dump | Wait for startup |
| MOVING | Redis cluster issue | Check cluster config |

---

## Monitoring Commands

### Check System Health
```bash
# Redis status
redis-cli ping

# Queue counts
redis-cli EVAL "
  return {
    queue: redis.call('LLEN', 'bull:email:waiting'),
    active: redis.call('LLEN', 'bull:email:active'),
    failed: redis.call('LLEN', 'bull:email:failed')
  }
" 0

# Memory usage
redis-cli INFO memory

# Key count
redis-cli DBSIZE
```

### Check Database Health
```bash
# Database connection
psql $PGDATABASE -U $PGUSER -h $PGHOST -c "SELECT 1"

# Check tables
psql $PGDATABASE -U $PGUSER -h $PGHOST -c "\dt"
```

---

## Getting Help

### Check Logs
1. **Server logs**: Watch console output while running `npm run dev`
2. **Redis logs**: `redis-cli MONITOR` shows all commands
3. **System logs**: Check system error logs for port/permission issues

### Enable Debug Mode
```bash
# Set debug environment variable
DEBUG=* npm run dev

# Or selectively:
DEBUG=redis:* npm run dev
```

### Ask for Help With
- Full error message (include stack trace)
- Steps to reproduce
- Environment setup (OS, Node version, Redis version)
- What you've already tried

---

## Resources

- **Redis Documentation**: https://redis.io/
- **BullMQ Documentation**: https://docs.bullmq.io/
- **Node Redis Documentation**: https://github.com/redis/node-redis
- **Troubleshooting Guide**: [This file!]

---

**Last Updated**: 2026-01-11  
**Status**: Ready to reference  

Still having issues? Check server logs and Redis MONITOR output for clues! 🔍
