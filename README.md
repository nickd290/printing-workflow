# Printing Workflow Management System

A complete commercial printing workflow system for managing quotes, jobs, proofs, purchase orders, invoices, and shipments. Built as a TypeScript monorepo with Next.js, Fastify, Prisma, and BullMQ.

## Quick Start

### Prerequisites

- **Node.js 18+** (installed ✅)
- **Docker Desktop** (required - install from https://www.docker.com/products/docker-desktop)
- **pnpm** (available via npx)

### One-Command Setup

```bash
# Install Docker Desktop first, then run:
npm run setup && npm run dev:all
```

This will:
1. Start PostgreSQL, Redis, and MinIO (via Docker)
2. Generate Prisma client
3. Create database tables
4. Seed initial data
5. Start API server, workers, and web app

### Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Web App** | http://localhost:5174 | Main UI |
| **API Server** | http://localhost:3001 | REST API |
| **MinIO Console** | http://localhost:9001 | File storage admin |
| **PostgreSQL** | localhost:5432 | Database |
| **Redis** | localhost:6379 | Queue |

### Default Credentials

**Test Users** (seeded automatically):
- **Customer**: customer@demo.com
- **Broker Admin**: admin@impactdirect.com
- **Bradford Admin**: admin@bradford.com
- **Manager**: manager@impactdirect.com

**MinIO Console**:
- Username: `minioadmin`
- Password: `minioadmin`

## Architecture Overview

### System Flow

```
┌──────────────┐
│   Customer   │ Pays $100
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Impact    │ Receives $100, Pays $80 (keeps $20 margin)
│    Direct    │
└──────┬───────┘
       │ Auto-PO #1 (80/20 split)
       ▼
┌──────────────┐
│   Bradford   │ Receives $80, Pays $60 (keeps $20 margin)
└──────┬───────┘
       │ Auto-PO #2 (webhook triggered)
       ▼
┌──────────────┐
│  JD Graphic  │ Receives $60 (manufactures job)
└──────────────┘
```

### Money Flow Example ($100 Job)

| Company | Receives | Pays | Margin |
|---------|----------|------|--------|
| **Customer** | - | $100 | - |
| **Impact Direct** | $100 | $80 | $20 (20%) |
| **Bradford** | $80 | $60 | $20 (25% of $80) |
| **JD Graphic** | $60 | - | - |

### PO Chain Explanation

**Auto-PO #1: Impact → Bradford**
- Automatically created when job is created from quote
- Amount: 80% of customer total ($100 × 0.8 = $80)
- Margin: 20% kept by Impact Direct ($100 × 0.2 = $20)
- Triggered by: `POST /api/jobs/from-quote/:quoteId`

**Auto-PO #2: Bradford → JD Graphic**
- Automatically created when Bradford webhook is received
- Linked by: `componentId` from Bradford's estimate
- Amount: 75% of Bradford's receipt ($80 × 0.75 = $60)
- Margin: 25% kept by Bradford ($80 × 0.25 = $20)
- Triggered by: `POST /api/webhooks/bradford-po`

## Development

### Repository Structure

```
printing-workflow/
├── apps/
│   ├── api/                    # Fastify REST API
│   │   ├── src/
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── services/       # Business logic
│   │   │   ├── workers/        # BullMQ background jobs
│   │   │   ├── lib/            # Utilities
│   │   │   └── index.ts        # Server entry
│   │   └── package.json
│   └── web/                    # Next.js 15 web app
│       ├── src/
│       │   ├── app/            # App Router pages
│       │   ├── components/     # React components
│       │   └── lib/            # API client
│       ├── e2e/                # Playwright tests
│       └── package.json
├── packages/
│   ├── db/                     # Prisma schema and migrations
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   └── seed.ts         # Seed data
│   │   └── package.json
│   └── shared/                 # Shared TypeScript code
│       ├── src/
│       │   ├── schemas.ts      # Zod validation schemas
│       │   └── constants.ts    # Business constants
│       └── package.json
├── docker-compose.yml          # PostgreSQL, Redis, MinIO
├── .env                        # Environment variables
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # pnpm workspace config
├── turbo.json                  # Turbo build config
├── DEPLOYMENT.md               # Deployment guide
└── README.md                   # This file
```

### Environment Variables

See `.env` file in project root. Key variables:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/printing_workflow?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# S3-compatible Storage (MinIO)
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET="printing-files"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"

# API
API_PORT="3001"
API_URL="http://localhost:3001"

# Web
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Email (optional - for production)
RESEND_API_KEY=""
EMAIL_FROM="noreply@yourdomain.com"

# OpenAI (optional - for AI text parsing)
OPENAI_API_KEY=""
```

### Database Commands

```bash
# Reset database (drop all tables and recreate)
npm run db:reset

# Generate Prisma client (after schema changes)
npx pnpm db:generate

# Push schema to database (create/update tables)
npx pnpm db:push

# Seed database with test data
npx pnpm db:seed

# Open Prisma Studio (visual database editor)
npx pnpm db:studio
```

### Email Preview in Dev Mode

In development, emails are logged to console instead of being sent. Check the API logs:

```bash
# API logs show email content
cd apps/api && npx pnpm dev

# Look for:
# [Email] To: customer@demo.com
# [Email] Subject: Proof Ready for Review
# [Email] Body: ...
```

For production, configure `RESEND_API_KEY` in `.env`.

### File Upload Testing Locally

Files are stored in MinIO (S3-compatible storage):

1. **Upload via UI**: Navigate to http://localhost:5174/files
2. **View files**: Open MinIO console at http://localhost:9001
3. **Login**: minioadmin / minioadmin
4. **Browse**: Click "printing-files" bucket to see uploaded files
5. **Download**: Click any file to download or get shareable link

## Common Tasks

### Reset Database

```bash
npm run db:reset
```

Drops all tables, recreates schema, and seeds initial data. Useful when:
- Database schema changes
- Data is corrupted
- Starting fresh for testing

### View Email Queue

```bash
# Install Redis Commander (optional)
npm install -g redis-commander

# Start Redis Commander
redis-commander

# Open http://localhost:8081 to view queues
```

Or use Redis CLI:
```bash
docker exec -it printing-workflow-redis redis-cli

# View all keys
KEYS *

# View email queue
LRANGE bull:email:waiting 0 -1
```

### Preview Uploaded Files

1. Open MinIO Console: http://localhost:9001
2. Login: minioadmin / minioadmin
3. Browse "printing-files" bucket
4. Click any file to preview or download

### Run Tests

```bash
# Unit tests (API and Web)
npm test

# E2E tests (Playwright)
npm run test:e2e

# Watch mode (unit tests)
npm run test:watch

# Coverage report
npm run test:coverage
```

## Business Logic

### Quote → Job → Proof → Ship → Invoice Workflow

```
Customer Submits Specs
  ↓
AI Parses Specs
  ↓
Broker Creates Quote
  ↓
Customer Approves? ──No──→ End
  ↓ Yes
Create Job (J-YYYY-NNNNNN)
  ↓
Auto-PO #1: Impact→Bradford (80/20)
  ↓
Bradford Sends Webhook
  ↓
Auto-PO #2: Bradford→JD (75/25)
  ↓
Broker Uploads Proof v1
  ↓
Customer Approves Proof? ──No──→ Customer Requests Changes
  ↓ Yes                               ↓
Schedule Shipment              Broker Uploads Proof v2
  ↓                                   ↓
Generate Invoice                      ↓
  ↓                             ←─────┘
Email Invoice to Customer
  ↓
Ship Job
  ↓
Job Completed
```

### Auto-PO Creation: When/Why/How Much

**When:**
- **PO #1**: Immediately when job is created from quote
- **PO #2**: When Bradford webhook is received with estimate details

**Why:**
- Automates vendor ordering
- Maintains profit margins
- Creates audit trail
- Links external estimates (via componentId)

**How Much:**
- **Impact → Bradford**: 80% of customer total (20% margin)
- **Bradford → JD**: 75% of Bradford's receipt (25% margin)

**Constants** (`packages/shared/src/constants.ts`):
```typescript
export const IMPACT_TO_BRADFORD_VENDOR_RATE = 0.8;
export const IMPACT_TO_BRADFORD_MARGIN_RATE = 0.2;
export const BRADFORD_TO_JD_VENDOR_RATE = 0.75;
export const BRADFORD_TO_JD_MARGIN_RATE = 0.25;
```

### Role Permissions Matrix

| Feature | CUSTOMER | BROKER_ADMIN | BRADFORD_ADMIN | MANAGER |
|---------|----------|--------------|----------------|---------|
| Submit Quote Request | ✅ | ✅ | ❌ | ✅ |
| Create Quote | ❌ | ✅ | ❌ | ✅ |
| Approve Quote | ✅ | ✅ | ❌ | ✅ |
| View Jobs | Own Only | All | Bradford Only | All |
| Upload Proof | ❌ | ✅ | ✅ | ✅ |
| Approve Proof | ✅ | ✅ | ❌ | ✅ |
| View POs | Own Jobs | All | Bradford Only | All |
| Generate Invoice | ❌ | ✅ | ❌ | ✅ |
| Schedule Shipment | ❌ | ✅ | ✅ | ✅ |

### Status Transitions Diagram

**Job Statuses:**
```
PENDING → IN_PRODUCTION → READY_FOR_PROOF → PROOF_APPROVED → COMPLETED
   ↓
CANCELLED (any time)
```

**Proof Statuses:**
```
PENDING → APPROVED
   ↓
CHANGES_REQUESTED → PENDING (new version)
```

**PO Statuses:**
```
PENDING → ACCEPTED → IN_PROGRESS → COMPLETED
   ↓
CANCELLED
```

**Invoice Statuses:**
```
DRAFT → SENT → PAID
   ↓
CANCELLED
```

## Troubleshooting

### Docker Not Running

**Symptoms:**
- Error: `Cannot connect to Docker daemon`
- Error: `command not found: docker`

**Solution:**
1. Install Docker Desktop: https://www.docker.com/products/docker-desktop
2. Start Docker Desktop application
3. Verify: `docker --version`
4. Run: `docker compose up -d`

### Port Conflicts

**Symptoms:**
- Error: `Port 5174 already in use`
- Error: `EADDRINUSE: address already in use`

**Solution:**
```bash
# Find process using port
lsof -i :5174
lsof -i :3001
lsof -i :5432

# Kill process
kill -9 <PID>

# Or change port in .env and package.json
```

### Database Connection Issues

**Symptoms:**
- Error: `Can't reach database server`
- Prisma connection timeout

**Solution:**
```bash
# Check if PostgreSQL is running
docker compose ps

# Restart PostgreSQL
docker compose restart postgres

# Check logs
docker compose logs postgres

# Reset database
npm run db:reset
```

### File Upload Failures

**Symptoms:**
- Error: `Failed to upload file`
- MinIO connection errors

**Solution:**
```bash
# Check if MinIO is running
docker compose ps

# Restart MinIO
docker compose restart minio

# Verify MinIO is accessible
curl http://localhost:9000/minio/health/live

# Check bucket exists
docker compose exec minio mc ls myminio/printing-files

# Recreate bucket if needed
docker compose up -d minio-setup
```

### API Not Responding

**Symptoms:**
- Frontend shows: "Make sure API is running on port 3001"
- 500 errors in browser console

**Solution:**
```bash
# Check if API is running
curl http://localhost:3001/health

# If not running, start it
cd apps/api && npx pnpm dev

# Check API logs for errors
# Look for database connection, Redis, or MinIO issues

# Verify environment variables
cat .env

# Restart all services
docker compose restart
cd apps/api && npx pnpm dev
```

### Workers Not Processing Jobs

**Symptoms:**
- Auto-PO not created after job creation
- Email notifications not sent

**Solution:**
```bash
# Start workers
npm run dev:workers

# Check worker logs
# Should see: "✅ Auto-PO worker started"

# Check Redis queue
docker exec -it printing-workflow-redis redis-cli
KEYS bull:*

# Clear stuck jobs (WARNING: clears all Redis data)
FLUSHALL
```

### Playwright Tests Failing

**Symptoms:**
- Tests timeout
- Cannot connect to http://localhost:5174

**Solution:**
```bash
# Ensure web app is running
cd apps/web && npx pnpm dev

# Ensure API is running
cd apps/api && npx pnpm dev

# Ensure database is seeded
npm run db:seed

# Run tests with headed browser (to see what's happening)
npx playwright test --headed

# Update Playwright browsers
npx playwright install
```

## Testing

### Unit Tests

Located in `apps/api/src/**/*.test.ts` and `apps/web/src/**/*.test.ts`

```bash
# Run all unit tests
npm test

# Run API tests only
npx pnpm --filter api test

# Run Web tests only
npx pnpm --filter web test

# Watch mode
npm run test:watch
```

### E2E Tests

Located in `apps/web/e2e/*.spec.ts`

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test quote-to-job

# Run with UI (headed browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug

# Generate report
npx playwright show-report
```

**Test Coverage:**
- `quote-to-job.spec.ts`: Quote creation → job creation → auto-PO verification
- `proof-workflow.spec.ts`: Proof upload → changes requested → v2 upload → approval
- `purchase-orders.spec.ts`: Auto-PO creation → webhook → second PO → money flow
- `shipment-invoice.spec.ts`: Shipment scheduling → invoice generation → PDF storage

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

**Recommended Platforms:**
- **Frontend**: Vercel or Railway
- **Backend API**: Railway or AWS ECS
- **Database**: Railway PostgreSQL or AWS RDS
- **Redis**: Railway Redis or AWS ElastiCache
- **Storage**: AWS S3 or DigitalOcean Spaces

## License

MIT License

---

**Built with:**
- [Next.js 15](https://nextjs.org/) - React framework
- [Fastify](https://www.fastify.io/) - Fast web framework
- [Prisma](https://www.prisma.io/) - Type-safe ORM
- [BullMQ](https://docs.bullmq.io/) - Job queue
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Playwright](https://playwright.dev/) - E2E testing
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Zod](https://zod.dev/) - Runtime validation
