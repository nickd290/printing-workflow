# SendGrid Email Setup Guide

## Overview
Your system is now configured to send professional emails via SendGrid using:
- **From Email:** nick@jdgraphic.com
- **Display Name:** IDP Production
- **Beautiful HTML templates** for all email notifications

---

## Step 1: Get Your SendGrid API Key

### 1.1 Create a SendGrid Account
If you don't have one already:
1. Go to https://sendgrid.com
2. Sign up for a free account (or use your existing account)
3. Free tier includes 100 emails/day forever

### 1.2 Create an API Key
1. Log in to SendGrid
2. Go to **Settings** → **API Keys** (https://app.sendgrid.com/settings/api_keys)
3. Click **Create API Key**
4. Name it: `IDP Production API Key`
5. Choose **Full Access** (recommended) or **Restricted Access** with at least:
   - Mail Send: **Full Access**
6. Click **Create & View**
7. **IMPORTANT:** Copy the API key immediately (you won't be able to see it again!)

---

## Step 2: Configure the Sender Email

### 2.1 Verify Your Domain (Recommended)
For production use, verify `jdgraphic.com`:

1. In SendGrid, go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender** (easier) OR **Authenticate Your Domain** (better for production)

#### Option A: Single Sender Verification (Easiest)
1. Click **Verify a Single Sender**
2. Fill in:
   - **From Name:** IDP Production
   - **From Email Address:** nick@jdgraphic.com
   - **Reply To:** nick@jdgraphic.com (or support email)
   - Company details
3. Click **Create**
4. Check your email (nick@jdgraphic.com) and click the verification link

#### Option B: Domain Authentication (Better for Production)
1. Click **Authenticate Your Domain**
2. Choose your DNS host (where jdgraphic.com is registered)
3. Follow the instructions to add DNS records (CNAME records)
4. Wait for DNS propagation (can take up to 48 hours, usually < 1 hour)

---

## Step 3: Add API Key to Your Application

### 3.1 Update .env File
Edit `/Users/nicholasdeblasio/printing-workflow/.env`:

```bash
# Replace the empty SENDGRID_API_KEY with your actual key:
SENDGRID_API_KEY="SG.your-actual-api-key-here"
EMAIL_FROM="nick@jdgraphic.com"
EMAIL_FROM_NAME="IDP Production"
# ALL EMAILS will go to this address (perfect for testing!)
EMAIL_REDIRECT_TO="nick@starterboxstudios.com"
```

**Email Redirect Feature (Already Configured!):**
- All emails will be sent to `nick@starterboxstudios.com`
- Subject line will show original recipient: `[For: customer@example.com] Invoice Ready`
- Email body will have a yellow banner showing the original recipient
- Perfect for testing without spamming real customers!
- To disable: remove or leave `EMAIL_REDIRECT_TO` empty

### 3.2 Restart Your API Server
Since the API is running, you'll need to restart it to pick up the new environment variable:

1. Stop the current API server (Ctrl+C in the terminal running it)
2. Restart it:
   ```bash
   cd /Users/nicholasdeblasio/printing-workflow/apps/api
   npx pnpm dev
   ```

---

## Step 4: Test Email Sending

### 4.1 Create a Test Job
1. Go to http://localhost:5174/jobs
2. Click **+ New Job**
3. Fill in the form and submit
4. The system will automatically send a "Job Created" email

### 4.2 Check Email Delivery
- **If SendGrid is configured:** Check the recipient's inbox
- **If not configured yet:** Emails will be logged to the API console with full details

### 4.3 Monitor in SendGrid Dashboard
1. Go to https://app.sendgrid.com/email_activity
2. View all sent emails, delivery status, opens, and clicks

---

## Email Templates Included

Your system now has these professional email templates:

### 1. **Quote Ready** 📋
Sent when a quote is prepared for a customer.

### 2. **Proof Ready** 🎨
Sent when a proof is ready for customer review.

### 3. **Proof Approved** ✅
Sent when a customer approves a proof (production starts).

### 4. **Shipment Scheduled** 📦
Sent when an order ships with tracking information.

### 5. **Invoice Sent** 💰
Sent with the invoice PDF attached.

### 6. **Job Created** 🎯
Sent when a new job is created (confirmation).

### 7. **Bradford PO Created** 📄
Internal notification when a PO is auto-generated to Bradford.

---

## Email Template Features

All emails include:
- **Beautiful gradient header** with "IDP Production" branding
- **Professional styling** with responsive design
- **Clear call-to-action buttons** (View Quote, Review Proof, Track Shipment, etc.)
- **Info boxes** highlighting key details
- **Footer** with contact information (nick@jdgraphic.com)
- **Mobile-friendly** design

---

## Development Mode

When `SENDGRID_API_KEY` is not set (or empty):
- Emails are **logged to the console** instead of being sent
- You'll see the full email HTML in your API server logs
- Great for development and testing

---

## Production Checklist

Before going live:
- [ ] SendGrid API key added to `.env`
- [ ] Domain authenticated (or sender verified)
- [ ] Test email sent successfully
- [ ] Check spam folder if emails not arriving
- [ ] Set up SPF/DKIM records (done automatically with domain auth)
- [ ] Monitor SendGrid dashboard for delivery rates

---

## Troubleshooting

### Emails not sending?
1. Check API logs for errors
2. Verify SendGrid API key is correct
3. Make sure sender email is verified
4. Check SendGrid activity dashboard for blocks/bounces

### Emails going to spam?
1. Complete domain authentication (not just single sender)
2. Add SPF and DKIM records
3. Warm up your sending (start with low volume)
4. Ask recipients to whitelist nick@jdgraphic.com

### Rate limits?
- Free tier: 100 emails/day
- Upgrade plans available starting at $19.95/month for 50K emails

---

## Next Steps

1. Get your SendGrid API key from https://app.sendgrid.com/settings/api_keys
2. Verify nick@jdgraphic.com as a sender
3. Add the API key to your `.env` file
4. Restart the API server
5. Test by creating a job!

---

## Support

SendGrid Support: https://support.sendgrid.com
SendGrid Docs: https://docs.sendgrid.com

Your emails will look professional and branded as "IDP Production" from nick@jdgraphic.com!
