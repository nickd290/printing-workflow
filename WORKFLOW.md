# Printing Workflow - Comprehensive Application Guide

Last Updated: November 17, 2025

## Table of Contents
1. [Business Model Overview](#business-model-overview)
2. [Core Entities & Data Model](#core-entities--data-model)
3. [Money Flow & Routing](#money-flow--routing)
4. [Job Lifecycle](#job-lifecycle)
5. [Pricing Calculations](#pricing-calculations)
6. [Key Features](#key-features)
7. [API Routes Reference](#api-routes-reference)
8. [Common Operations](#common-operations)

---

## Business Model Overview

### The Three-Party System

**Impact Direct (Broker)** acts as a middleman between customers and print shops:

```
Customer → Impact Direct → Bradford Print Shop → JD Graphic
           (20% margin)     (25% margin)
```

### Company Roles

1. **Impact Direct**: The broker company that manages customer relationships
2. **Bradford**: Primary print shop partner (Bradford Graphic & Engraving Ltd)
3. **JD Graphic**: Paper supplier and backup print shop
4. **Customers**: End clients who place orders (JJSA, Ballantine, etc.)
5. **Third-Party Vendors**: Alternative print shops for specific jobs

---

## Core Entities & Data Model

### 1. Job
**Primary entity** - represents a print order from a customer

**Key Fields:**
- `jobNo` - Unique job number (e.g., J-2025-710561)
- `status` - Current stage in workflow
- `routingType` - BRADFORD_JD or THIRD_PARTY_VENDOR
- `customerTotal` - What customer pays Impact
- `bradfordTotal` - What Impact pays Bradford
- `jdTotal` - What Bradford pays JD
- `impactMargin` - Impact's profit (20% of customerTotal)
- `bradfordCut` - Bradford's portion when using third-party vendor
- `bradfordCutPaid` - Whether Bradford's cut has been paid

**Relationships:**
- Belongs to a Company (customer)
- Has many PurchaseOrders
- Has many Invoices
- Has many Proofs
- Has many Files
- May have a Vendor (if third-party)

### 2. PurchaseOrder
**Money flow tracking** - represents a payment obligation between companies

**Key Fields:**
- `poNumber` - PO number from originating company
- `originCompanyId` - Who is paying
- `targetCompanyId` - Who is receiving payment
- `totalAmount` - Amount of the PO
- `bradfordCutPaid` - Whether Bradford's cut paid (vendor routing only)

**Two PO Types:**
1. **Customer → Impact**: Customer's PO to Impact Direct
2. **Impact → Bradford/Vendor**: Impact's PO to print shop

### 3. Invoice
**Billing documents** - created when work is complete

**Flow:**
1. Bradford invoices Impact (for their services)
2. Impact invoices Customer (for the completed job)

**Key Fields:**
- `invoiceNumber` - Invoice number from issuing company
- `fromCompanyId` - Who is billing
- `toCompanyId` - Who is being billed
- `totalAmount` - Invoice total
- `status` - DRAFT, PENDING, PAID, OVERDUE

### 4. Proof
**Customer approval workflow** - PDFs that customers review and approve

**Key Fields:**
- `version` - Version number (increments with changes)
- `status` - PENDING_APPROVAL, APPROVED, REJECTED, EXPIRED
- `shareToken` - Unique token for shareable approval link
- `s3Key` - Location of PDF in storage

### 5. Company
**Organizations in the system**

**Types:**
- Customers (JJSA, Ballantine, etc.)
- Impact Direct (broker)
- Bradford (print shop)
- JD Graphic (supplier)
- Third-party vendors

### 6. Contact
**People at companies** - used for email notifications

**Key Fields:**
- `email` - Contact email
- `isPrimary` - Primary contact for the company
- `companyId` - Which company they belong to

### 7. Vendor
**Third-party print shops** - alternatives to Bradford→JD routing

**Used when:**
- Bradford doesn't have capacity
- Specialized printing requirements
- Better pricing available

---

## Money Flow & Routing

### Standard Routing: BRADFORD_JD

```
Customer pays Impact:     $1,000  (customerTotal)
  ↓ Impact keeps 20%:      $200   (impactMargin)

Impact pays Bradford:      $800   (bradfordTotal)
  ↓ Bradford keeps 25%:     $200   (bradfordPrintMargin + bradfordPaperMargin)

Bradford pays JD:          $600   (jdTotal)
```

**PurchaseOrders Created:**
1. Customer → Impact PO: $1,000
2. Impact → Bradford PO: $800
3. Bradford → JD PO: $600 (managed externally)

**Invoices Created:**
1. Bradford → Impact Invoice: $800
2. Impact → Customer Invoice: $1,000

### Vendor Routing: THIRD_PARTY_VENDOR

```
Customer pays Impact:      $1,000  (customerTotal)
  ↓ Impact keeps 20%:       $200   (impactMargin)
  ↓ Bradford gets cut:      $100   (bradfordCut)

Impact pays Vendor:         $700   (total - impact - bradford)
```

**Why Bradford gets a cut:**
- Bradford helped source the vendor
- Bradford manages vendor relationship
- Bradford may provide paper/materials

**Key Field:** `bradfordCutPaid` tracks if Bradford has been paid their cut

---

## Job Lifecycle

### Status Progression

```
PENDING
  ↓ (work starts)
IN_PRODUCTION
  ↓ (proof created)
READY_FOR_PROOF
  ↓ (customer approves)
PROOF_APPROVED
  ↓ (work completed & invoiced)
COMPLETED
```

### Detailed Workflow

#### 1. Job Creation (PENDING)
- Customer submits quote request or job details
- Impact creates job record with estimated pricing
- PO created: Customer → Impact
- Job status: PENDING

#### 2. Production Starts (IN_PRODUCTION)
- Bradford begins work
- PO created: Impact → Bradford (or Vendor)
- Files uploaded to job
- Job status: IN_PRODUCTION

#### 3. Proof Ready (READY_FOR_PROOF)
- Bradford creates proof PDF
- Proof uploaded with shareable link
- Email sent to customer contacts
- Job status: READY_FOR_PROOF

#### 4. Customer Approval (PROOF_APPROVED)
- Customer reviews proof via share link
- Customer clicks "Approve" or "Request Changes"
- If approved: Job status → PROOF_APPROVED
- If changes: New proof version created → READY_FOR_PROOF

#### 5. Completion (COMPLETED)
- Final product shipped
- Invoice created: Bradford → Impact
- Invoice created: Impact → Customer
- Job status: COMPLETED

---

## Pricing Calculations

### CPM (Cost Per Thousand)
Printing industry standard - price per 1,000 units

**Formula:** `CPM = (Total Cost / Quantity) × 1000`

**Example:**
- 5,000 brochures at $500 total
- CPM = ($500 / 5,000) × 1,000 = $100 CPM

### Price Components

#### 1. Customer Pricing (what customer pays)
```
customerCPM = customerTotal / quantity * 1000
```

#### 2. Bradford Pricing (what Impact pays Bradford)
```
bradfordTotal = customerTotal - impactMargin
bradfordTotalCPM = bradfordTotal / quantity * 1000

bradfordTotalCPM = printCPM + paperCostCPM

Where:
  printCPM = Bradford's printing cost per 1000
  paperCostCPM = Paper cost per 1000
```

#### 3. JD Pricing (what Bradford pays JD)
```
jdTotal = bradfordTotal - bradfordPrintMargin - bradfordPaperMargin
```

### Paper Handling

**Two scenarios:**

1. **JD Supplies Paper** (`jdSuppliesPaper = true`)
   - JD includes paper in their price
   - Bradford adds paper margin
   - Paper cost included in jdTotal

2. **Bradford Provides Paper** (`jdSuppliesPaper = false`)
   - Bradford sources paper separately
   - May waive paper margin (`bradfordWaivesPaperMargin = true`)
   - Paper cost handled outside the system

---

## Key Features

### 1. Job Management
**File:** `apps/api/src/routes/jobs.ts`

**Endpoints:**
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs` - Create new job
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Soft delete job
- `POST /api/jobs/:id/files` - Upload files

**Features:**
- Soft delete (sets `deletedAt` timestamp)
- File upload to S3/local storage
- Automatic PO creation
- Status tracking

### 2. Proof Approval Workflow
**File:** `apps/api/src/routes/customer.ts`

**Public Endpoints (no auth required):**
- `GET /api/customer/proof/:shareToken` - View proof
- `POST /api/customer/proof/:shareToken/approve` - Approve proof
- `POST /api/customer/proof/:shareToken/reject` - Request changes

**Features:**
- Shareable links with unique tokens
- Version tracking (v1, v2, v3...)
- Email notifications
- Expiration handling

### 3. Purchase Order Management
**File:** `apps/api/src/routes/purchase-orders.ts`

**Endpoints:**
- `GET /api/purchase-orders` - List all POs
- `GET /api/purchase-orders/:id` - Get PO details
- `POST /api/purchase-orders` - Create PO
- `PUT /api/purchase-orders/:id` - Update PO

**Features:**
- Origin/Target company tracking
- Bradford cut tracking for vendor routing
- Payment status tracking

### 4. Invoice Management
**File:** `apps/api/src/routes/invoices.ts`

**Endpoints:**
- `GET /api/invoices` - List all invoices
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/:id/status` - Update invoice status
- `GET /api/invoices/:id/pdf` - Generate invoice PDF

**Features:**
- Automatic invoice generation from jobs
- PDF generation
- Status tracking (DRAFT → PENDING → PAID)
- Overdue detection

### 5. Vendor Routing
**File:** `apps/api/src/routes/vendors.ts`

**Endpoints:**
- `GET /api/vendors` - List vendors
- `POST /api/vendors` - Create vendor
- `PUT /api/vendors/:id` - Update vendor

**Features:**
- Alternative to Bradford→JD routing
- Manual quote entry
- Bradford cut calculation
- Bradford cut payment tracking

### 6. Pricing Engine
**File:** `apps/api/src/routes/pricing-rules.ts`

**Features:**
- CPM-based calculations
- Customer/Bradford/JD pricing tiers
- Paper cost calculations
- Margin tracking

### 7. Reporting & Analytics
**File:** `apps/api/src/routes/reports.ts`

**Endpoints:**
- `GET /api/reports/revenue` - Revenue by time period
- `GET /api/reports/jobs-by-status` - Job status breakdown
- `GET /api/reports/customer-summary` - Customer metrics
- `GET /api/reports/outstanding-invoices` - Unpaid invoices

### 8. Admin Dashboard
**File:** `apps/api/src/routes/admin.ts`

**Features:**
- User management
- Company management
- System settings
- Database statistics

---

## API Routes Reference

### Authentication
**File:** `apps/api/src/routes/auth.ts`
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/register` - Create account
- `POST /api/auth/logout` - End session
- `GET /api/auth/me` - Get current user

### Companies & Contacts
**File:** `apps/api/src/routes/companies.ts`
- `GET /api/companies` - List companies
- `POST /api/companies` - Create company
- `PUT /api/companies/:id` - Update company
- `GET /api/companies/:id/contacts` - Get company contacts

### Files
**File:** `apps/api/src/routes/files.ts`
- `POST /api/files/upload` - Upload file to S3
- `GET /api/files/:id` - Get file metadata
- `DELETE /api/files/:id` - Delete file

### Exports
**File:** `apps/api/src/routes/exports.ts`
- `GET /api/exports/jobs` - Export jobs to CSV/Excel
- `GET /api/exports/invoices` - Export invoices
- `GET /api/exports/purchase-orders` - Export POs

---

## Common Operations

### Creating a New Job

```typescript
POST /api/jobs
{
  "companyId": "customer-company-id",
  "description": "5,000 Brochures - 8.5x11",
  "quantity": 5000,
  "routingType": "BRADFORD_JD",
  "customerTotal": 1000.00,
  "customerCPM": 200.00,
  "bradfordTotalCPM": 160.00,
  "printCPM": 120.00,
  "paperCostCPM": 40.00,
  "jdSuppliesPaper": true
}
```

**Automatic Calculations:**
- `bradfordTotal` = customerTotal × 0.8 (80%)
- `impactMargin` = customerTotal × 0.2 (20%)
- `jdTotal` = bradfordTotal × 0.75 (75%)
- `bradfordPrintMargin` = bradfordTotal × 0.15 (15%)
- `bradfordPaperMargin` = bradfordTotal × 0.10 (10%)

**Automatic PO Creation:**
- Customer → Impact PO with customerTotal

### Adding a Proof

```typescript
POST /api/jobs/:jobId/proofs
{
  "fileId": "uploaded-file-id",
  "version": 1
}
```

**Automatic Actions:**
- Generate unique `shareToken`
- Send email to customer primary contact
- Update job status to READY_FOR_PROOF

### Customer Approval

```typescript
POST /api/customer/proof/:shareToken/approve
{
  "approverName": "John Smith",
  "approverEmail": "john@customer.com"
}
```

**Automatic Actions:**
- Update proof status to APPROVED
- Update job status to PROOF_APPROVED
- Send confirmation email

### Vendor Routing

```typescript
POST /api/jobs
{
  "routingType": "THIRD_PARTY_VENDOR",
  "vendorId": "vendor-id",
  "customerTotal": 1000.00,
  "bradfordCut": 100.00  // Bradford's cut for facilitating
}
```

**Calculations:**
- Impact margin: $200 (20%)
- Bradford cut: $100 (negotiated)
- Vendor payment: $700 (remainder)

---

## Database Schema Notes

### Soft Deletes
Jobs, Companies, and other entities use soft deletes:
- `deletedAt` timestamp (NULL = active)
- `deletedBy` user ID who deleted it
- Queries filter out deleted records by default

### Indexes
Key indexes for performance:
- `Job.jobNo` (unique)
- `Job.companyId`
- `Job.status`
- `PurchaseOrder.originCompanyId`
- `PurchaseOrder.targetCompanyId`
- `Invoice.fromCompanyId`
- `Invoice.toCompanyId`
- `User.email` (unique)

### Timestamps
All entities have:
- `createdAt` - When created
- `updatedAt` - Last modified

---

## Environment Configuration

### Required Environment Variables

**Database:**
```
DATABASE_URL="postgresql://user@localhost:5432/printing_workflow"
```

**File Storage:**
```
UPLOAD_DIR="/app/uploads"  # Local storage
```

**Email (SendGrid):**
```
SENDGRID_API_KEY="SG.xxx"
EMAIL_FROM="notifications@impactdirect.com"
EMAIL_FROM_NAME="IDP Production"
```

**Authentication:**
```
NEXTAUTH_URL="http://localhost:5175"
NEXTAUTH_SECRET="xxx"
API_SECRET_KEY="xxx"
WEBHOOK_SECRET="xxx"
```

**API:**
```
API_URL="http://localhost:3001"
API_PORT="3001"
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

## Troubleshooting

### Common Issues

**1. Database Connection Errors**
- Check PostgreSQL is running: `brew services list`
- Start if needed: `brew services start postgresql@16`
- Verify DATABASE_URL in .env files

**2. Prisma Client Out of Sync**
- Run: `pnpm db:generate`
- If schema changed: `pnpm db:push` (dev only!)

**3. File Upload Errors**
- Check UPLOAD_DIR exists and is writable
- Verify S3 credentials if using S3

**4. Email Not Sending**
- Verify SENDGRID_API_KEY is valid
- Check EMAIL_FROM is verified sender in SendGrid
- Check EMAIL_REDIRECT_TO if testing (redirects all emails)

**5. Authentication Issues**
- Verify NEXTAUTH_SECRET matches between API and Web
- Check NEXTAUTH_URL matches your frontend URL
- Clear browser cookies and try again

### Development Tips

**1. Database GUI**
- Use Prisma Studio: `pnpm db:studio`
- Opens at http://localhost:5555
- Browse/edit all tables visually

**2. API Testing**
- Use `/health` endpoint to verify API is running
- Check logs in terminal for errors
- Use Postman/Insomnia for API testing

**3. Production Data Safety**
- Local database has real production data!
- Be careful with DELETE operations
- Always test destructive operations in a separate database first
- Database backup available at `packages/db/prisma/dev.db.backup-YYYYMMDD`

---

## Summary

This printing workflow application manages the entire lifecycle of print jobs from customer order to completion, with a three-party business model where Impact Direct acts as a broker between customers and print shops.

**Key Concepts to Remember:**
1. **Three-party system:** Customer → Impact → Bradford → JD
2. **Two routing types:** BRADFORD_JD (standard) or THIRD_PARTY_VENDOR
3. **Money flow:** POs track obligations, Invoices track billing
4. **Job lifecycle:** PENDING → IN_PRODUCTION → READY_FOR_PROOF → PROOF_APPROVED → COMPLETED
5. **Pricing:** CPM-based with automatic margin calculations

For questions or clarifications, refer to the source code in `/apps/api/src/routes/` for specific implementations.
