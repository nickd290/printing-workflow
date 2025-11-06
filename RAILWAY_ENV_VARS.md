# Railway Environment Variables Configuration

This document outlines the required environment variables for deploying the printing-workflow app to Railway.

## Project Structure

The app uses a monorepo with two services that must be deployed separately:
1. **API Service** (`apps/api`) - Fastify backend
2. **Web Service** (`apps/web`) - Next.js frontend

## Database Service

Railway should have a PostgreSQL database plugin installed. This automatically provides the `DATABASE_URL` variable.

---

## API Service Environment Variables

### Required Variables

```bash
# Database (auto-provided by Railway PostgreSQL plugin)
DATABASE_URL=postgresql://...

# Authentication
NEXTAUTH_SECRET="your-secret-here-min-32-chars"
NEXTAUTH_URL="https://your-web-service.up.railway.app"

# API Configuration
NODE_ENV=production
API_PORT=$PORT  # Railway auto-sets this

# Email (SendGrid)
SENDGRID_API_KEY="your-sendgrid-api-key"
EMAIL_FROM="nick@jdgraphic.com"
EMAIL_FROM_NAME="IDP Production"

# OpenAI (Optional - for AI features)
OPENAI_API_KEY="your-openai-key"  # Optional

# Webhooks
WEBHOOK_SECRET="your-webhook-secret"
API_SECRET_KEY="your-api-secret-key"
```

### Notes:
- `DATABASE_URL` is automatically set by Railway's PostgreSQL plugin
- `$PORT` is automatically set by Railway (usually 8080)
- `NEXTAUTH_SECRET` must be at least 32 characters (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` should point to your Web service public domain

---

## Web Service Environment Variables

### Required Variables

```bash
# Database (reference the PostgreSQL plugin)
DATABASE_URL=${Postgres.DATABASE_URL}

# Authentication
NEXTAUTH_SECRET="same-as-api-service"
NEXTAUTH_URL=${{RAILWAY_PUBLIC_DOMAIN}}

# API Connection
NEXT_PUBLIC_API_URL="https://your-api-service.up.railway.app"

# Node Environment
NODE_ENV=production
```

### Notes:
- `NEXT_PUBLIC_API_URL` must point to your API service's public domain
- `NEXTAUTH_SECRET` must match the API service exactly
- `${{RAILWAY_PUBLIC_DOMAIN}}` is a Railway variable that auto-resolves to the web service's URL

---

## Deployment Checklist

### 1. Create Railway Project
- [ ] Create new Railway project: "printing-workflow"
- [ ] Add PostgreSQL database plugin

### 2. Deploy API Service
- [ ] Create service from GitHub repo
- [ ] Set root directory: `apps/api`
- [ ] Configure environment variables (see above)
- [ ] Generate public domain
- [ ] Note the API URL for step 3

### 3. Deploy Web Service
- [ ] Create service from GitHub repo
- [ ] Set root directory: `apps/web`
- [ ] Configure environment variables (use API URL from step 2)
- [ ] Generate public domain
- [ ] Update API service's `NEXTAUTH_URL` with this web URL

### 4. Post-Deployment
- [ ] Verify both services are "Active"
- [ ] Test web app at public URL
- [ ] Verify API connection works
- [ ] Test authentication flow
- [ ] Check logs for any errors

---

## Current Values (from local .env)

The following values are currently in your local `.env` files and should be copied to Railway:

### From Root `.env`:
```bash
NEXTAUTH_SECRET="0xuccXl/oItMZEWdXMZTxrTvv8MN9eWfwPrSsrCO4U8="
WEBHOOK_SECRET="your-webhook-secret"
API_SECRET_KEY="your-api-secret-key"
```

### API Keys (keep secure):
- SendGrid API Key: (check apps/api/.env)
- OpenAI API Key: (check apps/api/.env - optional)

---

## Common Issues & Solutions

### Issue: "Failed to load dashboard data"
**Cause:** `NEXT_PUBLIC_API_URL` not set or incorrect on Web service
**Solution:** Ensure `NEXT_PUBLIC_API_URL` points to API service public domain

### Issue: "CORS error" in browser console
**Cause:** API service's `NEXTAUTH_URL` doesn't match web service URL
**Solution:** Update API service's `NEXTAUTH_URL` to match web service public domain

### Issue: Authentication not working
**Cause:** `NEXTAUTH_SECRET` doesn't match between services
**Solution:** Ensure both services use identical `NEXTAUTH_SECRET`

### Issue: Database connection error
**Cause:** PostgreSQL plugin not connected or DATABASE_URL incorrect
**Solution:** Verify PostgreSQL plugin is installed and connected to both services

---

## Security Notes

1. **Never commit** `.env` files to Git
2. **Use Railway's secrets** for sensitive values (API keys, secrets)
3. **Rotate secrets regularly** (NEXTAUTH_SECRET, API keys)
4. **Restrict CORS origins** in production (already configured via NEXTAUTH_URL)
5. **Use strong secrets** (minimum 32 characters for NEXTAUTH_SECRET)

---

## Cost Estimate

**Railway Hobby Plan** (~$5-10/month):
- PostgreSQL database: ~$3/month
- API service: ~$2/month
- Web service: ~$2/month
- **Total: ~$7/month**

Add persistent storage (Railway volumes) if needed: +$10/month for 100GB
