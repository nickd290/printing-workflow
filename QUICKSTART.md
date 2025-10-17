# Quick Start Guide

Get the printing workflow system running in under 5 minutes.

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Docker & Docker Compose

## Step 1: Install Dependencies

```bash
cd printing-workflow
pnpm install
```

This installs all dependencies for the monorepo.

## Step 2: Start Docker Services

```bash
pnpm docker:up
```

This starts:
- PostgreSQL (localhost:5432)
- Redis (localhost:6379)
- MinIO (localhost:9000, console: localhost:9001)

Wait ~10 seconds for services to be healthy.

## Step 3: Initialize Database

```bash
# Generate Prisma client
pnpm db:generate

# Create database tables
pnpm db:push

# Seed with demo data
pnpm db:seed
```

You should see:
```
✅ Companies created
✅ Users created
✅ Contacts created
🎉 Seeding complete!
```

## Step 4: Start Development Servers

**Terminal 1 - API Server:**
```bash
cd apps/api
pnpm dev
```

Wait for: `🚀 API server listening at http://localhost:3001`

**Terminal 2 - Workers:**
```bash
pnpm dev:workers
```

Wait for: `✅ Workers started`

**Terminal 3 - Web App (optional):**
```bash
cd apps/web
pnpm dev
```

Wait for: `ready - started server on 0.0.0.0:3000`

## Step 5: Test the API

Quick smoke test:

```bash
# Health check
curl http://localhost:3001/health

# Parse some specs
curl -X POST http://localhost:3001/api/quotes/parse-text \
  -H "Content-Type: application/json" \
  -d '{"text": "5000 business cards, 3.5x2, full color"}'
```

## What's Running?

- **API**: http://localhost:3001
- **Web**: http://localhost:3000
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **PostgreSQL**: localhost:5432 (postgres/postgres)
- **Redis**: localhost:6379

## Seed Data

The database is pre-populated with:

**Companies:**
- Impact Direct (broker)
- Bradford (broker)
- JD Graphic (manufacturer)
- Demo Customer Inc (customer)

**Users:**
- `customer@demo.com` (CUSTOMER)
- `admin@impactdirect.com` (BROKER_ADMIN)
- `admin@bradford.com` (BRADFORD_ADMIN)
- `manager@impactdirect.com` (MANAGER)

## Next Steps

### Test the Complete Workflow

Follow the [API Testing Guide](./API_TESTING_GUIDE.md) to test:
1. Create quote from text parsing
2. Approve quote → Create job
3. Upload proof → Approve
4. Schedule shipment
5. Generate invoice
6. Process Bradford webhook

### View Database

```bash
pnpm db:studio
```

Opens Prisma Studio at http://localhost:5555

### Run Tests

```bash
# All tests
pnpm test

# API tests only
cd apps/api && pnpm test

# Watch mode
cd apps/api && pnpm test:watch
```

### Reset Database

```bash
# Full reset (deletes all data)
pnpm db:reset

# Then re-seed
pnpm db:seed
```

## Common Commands

```bash
# Stop Docker services
pnpm docker:down

# Restart Docker with fresh volumes
pnpm docker:reset

# View database with Prisma Studio
pnpm db:studio

# Run migrations
pnpm db:migrate

# Build everything
pnpm build
```

## Troubleshooting

### "Port already in use"

```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill

# Or change port in .env
API_PORT=3002
```

### "Cannot connect to database"

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart Docker
pnpm docker:reset
```

### "Redis connection failed"

```bash
# Check if Redis is running
docker exec -it printing-workflow-redis redis-cli ping
# Should return: PONG
```

### Workers not processing jobs

Make sure Terminal 2 is running:
```bash
pnpm dev:workers
```

## Development Workflow

1. Make changes to API or services
2. API auto-reloads (tsx watch)
3. Workers auto-reload (tsx watch)
4. Test with curl or Postman
5. Check worker logs in Terminal 2
6. View data in Prisma Studio

## Project Structure

```
printing-workflow/
├── apps/
│   ├── api/          # Fastify API (port 3001)
│   └── web/          # Next.js web app (port 3000)
├── packages/
│   ├── db/           # Prisma + seed data
│   └── shared/       # Types + schemas
└── docker-compose.yml
```

## What's Implemented

✅ **All API Endpoints:**
- Quotes (parse, create, approve)
- Jobs (create, update status)
- Proofs (upload, approve, request changes)
- Files (upload to S3, signed URLs)
- Shipments (schedule, track)
- Invoices (generate PDF, email)
- Purchase Orders (auto-creation, webhooks)
- Webhooks (Bradford integration)

✅ **Background Workers:**
- Email sending (Resend)
- PDF generation (pdf-lib)
- Auto-PO creation (Impact → Bradford)

✅ **Business Logic:**
- Job number generation (J-YYYY-NNNNNN)
- Auto-PO: 80% to vendor, 20% margin
- Proof versioning
- File checksums (SHA-256)
- Email notifications

✅ **Testing:**
- Unit tests for services
- Test coverage for business logic

## Getting Help

- Read the full [README](./README.md)
- Check [API Testing Guide](./API_TESTING_GUIDE.md)
- View Prisma schema: `packages/db/prisma/schema.prisma`
- Inspect routes: `apps/api/src/routes/`
- Check services: `apps/api/src/services/`

## Ready to Go! 🚀

The system is now fully functional. Try the test workflow in the [API Testing Guide](./API_TESTING_GUIDE.md)!
