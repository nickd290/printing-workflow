# PO# Chain Tracking System - Implementation Summary

## Overview
Complete PO# tracking system from Customer → Impact Direct → Bradford → JD Graphic, with automatic extraction, validation, and visibility throughout the workflow.

---

## ✅ COMPLETED BACKEND IMPLEMENTATION (9/15 Tasks)

### 1. Database Schema (`packages/db/prisma/schema.prisma`)
**Changes:**
- Added `poNumber` to `PurchaseOrder` - The PO# for this specific purchase order
- Added `referencePONumber` to `PurchaseOrder` - Reference to parent/customer PO#
- Added `pdfFileId` to `PurchaseOrder` - Link to uploaded PO PDF
- Created `PurchaseOrder ↔ File` relation for PDF storage
- Added indexes for `poNumber` and `referencePONumber`

**Migration Status:** ✅ Completed - Database synced

### 2. PDF Extraction Service (`apps/api/src/services/pdf-extract.service.ts`)
**Features:**
- `extractPONumber()` - Extracts PO# from PDF using multiple patterns
- `extractAllPONumbers()` - Returns all potential matches for manual selection
- `validatePONumber()` - Validates PO# format
- `normalizePONumber()` - Normalizes to uppercase consistent format

**Supported Patterns:**
```
PO# ABC-12345
Purchase Order # ABC-12345
P.O. # ABC-12345
Order Number: ABC-12345
BRA-1234 (Bradford specific)
ABC-1234 (General format)
```

### 3. Enhanced Purchase Order Service (`apps/api/src/services/purchase-order.service.ts`)

**Updated Functions:**

#### `createPurchaseOrder()`
Now accepts:
- `poNumber` - This PO's number
- `referencePONumber` - Customer/parent PO# reference

#### `createAutoPurchaseOrder()`
- Generates Impact Direct PO#: `IMP-{customerPO}` or `IMP-{jobNo}`
- Sets `referencePONumber` to customer's PO#
- Passes customer PO# through the chain

#### `uploadBradfordPOPdf()` ⭐ NEW
Bradford uploads their PO PDF to create Bradford→JD purchase order:
1. Accepts: `jobId`, `pdfBuffer`, `fileName`, optional `manualPONumber`
2. Extracts Bradford's PO# from PDF automatically
3. Falls back to manual PO# if extraction fails
4. Creates Bradford→JD PO with extracted/manual PO#
5. Stores PDF in S3
6. References customer PO# throughout
7. Sends email to JD Graphic with PO PDF

**Example:**
```typescript
await uploadBradfordPOPdf(
  jobId: "job-123",
  pdfBuffer: Buffer,
  fileName: "bradford_po_12345.pdf",
  manualPONumber: "BRA-12345" // Optional override
);
```

### 4. Updated Job Service (`apps/api/src/services/job.service.ts`)

**Breaking Changes:**
- `createDirectJob()` - **Now requires** `customerPONumber` parameter
- `createJobFromQuote()` - **Now requires** `customerPONumber` parameter

Both functions:
- Validate customer PO# is provided
- Pass PO# to auto-PO creation queue
- Throw error if PO# is missing or empty

### 5. Queue System Update (`apps/api/src/lib/queue.ts`)

**Updated:**
- `CreateAutoPOJob` interface now includes `customerPONumber`
- `queueAutoPOCreation()` passes customer PO# to PO creation
- Only creates Impact→Bradford PO automatically
- Bradford→JD PO created via PDF upload workflow

### 6. API Routes - Jobs (`apps/api/src/routes/jobs.ts`)

**Updated Endpoints:**

#### `POST /api/jobs/from-quote/:quoteId`
```json
{
  "customerPONumber": "ABC-12345" // REQUIRED
}
```

#### `POST /api/jobs/direct`
```json
{
  "customerId": "...",
  "sizeId": "...",
  "quantity": 1000,
  "customerPONumber": "ABC-12345", // REQUIRED
  ...
}
```

#### `POST /api/jobs/from-pdf`
- Auto-extracts customer PO# from uploaded PDF
- Returns error if PO# cannot be extracted
- Suggests manual entry if extraction fails

### 7. API Routes - Purchase Orders (`apps/api/src/routes/purchase-orders.ts`)

**New Endpoint:**

#### `POST /api/purchase-orders/bradford-to-jd` ⭐
Bradford uploads their PO PDF to JD Graphic.

**Form Data:**
- `file` - PDF file (required)
- `jobId` - Job ID (required)
- `poNumber` - Manual PO# override (optional)

**Response:**
```json
{
  "success": true,
  "purchaseOrder": {...},
  "file": {...},
  "extractedPONumber": "BRA-12345",
  "poNumber": "BRA-12345",
  "message": "Successfully extracted PO# BRA-12345 from PDF"
}
```

**Actions:**
- Extracts PO# from PDF
- Creates Bradford→JD purchase order
- Stores PDF in S3
- Emails PDF to JD Graphic (production@jdgraphic.com, nick@jdgraphic.com)
- Creates notification records

### 8. Bradford PO PDF Generation (`apps/api/src/services/bradford-po.service.ts`)

**Enhancement:**
- Added customer PO# reference at top of PDF
- Displays: `Reference: Customer PO# ABC-12345`
- Helps JD Graphic trace back to original customer order

### 9. Updated PO Queue Workflow

**New Flow:**
```
Job Created with customerPONumber
    ↓
Auto-creates PO #1: Impact Direct → Bradford
    - PO#: IMP-{customerPO} or IMP-{jobNo}
    - Reference: {customerPO}
    - Amount: bradfordTotal
    ↓
(Manual) Bradford uploads their PO PDF
    ↓
Auto-creates PO #2: Bradford → JD Graphic
    - PO#: {extracted from PDF} or {manual} or BRA-{jobNo}
    - Reference: {customerPO}
    - Amount: jdTotal
    - PDF stored + emailed
```

---

## 📋 REMAINING FRONTEND TASKS (6/15)

### 1. Invoice PDF Generation
**File:** `apps/api/src/services/invoice.service.ts`
**Update:** Add customer PO# to invoice PDF header
**Format:** `Re: Your PO# {customerPONumber}`

### 2. Job List Page
**File:** `apps/web/src/app/jobs/page.tsx`
**Update:**
- Add "Customer PO#" column
- Make sortable and filterable
- Display prominently (2nd or 3rd column)

### 3. Job Detail Page
**File:** `apps/web/src/app/jobs/[id]/JobDetailPage.tsx`
**Update:** Add PO# chain visualization:
```
📋 Purchase Order Chain
Customer PO#: ABC-12345 (Master Reference)
Impact→Bradford PO#: IMP-ABC-12345
Bradford→JD PO#: BRA-67890 (if available)
```

### 4. Job Creation Forms
**Files:**
- `apps/web/src/components/forms/CreateJobForm.tsx` (or similar)
**Update:**
- Add required "Customer PO#" field
- Validate format
- Show clear error if missing

### 5. Purchase Orders Tab
**File:** `apps/web/src/components/job-tabs/PurchaseOrdersTab.tsx`
**Update:**
- Display PO#, Reference PO#, amounts in table
- Add "Upload Bradford PO PDF" button for Bradford admins
- Show auto-extracted PO# (editable before confirming)
- Display uploaded PDF with download link

### 6. Database Seed Data
**File:** `packages/db/prisma/seed.ts`
**Update:** Add sample customer PO numbers to existing jobs

---

## 🎯 IMPLEMENTATION GUIDE

### For Developers

#### Creating a Job (API)
```typescript
// Option 1: From quote
POST /api/jobs/from-quote/:quoteId
Body: { customerPONumber: "ABC-12345" }

// Option 2: Direct
POST /api/jobs/direct
Body: {
  customerId: "...",
  sizeId: "SM_7_25_16_375",
  quantity: 1000,
  customerPONumber: "ABC-12345", // REQUIRED
  ...
}

// Option 3: From PDF
POST /api/jobs/from-pdf
Form Data: { file: [PDF], customerId: "..." }
// Extracts PO# automatically
```

#### Bradford Uploads PO to JD
```typescript
POST /api/purchase-orders/bradford-to-jd
Form Data: {
  file: [Bradford PO PDF],
  jobId: "job-123",
  poNumber: "BRA-12345" // Optional manual override
}

// Response includes extracted PO#
```

#### Querying Jobs with PO#
```typescript
const job = await getJobById(jobId);
console.log(job.customerPONumber); // Customer's PO#

const pos = await listPurchaseOrders({ jobId });
pos.forEach(po => {
  console.log(po.poNumber);          // This PO's number
  console.log(po.referencePONumber); // Customer's PO#
});
```

---

## 🔄 COMPLETE WORKFLOW

```
1. CUSTOMER SUBMITS ORDER
   └─ PO#: ABC-12345

2. BROKER CREATES JOB
   POST /api/jobs/direct
   { customerPONumber: "ABC-12345", ... }

   ✅ Job created with customerPONumber
   ✅ Auto-creates Impact→Bradford PO (IMP-ABC-12345)

3. BRADFORD RECEIVES PO
   └─ Impact PO#: IMP-ABC-12345
   └─ Reference: ABC-12345

4. BRADFORD UPLOADS THEIR PO TO JD
   POST /api/purchase-orders/bradford-to-jd
   Form Data: { file: bradford_po.pdf, jobId: "..." }

   ✅ Extracts Bradford PO#: BRA-67890
   ✅ Creates Bradford→JD PO
   ✅ References customer PO#: ABC-12345
   ✅ Emails PDF to JD Graphic

5. JD GRAPHIC RECEIVES
   └─ Bradford PO#: BRA-67890
   └─ Customer Reference: ABC-12345
   └─ PDF attached in email
```

---

## 🧪 TESTING CHECKLIST

### Backend (✅ Ready to Test)
- [ ] Create job with customer PO# via `/api/jobs/direct`
- [ ] Verify Impact→Bradford PO created with `IMP-{customerPO}` format
- [ ] Upload Bradford PO PDF via `/api/purchase-orders/bradford-to-jd`
- [ ] Verify PO# extracted from PDF
- [ ] Check Bradford→JD PO created with extracted PO#
- [ ] Confirm email sent to JD Graphic
- [ ] Verify customer PO# reference maintained throughout chain

### Frontend (⏳ Pending)
- [ ] Customer PO# displayed in job list
- [ ] PO# chain visible on job detail page
- [ ] Job creation form requires customer PO#
- [ ] Bradford can upload PO PDF with preview
- [ ] Invoices show customer PO#

---

## 📝 API CHANGES SUMMARY

### Breaking Changes
⚠️ **Job creation now requires `customerPONumber`:**
- `createDirectJob()` - New required parameter
- `createJobFromQuote()` - New required parameter
- API routes validate PO# presence

### New Endpoints
✨ `POST /api/purchase-orders/bradford-to-jd` - Bradford uploads PO PDF to JD

### Database Changes
✅ **Migration completed** - No manual intervention needed
- PurchaseOrder: `poNumber`, `referencePONumber`, `pdfFileId`
- File: `purchaseOrders` relation

---

## 🎉 BENEFITS

1. **Complete Traceability** - Track PO#s from customer to final contractor
2. **Automatic Extraction** - No manual PO# entry from PDFs
3. **Audit Trail** - All PO#s stored and linked
4. **Email Automation** - JD Graphic receives PO PDF automatically
5. **Reference Chain** - Customer PO# visible at every level
6. **Flexible** - Supports manual override if extraction fails

---

**Status:** Backend 100% complete ✅ | Frontend 0% complete ⏳
**Next Step:** Implement frontend UI to display PO# chain
**Estimated Remaining Work:** 4-6 hours for all frontend tasks
