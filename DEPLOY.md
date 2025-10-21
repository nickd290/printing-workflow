# 🚀 Railway Deployment Guide

This guide walks you through deploying the Printing Workflow application to Railway from GitHub.

## Prerequisites

- GitHub account with this repository
- Railway account ([sign up at railway.app](https://railway.app))
- Access to generate secure secrets (openssl or similar tool)

---

## Step 1: Push Code to GitHub

Make sure all your changes are committed and pushed to GitHub:

```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

---

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub account
4. Select the `printing-workflow` repository
5. **DO NOT** click deploy yet - we need to configure services first

---

## Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will automatically create a PostgreSQL database
4. Note: The `DATABASE_URL` environment variable will be automatically available to your services

---

## Step 4: Create API Service

### Configure API Service

1. Click **"+ New"** → **"GitHub Repo"** → Select your repo
2. Name the service: `api`
3. Click on the `api` service to configure it

### Set Root Directory
- Go to **Settings** → **Service**
- Set **Root Directory**: Leave empty (we'll use build commands to handle the monorepo)

### Configure Build & Start Commands

Go to **Settings** → **Build**:

**Build Command:**
```bash
cd $RAILWAY_STATIC_DIR && pnpm install && pnpm db:generate && cd apps/api && pnpm build
```

**Start Command:**
```bash
cd apps/api && pnpm start
```

### Set Environment Variables

Go to **Variables** tab and add:

```bash
# Auto-provided by Railway (do not manually set):
# DATABASE_URL - Automatically injected by PostgreSQL service

# Required - Generate these secrets:
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
API_SECRET_KEY=<generate-with-openssl-rand-base64-32>
WEBHOOK_SECRET=<generate-with-openssl-rand-base64-32>

# API Configuration:
NODE_ENV=production
API_PORT=$PORT

# Optional (Email services):
RESEND_API_KEY=<your-resend-api-key-if-using>
SENDGRID_API_KEY=<your-sendgrid-api-key-if-using>
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Printing Workflow

# After Web service is deployed, update this:
NEXTAUTH_URL=<your-web-service-url-from-railway>
```

**To generate secrets**, run locally:
```bash
openssl rand -base64 32  # Run 3 times for each secret
```

---

## Step 5: Create Web Service

### Configure Web Service

1. Click **"+ New"** → **"GitHub Repo"** → Select your repo again
2. Name the service: `web`
3. Click on the `web` service to configure it

### Configure Build & Start Commands

Go to **Settings** → **Build**:

**Build Command:**
```bash
cd $RAILWAY_STATIC_DIR && pnpm install && cd apps/web && pnpm build
```

**Start Command:**
```bash
cd apps/web && pnpm start
```

### Set Environment Variables

Go to **Variables** tab and add:

```bash
# Database (reference the same database as API):
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Authentication (use SAME secrets as API):
NEXTAUTH_SECRET=<same-as-api-service>
NEXTAUTH_URL=${{RAILWAY_PUBLIC_DOMAIN}}

# API Connection:
NEXT_PUBLIC_API_URL=<your-api-service-url-from-railway>

# Environment:
NODE_ENV=production
```

**To get the API service URL:**
1. Go to your `api` service
2. Go to **Settings** → **Networking**
3. Click **"Generate Domain"** if not already done
4. Copy the public domain (e.g., `https://printing-workflow-api.up.railway.app`)
5. Use this as `NEXT_PUBLIC_API_URL`

---

## Step 6: Deploy Services

1. Both services should now trigger deployments automatically
2. Monitor the build logs in Railway dashboard
3. Wait for both services to show "Active" status

---

## Step 7: Run Database Migrations

Once the API service is deployed:

1. Go to the `api` service in Railway
2. Click on **"View Logs"** (to monitor the migration)
3. Go to **Settings** → **Deploy**
4. Run a one-time command:

```bash
npx prisma migrate deploy
```

Then seed the database:

```bash
npx prisma db seed
```

**Alternative method using Railway CLI:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migration
railway run --service api npx prisma migrate deploy

# Seed database
railway run --service api npx prisma db seed
```

---

## Step 8: Configure CORS

Your API needs to allow requests from your Web service.

In `apps/api/src/index.ts`, the CORS configuration should automatically allow your production URLs. Verify it includes:

```typescript
await fastify.register(cors, {
  origin: [env.NEXTAUTH_URL, 'http://localhost:5175'],
  credentials: true,
});
```

The `env.NEXTAUTH_URL` will use the Railway web domain.

---

## Step 9: Update Web Service with API URL

Now that both services are deployed:

1. Go to `web` service → **Variables**
2. Update `NEXTAUTH_URL` if needed (should auto-populate with `${{RAILWAY_PUBLIC_DOMAIN}}`)
3. Verify `NEXT_PUBLIC_API_URL` points to your API service domain

Both services will automatically redeploy when environment variables change.

---

## Step 10: Test Your Deployment

1. Visit your Web service URL (e.g., `https://your-app.up.railway.app`)
2. Navigate to `/login`
3. Test login with the seeded accounts:
   - Email: `admin@impactdirect.com`
   - Password: `password123`
4. Verify the dashboard loads and shows data

---

## Environment Variables Checklist

### API Service
- ✅ `DATABASE_URL` - Auto-injected by Railway
- ✅ `NEXTAUTH_SECRET` - Generated secret
- ✅ `API_SECRET_KEY` - Generated secret
- ✅ `WEBHOOK_SECRET` - Generated secret
- ✅ `NODE_ENV=production`
- ✅ `API_PORT=$PORT`
- ✅ `NEXTAUTH_URL` - Web service URL
- ⬜ `RESEND_API_KEY` - Optional
- ⬜ `SENDGRID_API_KEY` - Optional

### Web Service
- ✅ `DATABASE_URL` - Reference Postgres
- ✅ `NEXTAUTH_SECRET` - Same as API
- ✅ `NEXTAUTH_URL=${{RAILWAY_PUBLIC_DOMAIN}}`
- ✅ `NEXT_PUBLIC_API_URL` - API service URL
- ✅ `NODE_ENV=production`

---

## Troubleshooting

### Build Fails

**Error: "pnpm: command not found"**
- Railway should auto-detect pnpm from `packageManager` in package.json
- If not, add to build command: `npm install -g pnpm && ...`

**Error: "DATABASE_URL is not defined"**
- Make sure PostgreSQL service is created
- Verify DATABASE_URL is available in Variables tab

### Runtime Errors

**Error: "Invalid or expired token"**
- Make sure `NEXTAUTH_SECRET` is the SAME in both API and Web services

**Error: "CORS error"**
- Verify API service has `NEXTAUTH_URL` set to Web service domain
- Check CORS configuration in `apps/api/src/index.ts`

**Database connection errors:**
- Verify PostgreSQL service is running
- Check that migrations were applied
- Ensure DATABASE_URL is correctly referenced

### Logs

View logs for each service:
1. Go to service in Railway dashboard
2. Click **"View Logs"**
3. Monitor for errors

---

## Custom Domain (Optional)

To add a custom domain:

1. Go to Web service → **Settings** → **Networking**
2. Click **"Custom Domain"**
3. Add your domain (e.g., `printing.yourdomain.com`)
4. Add the CNAME record to your DNS provider
5. Update `NEXTAUTH_URL` in both services to use your custom domain

---

## Monitoring & Maintenance

### View Logs
- Railway Dashboard → Your Service → View Logs

### Database Backups
- Railway automatically backs up PostgreSQL databases
- Access in: PostgreSQL service → Backups

### Redeploy
- Push to GitHub → Automatic deployment
- Or: Railway Dashboard → Service → Deployments → "Redeploy"

### Environment Variables
- Update in Railway Dashboard → Service → Variables
- Service will automatically redeploy

---

## Production Checklist

Before going live:

- [ ] Change default user passwords from seed
- [ ] Generate new production secrets (don't reuse dev secrets)
- [ ] Configure email service (Resend or SendGrid)
- [ ] Set up custom domain (optional)
- [ ] Configure S3/MinIO for file uploads (if needed)
- [ ] Set up Redis for background workers (if needed)
- [ ] Enable Railway health checks
- [ ] Test all authentication flows
- [ ] Test critical user paths
- [ ] Monitor initial production logs

---

## Costs

Railway Pricing (as of 2024):
- **Hobby Plan**: $5/month
  - Includes $5 usage credit
  - Good for small production apps
- **Pro Plan**: $20/month
  - Includes $20 usage credit
  - Better for production

**Estimated costs for this app:**
- PostgreSQL: ~$2-3/month
- 2 Services (API + Web): ~$2-4/month
- **Total**: ~$4-7/month on Hobby plan

---

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Application issues: Create GitHub issue

---

**🎉 Congratulations! Your app should now be live on Railway.**
