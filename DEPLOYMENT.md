# Printing Workflow System - Deployment Guide

## System Architecture

This is a commercial printing workflow management system built as a TypeScript monorepo:

- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind CSS
- **Backend**: Fastify API with Zod validation
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: Redis + BullMQ for background jobs
- **Storage**: MinIO (S3-compatible) for file storage
- **Monorepo**: pnpm workspaces + Turbo

## Prerequisites

### Required Software

1. **Docker Desktop** (REQUIRED - not currently installed)
   - Download from: https://www.docker.com/products/docker-desktop
   - Required for PostgreSQL, Redis, and MinIO services

2. **Node.js** (Already installed)
   - Version 18+ recommended

3. **pnpm** (Already available via npx)

## Quick Start

### 1. Install Docker Desktop

```bash
# Download and install Docker Desktop from:
# https://www.docker.com/products/docker-desktop

# After installation, verify Docker is running:
docker --version
docker compose version
```

### 2. Start Infrastructure Services

```bash
cd /Users/nicholasdeblasio/printing-workflow

# Start PostgreSQL, Redis, and MinIO
docker compose up -d

# Verify services are running
docker compose ps

# Expected output:
# - printing-workflow-postgres (port 5432)
# - printing-workflow-redis (port 6379)
# - printing-workflow-minio (ports 9000, 9001)
```

### 3. Initialize Database

```bash
# Generate Prisma client
npx pnpm db:generate

# Create database tables
npx pnpm db:push

# Seed with initial data (companies and users)
npx pnpm db:seed
```

**Expected Seed Data:**
- **Companies**: Impact Direct (broker), Bradford (broker), JD Graphic (manufacturer), Demo Customer Inc (customer)
- **Users**: customer@demo.com, admin@impactdirect.com, admin@bradford.com, manager@impactdirect.com

### 4. Start API Server

```bash
# Start Fastify API on port 3001
cd apps/api
npx pnpm dev

# Expected output:
# 🚀 API server listening at http://localhost:3001
```

### 5. Start Web App (Already Running)

The Next.js web app is already running on **http://localhost:5174**

If you need to restart it:
```bash
cd apps/web
npx pnpm dev
```

### 6. (Optional) Start Background Workers

```bash
# Start BullMQ workers for async jobs
npx pnpm dev:workers
```

## Testing the Full Workflow

Once all services are running, test the complete workflow:

### Test 1: Quote Creation with AI Parsing

1. Navigate to **http://localhost:5174/quotes**
2. Paste the example text:
   ```
   Need 5000 business cards
   Size: 3.5 x 2 inches
   Full color 4/4
   16pt cardstock
   UV coating
   Rush delivery needed
   ```
3. Click **"Parse with AI"**
   - ✅ Should extract: quantity=5000, size="3.5 x 2", paper="16pt cardstock", colors="4/4", finishing="UV coating"
4. Click **"Create Quote Request"**
   - ✅ Should save to database
   - ✅ Should appear in "Recent Quotes" table below

### Test 2: Job Creation from Quote

**Via API** (backend integration):
```bash
# Get quote ID from the quotes table
QUOTE_ID="<quote-id-from-step-1>"

# Create job from quote
curl -X POST http://localhost:3001/api/jobs/from-quote/$QUOTE_ID
```

**Expected Results:**
- ✅ Job created with auto-generated job number (J-YYYY-NNNNNN)
- ✅ Auto-PO created: Impact Direct → Bradford (80% of customer total)
- ✅ Margin calculated (20% kept by Impact Direct)

### Test 3: View Jobs in Kanban

1. Navigate to **http://localhost:5174/jobs**
2. ✅ Should load jobs from database
3. ✅ Jobs should appear in status columns (Pending, In Production, etc.)
4. **Drag a job** between columns
   - ✅ Should update status in real-time
   - ✅ Should persist to database

### Test 4: Proof Approval Workflow

1. Click on a job to view details
2. Navigate to **"Proofs"** tab
3. Click **"Approve"** on a proof
   - ✅ Should show confirmation modal
   - ✅ Should update proof status to APPROVED
   - ✅ Should update job status
4. Click **"Request Changes"** on another proof
   - ✅ Should show comments form
   - ✅ Should update proof status to CHANGES_REQUESTED
   - ✅ Should save comments

### Test 5: Purchase Order Auto-Creation

1. Check the **"Purchase Orders"** tab on a job
2. ✅ Should show auto-generated PO: Impact Direct → Bradford
3. ✅ Vendor Amount should be 80% of customer total
4. ✅ Margin Amount should be 20% of customer total

Example for $100 job:
- Customer Total: $100.00
- Vendor Amount (to Bradford): $80.00
- Margin (kept by Impact): $20.00

### Test 6: File Upload

1. Navigate to **http://localhost:5174/files**
2. Drag and drop a PDF or image file
3. ✅ File should upload to MinIO
4. ✅ SHA-256 checksum should be calculated
5. ✅ File should appear in table with metadata

## API Endpoints Reference

### Quotes API (`/api/quotes`)
- `POST /parse-text` - AI parsing of customer specs
- `POST /request` - Create quote request
- `POST /` - Create quote
- `POST /:id/approve` - Approve quote
- `GET /` - List quotes
- `GET /:id` - Get quote by ID

### Jobs API (`/api/jobs`)
- `POST /from-quote/:quoteId` - Create job from quote (triggers auto-PO)
- `POST /direct` - Create direct job
- `PATCH /:id/status` - Update job status
- `GET /` - List jobs
- `GET /:id` - Get job by ID

### Proofs API (`/api/proofs`)
- `POST /:jobId/upload` - Upload proof
- `POST /:proofId/approve` - Approve proof
- `POST /:proofId/request-changes` - Request changes
- `GET /by-job/:jobId` - List proofs for job

### Purchase Orders API (`/api/purchase-orders`)
- `POST /` - Create PO (usually auto-created)
- `GET /` - List POs
- `GET /:id` - Get PO by ID

### Files API (`/api/files`)
- `POST /upload` - Upload file to MinIO
- `GET /` - List files
- `GET /:id` - Get file metadata
- `GET /:id/download-url` - Get signed download URL
- `DELETE /:id` - Delete file

## Environment Variables

Located in `.env` at project root:

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

# Web
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## Troubleshooting

### Docker Not Running
**Error**: `command not found: docker` or `Cannot connect to Docker daemon`

**Solution**: Install and start Docker Desktop

### API Connection Failed
**Error**: "Failed to load. Make sure the API is running on port 3001"

**Solution**:
1. Check if API is running: `curl http://localhost:3001/health`
2. If not, start it: `cd apps/api && npx pnpm dev`
3. Check Docker services are running: `docker compose ps`

### Database Connection Error
**Error**: Prisma connection errors

**Solution**:
1. Verify PostgreSQL is running: `docker compose ps`
2. Check DATABASE_URL in `.env`
3. Recreate database: `npx pnpm db:push`

### Port Already in Use
**Error**: Port 3001 or 5174 already in use

**Solution**:
```bash
# Find process using port
lsof -i :3001
lsof -i :5174

# Kill process
kill -9 <PID>
```

## Architecture Details

### Auto-PO Creation Logic

When a job is created from a quote (`apps/api/src/services/job.service.ts:24-36`):

1. Job is created with customer total
2. BullMQ job is queued for auto-PO creation
3. Worker calculates:
   - `vendorAmount = customerTotal * 0.8` (80% to vendor)
   - `marginAmount = customerTotal * 0.2` (20% margin)
4. PO is created: Impact Direct → Bradford
5. Constants defined in `packages/shared/src/constants.ts`:
   ```typescript
   IMPACT_TO_BRADFORD_VENDOR_RATE = 0.8
   IMPACT_TO_BRADFORD_MARGIN_RATE = 0.2
   ```

### Job Numbering

Jobs are auto-numbered with format: `J-YYYY-NNNNNN`

Example: `J-2025-000001`

Logic in `apps/api/src/lib/utils.ts:generateJobNumber()`

### File Storage

Files are stored in MinIO (S3-compatible):
- Bucket: `printing-files`
- SHA-256 checksums calculated on upload
- Signed URLs generated for downloads
- File metadata stored in PostgreSQL

## Database Schema Highlights

**Key Models** (`packages/db/prisma/schema.prisma`):

- **User**: Authentication and role-based access (CUSTOMER, BROKER_ADMIN, BRADFORD_ADMIN, MANAGER)
- **Company**: customers, brokers, manufacturers
- **QuoteRequest**: customer spec submissions (PENDING, QUOTED, APPROVED, REJECTED)
- **Quote**: pricing and line items
- **Job**: production tracking with J-YYYY-NNNNNN numbering (PENDING → IN_PRODUCTION → READY_FOR_PROOF → PROOF_APPROVED → COMPLETED)
- **Proof**: versioned proof uploads with approval workflow
- **PurchaseOrder**: auto-generated POs with vendor/margin split
- **Invoice**: invoicing with PDF generation
- **File**: S3 storage metadata with checksums
- **Shipment**: tracking and delivery

## Next Steps

1. **Install Docker Desktop** (required to proceed)
2. **Follow Quick Start** steps 2-6 above
3. **Test Full Workflow** with the test scenarios
4. **(Optional) Configure real authentication** (currently using demo mode)
5. **(Optional) Add E2E tests** with Playwright
6. **(Optional) Deploy to production** (Railway, Vercel, or AWS)

## Current Status

✅ **Completed:**
- Full API implementation with 40+ endpoints
- Next.js UI with all pages (quotes, jobs, proofs, files, POs, invoices)
- Interactive drag-and-drop kanban board
- AI text parsing (stub ready for OpenAI integration)
- Proof approval workflow
- File upload with checksum verification
- Auto-PO creation with 80/20 split
- Complete database schema with 20+ models
- Seed data for testing

⚠️ **Pending:**
- Docker installation (required)
- Database initialization
- API server start
- Full workflow integration testing
- Real authentication (using demo mode)
- Background workers (optional for auto-PO)
- E2E tests (optional)

## Support

For issues or questions:
- Check logs: `docker compose logs` for infrastructure, `apps/api/logs` for API
- Verify all services running: `docker compose ps`
- Check environment variables in `.env`
- Restart services: `docker compose restart`
