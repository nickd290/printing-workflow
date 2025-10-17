# API Testing Guide

Quick reference for testing the API endpoints manually.

## Setup

1. Start Docker services:
```bash
pnpm docker:up
```

2. Initialize database:
```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

3. Start API server (Terminal 1):
```bash
cd apps/api
pnpm dev
```

4. Start workers (Terminal 2):
```bash
pnpm dev:workers
```

## Test Flow: Complete Customer Journey

### 1. Parse Quote Specs (AI Stub)

```bash
curl -X POST http://localhost:3001/api/quotes/parse-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Need 5000 business cards, 3.5 x 2 inches, full color 4/4, 16pt cardstock"
  }'
```

### 2. Create Quote Request

```bash
curl -X POST http://localhost:3001/api/quotes/request \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "demo-customer",
    "specs": {
      "paper": "16pt cardstock",
      "size": "3.5x2",
      "quantity": 5000,
      "colors": "4/4",
      "finishing": "none"
    }
  }'
```

Save the returned `id` as `QUOTE_REQUEST_ID`.

### 3. Create Quote (Broker creates quote for customer)

```bash
curl -X POST http://localhost:3001/api/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "quoteRequestId": "QUOTE_REQUEST_ID",
    "lines": [
      {
        "description": "5000 Business Cards - 3.5x2, 4/4, 16pt",
        "quantity": 5000,
        "unitPrice": 0.02,
        "total": 100.00
      }
    ],
    "subtotal": 100.00,
    "tax": 0,
    "total": 100.00,
    "validUntil": "2025-12-31T23:59:59Z",
    "notes": "Standard turnaround: 5-7 business days"
  }'
```

Save the returned `id` as `QUOTE_ID`.

### 4. Approve Quote

```bash
curl -X POST http://localhost:3001/api/quotes/QUOTE_ID/approve \
  -H "Content-Type: application/json"
```

### 5. Create Job from Quote (Auto-PO triggers here!)

```bash
curl -X POST http://localhost:3001/api/jobs/from-quote/QUOTE_ID \
  -H "Content-Type: application/json"
```

This will:
- Create a job with job number `J-2025-000001`
- Queue auto-PO creation (Impact → Bradford)
- Return job details

Save the returned `id` as `JOB_ID` and `jobNo` as `JOB_NO`.

### 6. Upload File (Artwork)

```bash
curl -X POST http://localhost:3001/api/files/upload \
  -F "file=@/path/to/artwork.pdf" \
  -F "jobId=JOB_ID" \
  -F "kind=ARTWORK" \
  -F "uploadedBy=user@example.com"
```

Save the returned `id` as `FILE_ID`.

### 7. Upload Proof (Version 1)

```bash
curl -X POST http://localhost:3001/api/proofs/JOB_ID/upload \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "JOB_ID",
    "fileId": "FILE_ID"
  }'
```

This triggers email notification to customer.

Save the returned `id` as `PROOF_ID`.

### 8. Request Changes (Customer rejects proof)

```bash
curl -X POST http://localhost:3001/api/proofs/PROOF_ID/request-changes \
  -H "Content-Type: application/json" \
  -d '{
    "comments": "Please adjust the logo size",
    "approvedBy": "customer@demo.com"
  }'
```

Job status returns to `IN_PRODUCTION`.

### 9. Upload Proof v2 & Approve

Upload new proof file, then approve:

```bash
curl -X POST http://localhost:3001/api/proofs/PROOF_ID_V2/approve \
  -H "Content-Type: application/json" \
  -d '{
    "comments": "Looks great!",
    "approvedBy": "customer@demo.com"
  }'
```

Job status moves to `PROOF_APPROVED`.

### 10. Schedule Shipment

```bash
curl -X POST http://localhost:3001/api/shipments/JOB_ID/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "carrier": "UPS",
    "trackingNo": "1Z999AA10123456784",
    "weight": 5.5,
    "boxes": 2,
    "recipients": [
      {
        "name": "Demo Customer Inc",
        "address": "123 Main St",
        "city": "New York",
        "state": "NY",
        "zip": "10001",
        "phone": "555-0100"
      }
    ]
  }'
```

This triggers shipment notification email.

### 11. Generate Invoice

```bash
curl -X POST http://localhost:3001/api/invoices/JOB_ID/generate \
  -H "Content-Type: application/json" \
  -d '{
    "toCompanyId": "demo-customer",
    "fromCompanyId": "impact-direct"
  }'
```

This:
- Creates invoice record
- Queues PDF generation
- Worker generates PDF and uploads to S3
- Sends email with PDF attachment

Save the returned `id` as `INVOICE_ID`.

### 12. Test Bradford Webhook (Bradford → JD PO)

```bash
curl -X POST http://localhost:3001/api/webhooks/bradford-po \
  -H "Content-Type: application/json" \
  -d '{
    "componentId": "COMP-12345",
    "estimateNumber": "EST-67890",
    "amount": 60.00,
    "jobNo": "JOB_NO"
  }'
```

This creates a PO from Bradford → JD Graphic for $60.

## Verification Endpoints

### List Jobs

```bash
curl http://localhost:3001/api/jobs
```

### Get Job Details

```bash
curl http://localhost:3001/api/jobs/JOB_ID
```

Shows all related data: proofs, files, POs, invoices, shipments.

### List Purchase Orders

```bash
curl http://localhost:3001/api/purchase-orders
```

Should show:
1. Impact → Bradford PO ($100 → $80 vendor, $20 margin)
2. Bradford → JD PO ($60)

### List Invoices

```bash
curl http://localhost:3001/api/invoices
```

### View Webhook Events

```bash
curl http://localhost:3001/api/webhooks/events
```

## Money Flow Verification

For a $100 customer job, verify:

```bash
# Get all POs for the job
curl http://localhost:3001/api/purchase-orders?jobId=JOB_ID
```

You should see:
1. **Auto PO** (Impact → Bradford):
   - `originalAmount`: 100.00
   - `vendorAmount`: 80.00
   - `marginAmount`: 20.00

2. **Webhook PO** (Bradford → JD):
   - `originalAmount`: 60.00
   - `vendorAmount`: 60.00
   - `marginAmount`: 0.00

**Margins:**
- Impact Direct: $20
- Bradford: $20 (kept from the $80)
- JD Graphic: $60

## Running Tests

```bash
# Unit tests
cd apps/api
pnpm test

# Watch mode
pnpm test:watch
```

## Monitoring Workers

Workers log to console. Watch Terminal 2 for:
- Email queue processing
- PDF generation
- Auto-PO creation

## Troubleshooting

### Check Redis Connection

```bash
docker exec -it printing-workflow-redis redis-cli ping
# Should return: PONG
```

### Check PostgreSQL

```bash
docker exec -it printing-workflow-postgres psql -U postgres -d printing_workflow -c "SELECT COUNT(*) FROM \"Job\";"
```

### Check MinIO

Visit http://localhost:9001
- Login: minioadmin / minioadmin
- Check `printing-files` bucket for uploads

### View Queue Status

The workers will log queue job processing. Check Terminal 2 for:
- `Email job completed`
- `PDF job completed`
- `PO job completed`

## Advanced: Direct Database Queries

```bash
# Connect to database
docker exec -it printing-workflow-postgres psql -U postgres -d printing_workflow

# View all jobs
SELECT "jobNo", status, "customerTotal" FROM "Job";

# View all POs
SELECT "originCompanyId", "targetCompanyId", "vendorAmount", "marginAmount" FROM "PurchaseOrder";

# Exit
\q
```
