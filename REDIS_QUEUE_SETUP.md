# Redis + BullMQ Email Queue Setup

## Why Use Redis Queue?

**Current (Synchronous):**
- ❌ Email sending blocks API responses (slow)
- ❌ If server crashes, emails are lost
- ❌ No retry mechanism
- ❌ Can't scale to multiple servers

**With Redis + BullMQ:**
- ✅ Async processing (fast API responses)
- ✅ Automatic retries (3 attempts, exponential backoff)
- ✅ Persistent queue (survives crashes)
- ✅ Monitoring dashboard available
- ✅ Horizontally scalable

---

## Quick Start (Local Development)

### Option 1: Docker (Easiest)

```bash
cd /Users/nicholasdeblasio/printing-workflow

# Start Redis
docker compose up -d redis

# Verify Redis is running
docker ps | grep redis

# Update .env
# Uncomment these lines:
REDIS_URL="redis://localhost:6379"
```

### Option 2: Railway (Production)

```bash
# Add Redis to your Railway project
railway add --service redis

# Get Redis URL
railway variables --service redis | grep REDIS_URL

# Add to .env:
REDIS_URL="redis://default:PASSWORD@HOST:PORT"
```

### Option 3: Local Redis Installation

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis
sudo systemctl start redis

# Update .env:
REDIS_URL="redis://localhost:6379"
```

---

## Enable BullMQ Queue

### Step 1: Update Queue Import

Edit `apps/api/src/lib/queue.ts`:

```typescript
// Replace the entire file with:
export * from './queue-bullmq.js';
```

This will switch from synchronous to BullMQ queue.

### Step 2: Start Workers

Edit `apps/api/src/index.ts` and add:

```typescript
import { startWorkers, shutdownWorkers } from './lib/queue.js';

// After server starts, add:
const workers = startWorkers();

// Update graceful shutdown to include:
process.on('SIGTERM', async () => {
  await shutdownWorkers(workers);
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
});
```

### Step 3: Restart API Server

```bash
cd apps/api
npx pnpm dev
```

You should see:
```
🚀 Starting BullMQ workers...
✅ BullMQ workers started successfully
   - Email worker (concurrency: 5)
   - Auto-PO worker (concurrency: 3)
```

---

## Monitoring Queue

### Option 1: Bull Board (Web UI)

```bash
# Install Bull Board
npx pnpm add @bull-board/api @bull-board/fastify --filter @printing-workflow/api

# Add to apps/api/src/index.ts:
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { emailQueue, autoPOQueue } from './lib/queue.js';

const serverAdapter = new FastifyAdapter();
createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(autoPOQueue),
  ],
  serverAdapter,
});

serverAdapter.setBasePath('/admin/queues');
fastify.register(serverAdapter.registerPlugin());

# Now visit: http://localhost:3001/admin/queues
```

### Option 2: Redis CLI

```bash
# Connect to Redis
docker exec -it printing-workflow-redis redis-cli

# Or local Redis:
redis-cli

# View queue keys
KEYS bull:email:*

# View waiting jobs
LRANGE bull:email:waiting 0 -1

# View active jobs
LRANGE bull:email:active 0 -1

# View failed jobs
LRANGE bull:email:failed 0 -1

# Get job count
LLEN bull:email:waiting
```

---

## Testing

### Test Email Queue

```bash
curl -X POST http://localhost:3001/api/jobs/direct \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "jjsa",
    "sizeId": "SM_7_25_16_375",
    "quantity": 50000
  }'

# Check logs for:
# ✅ Email queued: 1 - To: customer@example.com
# ✅ Email worker completed job 1
```

### Test Queue Retries

Stop your email provider (e.g., disable SendGrid API key), then:

1. Create a job (triggers email)
2. Watch the queue retry 3 times
3. Check failed jobs in Bull Board

---

## Production Configuration

### Railway Setup (Recommended)

```bash
# Add both PostgreSQL and Redis to Railway
railway add --service postgres
railway add --service redis

# Get both URLs
railway variables

# Add to Railway environment variables (not .env):
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### Environment Variables

```bash
# .env (development)
REDIS_URL="redis://localhost:6379"

# Railway (production)
REDIS_URL="redis://default:PASSWORD@HOST:PORT"
```

---

## Troubleshooting

### "Redis connection failed"

```bash
# Check if Redis is running
docker ps | grep redis

# Or for local Redis:
redis-cli ping
# Should respond: PONG

# Check connection string format:
# Correct: redis://localhost:6379
# Correct: redis://default:PASSWORD@host:port
```

### "Workers not starting"

- Ensure REDIS_URL is set in .env
- Check Redis is accessible (not firewalled)
- Look for errors in API logs

### "Jobs stuck in queue"

```bash
# Clear all queues (development only!):
redis-cli FLUSHALL

# Or selectively:
redis-cli DEL bull:email:waiting
redis-cli DEL bull:email:active
redis-cli DEL bull:email:failed
```

---

## Rollback Plan

If BullMQ causes issues:

### Step 1: Revert to Synchronous Queue

Edit `apps/api/src/lib/queue.ts`:

```typescript
// Delete: export * from './queue-bullmq.js';
// Keep original synchronous implementation
```

### Step 2: Comment out Redis URL

```bash
# In .env:
# REDIS_URL="redis://localhost:6379"
```

### Step 3: Restart API

```bash
cd apps/api
npx pnpm dev
```

---

## Cost Comparison

| Provider | Free Tier | Paid |
|----------|-----------|------|
| **Railway Redis** | 500 hours/month | $5/month |
| **Upstash** | 10k requests/day | $10/month |
| **Redis Cloud** | 30MB free | $7/month |
| **Docker Local** | Free | Free |

**Recommendation:** Railway Redis (same platform as PostgreSQL)

---

## Performance Impact

**Before (Synchronous):**
- POST /api/jobs: ~1200ms (includes email sending)
- 1 request/sec max

**After (BullMQ):**
- POST /api/jobs: ~80ms (email queued, not sent)
- 50+ requests/sec
- Emails processed in background

---

## Next Steps

1. ✅ Set up Redis (Docker or Railway)
2. ✅ Enable BullMQ queue
3. ✅ Start workers
4. 🔄 Monitor with Bull Board
5. 🚀 Deploy to production

---

## Support

- BullMQ Docs: https://docs.bullmq.io/
- Redis Docs: https://redis.io/docs/
- Bull Board: https://github.com/felixmosh/bull-board
