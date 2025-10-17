# Printing Workflow System - Current Status

**Last Updated:** 2025-10-15
**Status:** In Development - Core Infrastructure Complete

---

## 🎯 Project Overview

Building a commercial printing workflow system for **Impact Direct** (broker) that manages orders from two customers (JJSA and Ballantine), brokers to Bradford, who then brokers to JD Graphic (manufacturer).

### Business Flow
```
Customer (JJSA/Ballantine) → Places Order (no payment yet)
  ↓
Impact Direct → Auto-generates PO to Bradford (80/20 split)
  ↓
[STOPS - awaits Bradford email]
  ↓
Bradford emails PO (steve.gustafson@bgeltd.com) → Subject contains JJSG or BALSG
  ↓
System auto-generates PO: Bradford → JD Graphic
  OR
Admin manually uploads Bradford's PDF → triggers PO to JD
  ↓
Impact Direct invoices Customer → Auto-triggers Bradford invoice to Impact Direct
  ↓
JD invoices Bradford (manual - not automated)
```

---

## ✅ COMPLETED

### 1. **System Architecture**
- ✅ TypeScript monorepo with pnpm workspaces
- ✅ SQLite database (no Docker needed)
- ✅ Synchronous job processing (no Redis/BullMQ)
- ✅ Local filesystem (no MinIO)
- ✅ Next.js 15 frontend on port 5174
- ✅ Fastify API on port 3001

### 2. **Database & Seed Data**
- ✅ Prisma schema with 20+ models
- ✅ Real customers: JJSA (code: JJSG), Ballantine (code: BALSG)
- ✅ Companies: Impact Direct, Bradford, JD Graphic
- ✅ User accounts with proper roles

**User Accounts:**
```
admin@impactdirect.com - Impact Direct Admin (full access)
manager@impactdirect.com - Impact Direct Manager
steve.gustafson@bgeltd.com - Bradford Admin
orders@jjsa.com - JJSA Customer
orders@ballantine.com - Ballantine Customer
```

### 3. **Customer Code Mapping**
```typescript
// In packages/shared/src/constants.ts
CUSTOMER_CODES = {
  JJSA: 'JJSG',
  BALLANTINE: 'BALSG',
}

CUSTOMER_CODE_TO_ID = {
  'JJSG': 'jjsa',
  'BALSG': 'ballantine',
}
```

### 4. **Basic UI Pages**
- ✅ Login/Dashboard
- ✅ Jobs kanban board (drag-and-drop)
- ✅ Quotes page (needs updating for direct orders)
- ✅ Files page (file upload)
- ✅ Purchase Orders page
- ✅ Invoices page
- ✅ Proofs page

### 5. **Auto-PO Creation**
- ✅ Impact Direct → Bradford PO (80/20 split) auto-creates when job is created
- ✅ Runs synchronously (no background queue)

---

## 🚧 PENDING WORK

### Priority 1: Core Features (Required for MVP)

#### A. **Enable Direct Job Creation (No Quote Required)**
**Current:** System requires quote approval before creating job
**Needed:** Customers place orders directly → job is created immediately

**Files to Modify:**
- `apps/api/src/routes/jobs.ts` - Add direct job creation endpoint
- `apps/api/src/services/job.service.ts` - Create `createJobDirect()` function
- `apps/web/src/app/jobs/page.tsx` - Add "New Order" button
- `packages/shared/src/schemas.ts` - Add `createJobDirectSchema`

**API Endpoint Needed:**
```typescript
POST /api/jobs/direct
{
  customerId: 'jjsa' | 'ballantine',
  specs: { /* job specifications */ },
  customerTotal: 100.00
}
```

#### B. **Bradford Email Monitor**
**Trigger:** Email from `steve.gustafson@bgeltd.com` with subject containing `JJSG` or `BALSG`
**Action:** Parse PDF attachment → Create PO: Bradford → JD Graphic

**Files to Create:**
- `apps/api/src/services/email-monitor.service.ts` - Email checking logic
- `apps/api/src/services/pdf-parser.service.ts` - Extract PO data from PDF
- `apps/api/src/routes/email-webhooks.ts` - Endpoint for email service webhooks

**Options for Implementation:**
1. Use Gmail API (requires OAuth setup)
2. Use email forwarding webhook service (Zapier, Make.com)
3. Use Resend inbound email parsing

#### C. **Manual PDF Upload for Bradford POs**
**Purpose:** Fallback if email monitoring fails or for historical POs

**Files to Create:**
- `apps/web/src/app/purchase-orders/upload/page.tsx` - Upload UI
- `apps/api/src/routes/purchase-orders.ts` - Add upload endpoint
- Add PDF parsing library (pdf-parse or pdf.js)

**UI Flow:**
1. Admin navigates to Purchase Orders
2. Clicks "Upload Bradford PO"
3. Selects PDF file
4. System parses PDF and auto-fills form
5. Admin reviews and confirms
6. PO created: Bradford → JD Graphic

#### D. **Invoice Chain Automation**
**Trigger:** Impact Direct generates invoice to customer
**Action:** Auto-generate Bradford invoice to Impact Direct

**Files to Modify:**
- `apps/api/src/services/invoice.service.ts` - Add `triggerBradfordInvoice()`
- `apps/api/src/routes/invoices.ts` - Update invoice creation endpoint

**Logic:**
```
When Impact Direct invoices JJSA for $100:
1. Create invoice: Impact Direct → JJSA ($100)
2. Auto-create invoice: Bradford → Impact Direct ($80)
3. JD → Bradford invoice is manual (do NOT automate)
```

#### E. **Revenue Tracking Dashboard**
**Purpose:** Show all POs with paid/unpaid status

**Files to Create:**
- `apps/web/src/app/revenue/page.tsx` - Revenue dashboard UI
- `apps/api/src/services/revenue.service.ts` - Calculate revenue metrics

**Metrics to Show:**
- Total POs (by company)
- Paid vs Unpaid
- Revenue by customer (JJSA, Ballantine)
- Profit margins

---

### Priority 2: UI Polish & UX

#### A. **Update Quotes Page for Direct Orders**
- Remove quote approval requirement
- Rename to "Orders" or keep as-is
- Show both quote-based and direct orders

#### B. **Improve Job Detail Page**
- Show complete PO chain
- Display invoice status
- Add proof upload/approval buttons
- Show revenue for this job

#### C. **Add Loading States**
- Spinner for API calls
- Skeleton loaders for lists
- Disable buttons during submission

#### D. **Better Error Messages**
- User-friendly error text
- Action buttons (retry, contact support)
- Error logging

---

## 📁 Key File Locations

### Backend (API)
```
apps/api/src/
├── routes/         # API endpoints
│   ├── jobs.ts
│   ├── purchase-orders.ts
│   ├── invoices.ts
│   └── webhooks.ts
├── services/       # Business logic
│   ├── job.service.ts
│   ├── purchase-order.service.ts
│   └── invoice.service.ts
├── lib/           # Utilities
│   ├── queue.ts   # Synchronous job processing
│   ├── email.ts   # Email (logs to console)
│   └── utils.ts   # Helper functions
└── workers/       # (Disabled - using sync mode)
```

### Frontend (Web)
```
apps/web/src/
├── app/           # Next.js pages
│   ├── jobs/
│   ├── purchase-orders/
│   ├── invoices/
│   └── files/
└── lib/
    └── api-client.ts  # API wrapper
```

### Database
```
packages/db/
├── prisma/
│   └── schema.prisma  # Database schema (SQLite)
├── src/
│   ├── index.ts      # Prisma client
│   └── seed.ts       # Seed data
└── dev.db           # SQLite database file
```

### Shared
```
packages/shared/src/
├── constants.ts     # Customer codes, company IDs
├── schemas.ts       # Zod validation
└── types.ts         # TypeScript types
```

---

## 🚀 Running the System

### Start Everything
```bash
# Web app (http://localhost:5174)
cd apps/web && npx pnpm dev

# API server (http://localhost:3001)
cd apps/api && npx pnpm dev
```

### Reset Database
```bash
cd packages/db
rm -f dev.db
DATABASE_URL="file:./dev.db" npx prisma db push
DATABASE_URL="file:./dev.db" npx tsx src/seed.ts
```

### Test API
```bash
# Check health
curl http://localhost:3001/api/jobs

# Create direct job (when implemented)
curl -X POST http://localhost:3001/api/jobs/direct \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "jjsa",
    "specs": {"item": "Business cards"},
    "customerTotal": 100.00
  }'
```

---

## 🎯 Next Steps - Choose Your Path

### Option A: Complete Core Features (Recommended)
**Time Estimate:** 2-3 hours
**Priority:** High

1. Enable direct job creation (no quote)
2. Build Bradford email monitor OR manual PDF upload
3. Fix invoice chain automation
4. Add revenue tracking dashboard

**Result:** Fully functional system for production use

### Option B: Focus on One Feature
Pick the most critical:
- **Direct job creation** (fastest, 20 mins)
- **Manual PDF upload** (safe fallback, 30 mins)
- **Email monitoring** (complex, 1 hour)
- **Revenue dashboard** (nice-to-have, 45 mins)

### Option C: Test & Refine Current System
- Test existing job/PO creation
- Identify bugs in UI
- Fix styling issues
- Improve error handling

---

## 💡 Technical Decisions Made

1. **No Docker** - Using SQLite, no Redis, no MinIO
2. **Synchronous Jobs** - No background queue, runs inline
3. **Email Logging** - Emails printed to console (not sent)
4. **Port 5174** - Web app (user's explicit requirement)
5. **Real Customers** - JJSA and Ballantine (not demo data)
6. **Customer Codes** - JJSG (JJSA), BALSG (Ballantine) from Bradford emails

---

## 🐛 Known Issues

1. **File uploads** - May fail (local filesystem not fully implemented)
2. **Quote requirement** - Still requires quote before job (needs removal)
3. **Email monitoring** - Not implemented yet
4. **Invoice chain** - Manual only (no auto-trigger)
5. **Revenue tracking** - No dashboard yet

---

## 📞 Support

If you continue this conversation:
1. Reference this file: `CURRENT_STATUS.md`
2. Choose Option A, B, or C above
3. I'll pick up exactly where we left off

**Current State:** System is running, database seeded, ready for feature additions.
