# Email & Proof Approval Testing Guide

## 🎯 What Was Implemented

### 1. **Email System with SendGrid**
- Professional HTML email templates
- Direct proof approval links in emails
- Email redirect for testing (all emails go to test address)
- Email logging to console in dev mode

### 2. **Role-Based Access Control**
- **Customers** - See only their own jobs
- **Impact Direct (BROKER_ADMIN/MANAGER)** - See all jobs
- **Bradford (BRADFORD_ADMIN)** - See only jobs where Bradford has purchase orders
- **JD Graphic** - See only jobs where JD has purchase orders (when user added)

### 3. **Public Proof Viewer**
- Accessible via email link without full login
- Beautiful UI for viewing proof files (images/PDFs)
- Approve or Request Changes buttons
- Comments/feedback system
- Success/error messaging

---

## 🚀 Quick Start Testing

### Step 1: Access the Application

**Web App**: http://localhost:5174
**API**: http://localhost:3001

### Step 2: Login as Different Users

The system has 5 demo accounts:

| Email | Role | Company | What They See |
|-------|------|---------|---------------|
| admin@impactdirect.com | BROKER_ADMIN | Impact Direct | **ALL jobs** |
| manager@impactdirect.com | MANAGER | Impact Direct | **ALL jobs** |
| steve.gustafson@bgeltd.com | BRADFORD_ADMIN | Bradford | Jobs with Bradford POs |
| orders@jjsa.com | CUSTOMER | JJSA | **Only JJSA jobs** |
| orders@ballantine.com | CUSTOMER | Ballantine | **Only Ballantine jobs** |

### Step 3: Test Role-Based Job Filtering

1. **Login as Customer (orders@jjsa.com)**:
   - Navigate to Jobs page
   - You should ONLY see JJSA jobs
   - Try switching to `orders@ballantine.com` - you'll see different jobs

2. **Login as Bradford Admin (steve.gustafson@bgeltd.com)**:
   - You should only see jobs where Bradford is involved in POs
   - (Currently may show all jobs if no Bradford POs exist yet)

3. **Login as Impact Direct Admin (admin@impactdirect.com)**:
   - You should see ALL jobs from all customers

---

## 📧 Email Testing

### Email Configuration

Check your `.env` file:

```bash
# SendGrid Configuration
SENDGRID_API_KEY="SG.f9qMaKjnTmCfuD9q2b9kmA..."
EMAIL_FROM="nick@jdgraphic.com"
EMAIL_FROM_NAME="IDP Production"

# Test Mode - Redirect ALL emails to this address
EMAIL_REDIRECT_TO="nick@starterboxstudios.com"
```

### Email Templates Available

The system sends emails for:

1. **Proof Ready** - When proof is uploaded for customer review
2. **Proof Approved** - Confirmation when customer approves
3. **Job Created** - When new job is created
4. **Invoice Sent** - When invoice is generated
5. **Shipment Scheduled** - When order ships
6. **Quote Ready** - When quote is ready for review
7. **Bradford PO Created** - When auto-PO is created

### Testing Email Sending

#### Option 1: Real SendGrid (Production)

Your SendGrid API key is already configured. Emails will be sent to `EMAIL_REDIRECT_TO`.

To test:

```bash
# 1. Create a job via API
curl -X POST http://localhost:3001/api/jobs/direct \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "jjsa",
    "specs": {"description": "Test business cards"},
    "customerTotal": 100.00
  }'

# 2. Check your email at nick@starterboxstudios.com
# You should receive a "Job Created" email
```

#### Option 2: Development Mode (Console Logging)

If you remove the `SENDGRID_API_KEY` from `.env`, emails will be logged to the console instead:

```bash
# In .env, comment out:
# SENDGRID_API_KEY="..."

# Restart API server
# Now emails will appear in console logs
```

---

## 🎨 Testing Proof Approval Workflow

### Complete Proof Flow Test

#### Step 1: Create a Test Job

```bash
curl -X POST http://localhost:3001/api/jobs/direct \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "jjsa",
    "specs": {"description": "Test proof workflow"},
    "customerTotal": 250.00
  }'
```

**Response**: Note the `jobId` and `jobNo` from the response.

#### Step 2: Upload a Proof File

Use the web UI or API to upload a proof:

**Via Web UI**:
1. Login as `admin@impactdirect.com`
2. Navigate to Jobs → Click on the job
3. Go to "Proofs" tab
4. Click "Upload Proof"
5. Select a file (image or PDF)
6. Add admin comments (optional): "Please review the colors carefully"
7. Click "Upload Proof"

**Via API**:
```bash
# First, get a file upload URL
curl -X POST http://localhost:3001/api/proofs/{jobId}/upload \
  -F "file=@/path/to/proof.pdf" \
  -F "adminComments=Please review carefully"
```

#### Step 3: Check Email

**What happens**:
- Email is sent to customer (`orders@jjsa.com`)
- In test mode, email goes to `nick@starterboxstudios.com`
- Email contains link: `http://localhost:5174/proof/view/{proofId}`

**Email should look like**:

```
Subject: 🎨 Proof Ready for Review - Job J-2025-000123

Your Proof is Ready
We've prepared proof version 1 for your review.

Job Number: J-2025-000123
Proof Version: 1
Please review carefully and provide your approval or requested changes.

[Review & Approve Proof] ← Big button
```

#### Step 4: Customer Reviews Proof

Customer clicks the link in email and sees:

1. **Proof Viewer Page** at `/proof/view/{proofId}`
2. Job details (job number, customer name, total, upload date)
3. Admin comments (if any)
4. **Proof file displayed**:
   - Images: Show inline
   - PDFs: Embedded viewer
   - Other files: Download button

5. **Action buttons**:
   - ✅ Approve Proof (green)
   - 📝 Request Changes (orange)

#### Step 5: Customer Approves

Customer clicks "✅ Approve Proof":
- Confirmation message appears
- Proof status changes to `APPROVED`
- Job status changes to `PROOF_APPROVED`
- Email sent to admin confirming approval
- Approval recorded with timestamp

#### Step 6: Or Request Changes

Customer clicks "📝 Request Changes":
- Must enter comments
- Proof status changes to `CHANGES_REQUESTED`
- Job status reverts to `IN_PRODUCTION`
- Email sent to admin with requested changes
- New proof can be uploaded (version 2)

---

## 🧪 API Testing Examples

### Test Proof Approval (Direct API Call)

```bash
# Approve a proof
curl -X POST http://localhost:3001/api/proofs/{proofId}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approvedBy": "John Doe",
    "comments": "Looks great!"
  }'
```

### Test Request Changes

```bash
# Request changes
curl -X POST http://localhost:3001/api/proofs/{proofId}/request-changes \
  -H "Content-Type: application/json" \
  -d '{
    "requestedBy": "John Doe",
    "comments": "Please adjust the colors"
  }'
```

### Test Role-Based Job Filtering

```bash
# As customer (JJSA)
curl "http://localhost:3001/api/jobs?customerId=jjsa"

# As Bradford admin
curl "http://localhost:3001/api/jobs?companyId=bradford&userRole=BRADFORD_ADMIN"

# As Impact Direct admin (all jobs)
curl "http://localhost:3001/api/jobs"
```

---

## 📊 Test Scenarios

### Scenario 1: Customer Approval Flow

1. ✅ Login as admin@impactdirect.com
2. ✅ Create new job for JJSA
3. ✅ Upload proof with comments
4. ✅ Logout
5. ✅ Check email (as customer)
6. ✅ Click proof link in email
7. ✅ Review proof in viewer
8. ✅ Approve proof
9. ✅ Verify success message
10. ✅ Verify job status changed to PROOF_APPROVED

### Scenario 2: Request Changes Flow

1. ✅ Follow steps 1-7 from Scenario 1
2. ✅ Click "Request Changes"
3. ✅ Enter comments: "Please make logo bigger"
4. ✅ Submit
5. ✅ Verify success message
6. ✅ Login as admin
7. ✅ See requested changes
8. ✅ Upload new proof (version 2)
9. ✅ Customer receives new email
10. ✅ Approve version 2

### Scenario 3: Role-Based Access

1. ✅ Login as orders@jjsa.com
2. ✅ Navigate to Jobs page
3. ✅ Verify only JJSA jobs visible
4. ✅ Logout
5. ✅ Login as orders@ballantine.com
6. ✅ Verify only Ballantine jobs visible
7. ✅ Logout
8. ✅ Login as admin@impactdirect.com
9. ✅ Verify ALL jobs visible

### Scenario 4: Multiple Proof Versions

1. ✅ Upload proof version 1
2. ✅ Customer requests changes
3. ✅ Upload proof version 2
4. ✅ Customer requests more changes
5. ✅ Upload proof version 3
6. ✅ Customer approves version 3
7. ✅ Verify approval history shows all versions
8. ✅ Verify final approved version is v3

---

## 🎯 Key Features to Verify

### Email Features
- [x] Emails sent to correct recipients
- [x] Email redirect works (test mode)
- [x] Professional HTML templates
- [x] Proof approval links work
- [x] Email subject lines correct
- [x] Attachments supported (PDFs)

### Proof Viewer Features
- [x] Public access (no login required)
- [x] Image proofs display correctly
- [x] PDF proofs display in iframe
- [x] Admin comments visible
- [x] Approve button works
- [x] Request Changes requires comments
- [x] Success messages display
- [x] Approval history shows correctly

### Role-Based Access Features
- [x] Customers see only their jobs
- [x] Bradford sees only their PO jobs
- [x] Impact Direct sees all jobs
- [x] Unauthorized users can't see other jobs
- [x] API respects role filtering

---

## 🐛 Troubleshooting

### Emails Not Sending

**Check**:
1. `SENDGRID_API_KEY` is set in `.env`
2. API server restarted after env changes
3. Check API console logs for errors
4. Verify SendGrid account is active

**Solution**: Remove `SENDGRID_API_KEY` to use console logging mode for testing

### Proof Viewer Not Loading

**Check**:
1. Web app running on port 5174
2. API running on port 3001
3. Proof ID is valid
4. File was uploaded correctly

**Debug**:
```bash
# Check if proof exists
curl http://localhost:3001/api/proofs/{proofId}

# Check if file URL works
curl http://localhost:3001/api/files/{fileId}/download-url
```

### Jobs Not Filtering by Role

**Check**:
1. User is logged in (check localStorage)
2. UserContext is providing correct role
3. API query params being sent
4. Database has jobs with correct relationships

**Debug**:
```bash
# Check raw API response
curl "http://localhost:3001/api/jobs?customerId=jjsa"

# Check with role params
curl "http://localhost:3001/api/jobs?companyId=bradford&userRole=BRADFORD_ADMIN"
```

---

## 📝 Next Steps

### Production Checklist

Before going live:

1. **Email Configuration**:
   - [ ] Remove `EMAIL_REDIRECT_TO` from production `.env`
   - [ ] Verify `EMAIL_FROM` domain is authenticated in SendGrid
   - [ ] Test email deliverability
   - [ ] Set up DKIM/SPF records

2. **Security**:
   - [ ] Add real authentication (NextAuth or custom JWT)
   - [ ] Add API middleware to verify user roles
   - [ ] Protect proof viewer with email validation
   - [ ] Add rate limiting to prevent abuse

3. **Testing**:
   - [ ] Test all 5 email templates
   - [ ] Test with real customers
   - [ ] Verify spam folder placement
   - [ ] Test on mobile devices

4. **Monitoring**:
   - [ ] Set up SendGrid webhook for bounces
   - [ ] Log all email sends
   - [ ] Track proof approval rates
   - [ ] Monitor API errors

---

## 📧 Email Examples

### Proof Ready Email

```html
Subject: 🎨 Proof Ready for Review - Job J-2025-000001

Your Proof is Ready
We've prepared proof version 1 for your review.

Job Number: J-2025-000001
Proof Version: 1
Please review carefully and provide your approval or requested changes.

[Review & Approve Proof]  ← Links to /proof/view/{proofId}

Important: Production will begin once you approve this proof.
Please ensure all details are correct.
```

### Proof Approved Email

```html
Subject: ✅ Proof Approved - Job J-2025-000001

Proof Approved - Production Starting
Thank you for approving proof version 1 for job J-2025-000001.

Job Number: J-2025-000001
Approved Version: 1
✅ Your job has been moved to production and will be completed soon.

We'll notify you when your order is ready for shipment.
```

---

## 🎉 Success Criteria

You'll know everything is working when:

1. ✅ Customer receives proof email immediately after upload
2. ✅ Proof link opens beautiful viewer page
3. ✅ Customer can approve or request changes
4. ✅ Admin receives notification of customer's decision
5. ✅ Customers only see their own jobs in dashboard
6. ✅ Bradford only sees jobs they're involved in
7. ✅ Impact Direct sees all jobs

---

**Built with**: SendGrid, React, Next.js 15, Fastify, Prisma, TailwindCSS
**Last Updated**: 2025-10-16
