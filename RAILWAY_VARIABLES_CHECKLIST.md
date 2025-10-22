# Railway Environment Variables Checklist

**Project:** printing-workflow (nurturing-eagerness)
**Services:** api, web, Postgres

---

## 🎯 Quick Reference

| Service | Public URL |
|---------|-----------|
| **web** | `https://web-production-851ca.up.railway.app` |
| **api** | `https://api-production-100d.up.railway.app` |
| **Postgres** | Auto-configured (internal) |

---

## ✅ Currently Configured Variables

### API Service
- ✅ `DATABASE_URL` - Auto-provided by Postgres plugin
- ✅ `NEXTAUTH_URL` - `https://web-production-851ca.up.railway.app`
- ✅ `NEXTAUTH_SECRET` - `ikQrizbl5rvvzzoEXLVQEw9Nwe7v30tdJ3dRHws6vo0=`
- ✅ `EMAIL_FROM` - `nick@jdgraphic.com`
- ✅ `API_SECRET_KEY` - Already set
- ✅ `WEBHOOK_SECRET` - Already set
- ✅ `SENDGRID_API_KEY` - Already set
- ✅ `PORT` - Auto-set by Railway (8080)
- ✅ `API_PORT` - Set to 3001

### Web Service
- ✅ `DATABASE_URL` - Linked to Postgres
- ✅ `NEXTAUTH_URL` - `https://web-production-851ca.up.railway.app`
- ✅ `NEXTAUTH_SECRET` - `ikQrizbl5rvvzzoEXLVQEw9Nwe7v30tdJ3dRHws6vo0=`
- ✅ `EMAIL_FROM` - `nick@jdgraphic.com`
- ✅ `NEXT_PUBLIC_API_URL` - `https://api-production-100d.up.railway.app`

---

## 📋 Complete Variables Reference

### 🔴 Required Variables

#### Both Services (api + web)

| Variable | Required | Services | Current Value | Description |
|----------|----------|----------|---------------|-------------|
| `DATABASE_URL` | ✅ YES | api, web | Auto (Postgres) | PostgreSQL connection string |
| `NEXTAUTH_URL` | ✅ YES | api, web | `https://web-production-851ca.up.railway.app` | Web service public URL |
| `NEXTAUTH_SECRET` | ✅ YES | api, web | `ikQrizbl5r...` | JWT/session secret (32+ chars) |
| `EMAIL_FROM` | ✅ YES | api, web | `nick@jdgraphic.com` | Email sender address |

#### API Service Only

| Variable | Required | Services | Current Value | Description |
|----------|----------|----------|---------------|-------------|
| `PORT` | Auto | api | `8080` | Railway sets automatically |

#### Web Service Only

| Variable | Required | Services | Current Value | Description |
|----------|----------|----------|---------------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ YES | web | `https://api-production-100d.up.railway.app` | Public API endpoint |

---

### 🟡 Optional But Recommended

#### API Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Optional | `production` | Environment mode |
| `API_PORT` | Optional | `3001` | Internal API port (for logs) |
| `API_URL` | Optional | Auto | Internal API URL |
| `EMAIL_FROM_NAME` | Optional | `IDP Production` | Email sender name |
| `API_SECRET_KEY` | Recommended | - | API authentication key (32+ chars) |
| `WEBHOOK_SECRET` | Recommended | - | Webhook signature secret (32+ chars) |
| `SENDGRID_API_KEY` | Recommended | - | SendGrid for emails (alternative to Resend) |

#### Web Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Optional | `production` | Environment mode |
| `RESEND_API_KEY` | Optional | - | Resend API for emails |

---

### 🔵 Feature-Specific (Optional)

#### Redis/Background Workers (API only)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Optional | - | Full Redis connection URL |
| `REDIS_HOST` | Optional | `localhost` | Redis host |
| `REDIS_PORT` | Optional | `6379` | Redis port |

#### S3 Storage (API only)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `S3_ENDPOINT` | Optional | - | S3-compatible endpoint (leave empty for AWS) |
| `S3_REGION` | Optional | `us-east-1` | S3 region |
| `S3_BUCKET` | Optional | - | S3 bucket name |
| `S3_ACCESS_KEY_ID` | Optional | - | S3 access key |
| `S3_SECRET_ACCESS_KEY` | Optional | - | S3 secret key |
| `S3_PUBLIC_URL` | Optional | - | Public S3 URL |

#### AI Features (API only)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Optional | - | OpenAI API for AI features |

#### Testing/Development

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_REDIRECT_TO` | Optional | - | Redirect all emails to this address (testing) |

---

## 🚀 Railway CLI Setup Commands

### Prerequisites

```bash
# Navigate to project directory
cd /Users/nicholasdeblasio/printing-workflow

# Verify Railway CLI is authenticated
railway whoami
```

---

### Step 1: Link Services

```bash
# Link to API service
railway service api

# Verify current variables
railway variables
```

```bash
# Link to Web service
railway service web

# Verify current variables
railway variables
```

---

### Step 2: Set Missing Variables (If Any)

#### For API Service

```bash
railway service api

# If NEXTAUTH_URL is wrong or missing:
railway variables --set "NEXTAUTH_URL=https://web-production-851ca.up.railway.app"

# If EMAIL_FROM is missing:
railway variables --set "EMAIL_FROM=nick@jdgraphic.com"

# Optional: Set email sender name
railway variables --set "EMAIL_FROM_NAME=IDP Production"

# Optional: API_PORT for logging (not critical)
railway variables --set "API_PORT=3001"
```

#### For Web Service

```bash
railway service web

# If NEXTAUTH_URL is wrong or missing:
railway variables --set "NEXTAUTH_URL=https://web-production-851ca.up.railway.app"

# If NEXT_PUBLIC_API_URL is wrong or missing:
railway variables --set "NEXT_PUBLIC_API_URL=https://api-production-100d.up.railway.app"

# If EMAIL_FROM is missing:
railway variables --set "EMAIL_FROM=nick@jdgraphic.com"

# If DATABASE_URL is missing (link to Postgres):
railway variables --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}"
```

---

### Step 3: Generate New Secrets (If Needed)

If you need to regenerate secrets:

```bash
# Generate NEXTAUTH_SECRET (32+ chars)
openssl rand -base64 32

# Generate API_SECRET_KEY
openssl rand -base64 32

# Generate WEBHOOK_SECRET
openssl rand -base64 32
```

Then set them:

```bash
# API Service
railway service api
railway variables --set "NEXTAUTH_SECRET=<generated-secret>"
railway variables --set "API_SECRET_KEY=<generated-secret>"
railway variables --set "WEBHOOK_SECRET=<generated-secret>"

# Web Service (use SAME NEXTAUTH_SECRET as API)
railway service web
railway variables --set "NEXTAUTH_SECRET=<same-secret-as-api>"
```

---

## 🔍 Verification Commands

### Check API Service Variables

```bash
railway service api
railway variables | grep -E "DATABASE_URL|NEXTAUTH|EMAIL_FROM|PORT"
```

**Expected output:**
```
DATABASE_URL             │ postgresql://...
EMAIL_FROM               │ nick@jdgraphic.com
NEXTAUTH_SECRET          │ ikQrizbl5r...
NEXTAUTH_URL             │ https://web-production-851ca.up.railway.app
PORT                     │ 8080 (auto-set by Railway)
```

---

### Check Web Service Variables

```bash
railway service web
railway variables | grep -E "DATABASE_URL|NEXTAUTH|EMAIL_FROM|NEXT_PUBLIC"
```

**Expected output:**
```
DATABASE_URL             │ postgresql://...
EMAIL_FROM               │ nick@jdgraphic.com
NEXTAUTH_SECRET          │ ikQrizbl5r...
NEXTAUTH_URL             │ https://web-production-851ca.up.railway.app
NEXT_PUBLIC_API_URL      │ https://api-production-100d.up.railway.app
```

---

### Check Deployment Status

```bash
# API service
railway service api
railway deployment list | head -5

# Web service
railway service web
railway deployment list | head -5
```

---

## ❌ Common Mistakes to Avoid

### 1. Wrong NEXTAUTH_URL
❌ **WRONG:**
```bash
# API pointing to API URL (should point to WEB)
NEXTAUTH_URL=https://api-production-100d.up.railway.app
```

✅ **CORRECT:**
```bash
# Both services point to WEB URL
NEXTAUTH_URL=https://web-production-851ca.up.railway.app
```

---

### 2. Missing HTTPS in URLs
❌ **WRONG:**
```bash
NEXT_PUBLIC_API_URL=api-production-100d.up.railway.app
```

✅ **CORRECT:**
```bash
NEXT_PUBLIC_API_URL=https://api-production-100d.up.railway.app
```

---

### 3. Empty Variables
❌ **WRONG:**
```bash
API_PORT=
```

✅ **CORRECT:**
```bash
# Either set a value or don't set at all (let it use default)
API_PORT=3001
```

---

### 4. Mismatched NEXTAUTH_SECRET
❌ **WRONG:**
```bash
# API has one secret
railway service api
railway variables --set "NEXTAUTH_SECRET=abc123..."

# Web has different secret
railway service web
railway variables --set "NEXTAUTH_SECRET=xyz789..."
```

✅ **CORRECT:**
```bash
# Both services use THE SAME secret
SAME_SECRET="ikQrizbl5rvvzzoEXLVQEw9Nwe7v30tdJ3dRHws6vo0="

railway service api
railway variables --set "NEXTAUTH_SECRET=$SAME_SECRET"

railway service web
railway variables --set "NEXTAUTH_SECRET=$SAME_SECRET"
```

---

## 🆘 Troubleshooting

### Build Fails with "Invalid environment variables"

**Symptoms:**
```
Error: Invalid environment variables
{ NEXTAUTH_URL: [ 'Required' ] }
```

**Solution:**
```bash
railway service <failing-service>
railway variables --set "NEXTAUTH_URL=https://web-production-851ca.up.railway.app"
```

---

### API Returns 502 Bad Gateway

**Cause:** API not binding to Railway's PORT (8080)

**Check:**
```bash
railway service api
railway logs | grep "Attempting to bind"
```

**Should see:**
```
Attempting to bind to port: 8080 on host 0.0.0.0
```

**If you see port 3001:** The PORT variable is not being used correctly in the code.

---

### CORS Errors

**Cause:** NEXTAUTH_URL not matching web URL

**Fix:**
```bash
railway service api
railway variables --set "NEXTAUTH_URL=https://web-production-851ca.up.railway.app"
```

---

## 📝 Notes

- **DATABASE_URL** is automatically injected by Railway's PostgreSQL plugin - you don't need to set it manually
- **PORT** is automatically set by Railway to 8080 - don't override it
- **NEXTAUTH_SECRET** must be the same on both api and web services
- **NEXTAUTH_URL** always points to the WEB service URL, never the API URL
- Variables starting with **NEXT_PUBLIC_** are exposed to the browser
- Changes to variables trigger automatic redeployments

---

## 📚 Related Documentation

- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [T3 Env Documentation](https://env.t3.gg/)
- [NextAuth.js Environment Variables](https://next-auth.js.org/configuration/options#environment-variables)

---

**Last Updated:** 2025-10-22
**Railway Project:** nurturing-eagerness (7e6ce670-7b95-4d1d-b83c-b40ac7ea8c85)
