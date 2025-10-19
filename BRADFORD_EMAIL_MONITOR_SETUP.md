# Bradford Email Monitor Setup Guide

## Overview

The Bradford Email Monitor automatically detects emails from `steve.gustafson@bgeltd.com` with customer codes (JJSG or BALSG) in the subject line, parses PDF attachments, and creates purchase orders from Bradford to JD Graphic.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  1. Bradford sends email to your configured address         │
│     From: steve.gustafson@bgeltd.com                        │
│     Subject: "JJSG - Project XYZ" or "BALSG - Order 123"    │
│     Attachment: PO.pdf                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. SendGrid Inbound Parse forwards email to webhook        │
│     POST /api/webhooks/inbound-email                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. System validates email:                                 │
│     ✓ From Bradford email address?                          │
│     ✓ Subject contains JJSG or BALSG?                       │
│     ✓ Has PDF attachment?                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Parse PDF to extract:                                   │
│     - Customer code (JJSG or BALSG)                         │
│     - Dollar amount                                          │
│     - PO number                                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Auto-create PO: Bradford → JD Graphic                   │
│     - Links to most recent job for that customer            │
│     - Logs as webhook event                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### Step 1: Configure SendGrid Inbound Parse

1. **Login to SendGrid Dashboard:**
   - Go to: https://app.sendgrid.com/
   - Navigate to: **Settings → Inbound Parse**

2. **Add Inbound Parse Webhook:**
   - Click "Add Host & URL"
   - **Receiving Domain:** Choose your domain (e.g., `yourdomain.com`)
   - **Subdomain:** `bradford-po` (creates: `bradford-po@yourdomain.com`)
   - **Destination URL:** `https://your-api-url.com/api/webhooks/inbound-email`
   - **Check:** "POST the raw, full MIME message"
   - Click "Save"

3. **Update DNS Records:**
   - Add MX record for inbound mail:
     ```
     Type: MX
     Host: bradford-po.yourdomain.com
     Value: mx.sendgrid.net
     Priority: 10
     ```

### Step 2: Configure Email Forwarding

**Option A: Forward Bradford emails to your inbox**
1. Ask Bradford (Steve Gustafson) to forward PO emails to: `bradford-po@yourdomain.com`
2. Subject line MUST contain customer code (JJSG or BALSG)

**Option B: Use email forwarding service**
1. Set up auto-forwarding rule in Bradford's email client
2. Forward emails from steve.gustafson@bgeltd.com to `bradford-po@yourdomain.com`
3. Ensure PDF attachments are preserved

### Step 3: Test the Integration

1. **Send Test Email:**
   ```bash
   # Send test email with customer code in subject
   # To: bradford-po@yourdomain.com
   # From: steve.gustafson@bgeltd.com (or test email)
   # Subject: Test JJSG Order
   # Attachment: sample-po.pdf (with dollar amount and customer code)
   ```

2. **Check API Logs:**
   ```bash
   # Watch API logs for incoming webhook
   cd apps/api && npx pnpm dev

   # Look for:
   # 📧 Received inbound email webhook
   # ✅ Bradford PO email detected!
   # 📎 Found PDF attachment: PO.pdf
   # 📄 Parsing Bradford PO PDF...
   # ✅ PDF parsed successfully
   # ✅ Bradford PO created from email
   ```

3. **Verify PO Creation:**
   ```bash
   # Check database for new PO
   curl http://localhost:3001/api/purchase-orders | grep Bradford

   # Or view webhook events
   curl http://localhost:3001/api/webhooks/events?source=EMAIL
   ```

---

## API Endpoints

### Inbound Email Webhook
```
POST /api/webhooks/inbound-email
Content-Type: multipart/form-data

Fields:
- from: steve.gustafson@bgeltd.com
- subject: "JJSG - Order 12345"
- text: Email body text
- attachment1: PO.pdf (binary)
```

**Response:**
```json
{
  "success": true,
  "message": "Email processed successfully",
  "result": {
    "action": "created",
    "message": "PO created successfully from email",
    "purchaseOrder": {...},
    "parsed": {
      "customerCode": "JJSG",
      "customerId": "jjsa",
      "amount": 1234.56,
      "poNumber": "12345"
    }
  }
}
```

### List Webhook Events
```
GET /api/webhooks/events?source=EMAIL&processed=true
```

---

## Email Requirements

For emails to be processed successfully:

1. **Sender Email:** Must contain `steve.gustafson@bgeltd.com`
2. **Subject Line:** Must contain `JJSG` or `BALSG` (case-insensitive)
3. **Attachment:** Must include at least one PDF file
4. **PDF Content:** PDF must contain:
   - Customer code (JJSG or BALSG)
   - Dollar amount (e.g., $1,234.56 or 1234.56)
   - Optional: PO number

---

## PDF Parsing

The system automatically extracts:

| Field | Pattern | Example |
|-------|---------|---------|
| Customer Code | JJSG or BALSG | "JJSG" |
| Dollar Amount | $X,XXX.XX or XXX.XX | "$1,234.56" |
| PO Number | PO #XXXX, Order #XXXX | "PO #12345" |

**Note:** If parsing fails, the email is logged but no PO is created. Check logs for details.

---

## Troubleshooting

### Emails Not Being Received

**Check:**
1. **MX Record:** Verify DNS MX record is correct
   ```bash
   dig MX bradford-po.yourdomain.com
   ```

2. **SendGrid Inbound Parse:** Check SendGrid dashboard for webhook status
   - Go to: https://app.sendgrid.com/settings/parse
   - Verify webhook URL is correct
   - Check for error messages

3. **Email Forwarding:** Ensure Bradford is forwarding to correct address

### Emails Received But Not Processed

**Check API Logs:**
```bash
cd apps/api && npx pnpm dev
```

**Common Issues:**

| Issue | Cause | Solution |
|-------|-------|----------|
| "Email not from Bradford" | Sender email doesn't match | Verify email contains steve.gustafson@bgeltd.com |
| "No customer code in subject" | Subject missing JJSG/BALSG | Add customer code to subject line |
| "No PDF attachments found" | No PDF or wrong MIME type | Ensure PDF is attached and not corrupted |
| "Could not identify customer code" | PDF parsing failed | Check PDF contains readable text (not scanned image) |
| "Could not find valid dollar amount" | No amount in PDF | Verify PDF has dollar amount formatted correctly |

### View Webhook Logs

```bash
# List all email webhook events
curl http://localhost:3001/api/webhooks/events?source=EMAIL | python3 -m json.tool

# Check if event was processed
curl http://localhost:3001/api/webhooks/events?source=EMAIL&processed=true
```

### Manual Testing

If email integration isn't ready, you can manually trigger the webhook:

```bash
curl -X POST http://localhost:3001/api/webhooks/bradford-po \
  -H "Content-Type: application/json" \
  -d '{
    "componentId": "JJSG",
    "estimateNumber": "12345",
    "amount": 1234.56,
    "jobNo": "J-2025-000001"
  }'
```

---

## Production Deployment

Before deploying to production:

- [ ] **Configure SendGrid MX records** on your domain
- [ ] **Test email forwarding** from Bradford
- [ ] **Verify PDF parsing** with sample Bradford POs
- [ ] **Set up monitoring** for failed webhook events
- [ ] **Configure alerts** for email processing errors
- [ ] **Document process** for Bradford to follow when sending POs

---

## Alternative: Manual PDF Upload

If email integration is not feasible, there's also a **Manual PDF Upload** feature (see Feature #3) where admins can manually upload Bradford PO PDFs through the web UI.

---

## Security Notes

- Webhook endpoint is public but validates sender email
- Only emails from steve.gustafson@bgeltd.com are processed
- Subject line MUST contain customer code
- All webhook events are logged for audit trail
- Failed processing attempts are logged but don't create POs

---

## Support

If you encounter issues:

1. Check API logs for error messages
2. Verify webhook events in database
3. Test with sample PDF using manual upload
4. Contact SendGrid support for inbound parse issues

---

## Summary

✅ **Email Monitor Endpoint:** `/api/webhooks/inbound-email`
✅ **Auto-detects:** Emails from steve.gustafson@bgeltd.com with JJSG/BALSG
✅ **Parses PDF:** Extracts customer code, amount, PO number
✅ **Creates PO:** Automatically creates Bradford → JD Graphic PO
✅ **Logs Events:** All webhook events tracked in database
✅ **Fallback:** Manual PDF upload also available
