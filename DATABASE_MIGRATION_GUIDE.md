# Database Migration Guide: SQLite → PostgreSQL

## Why Migrate?

**Current (SQLite):**
- ❌ File-based (single point of failure)
- ❌ Limited to 1-2 concurrent writes
- ❌ No replication or backups
- ❌ Not production-ready

**After (PostgreSQL):**
- ✅ Server-based with ACID guarantees
- ✅ Handles 10,000+ concurrent users
- ✅ Automated backups
- ✅ Point-in-time recovery
- ✅ Production-ready

---

## Option 1: Railway PostgreSQL (Recommended)

### Step 1: Create PostgreSQL Database

```bash
cd /Users/nicholasdeblasio/printing-workflow

# Login to Railway (if not already logged in)
railway login

# Link to existing project (if you have one)
railway link

# Add PostgreSQL to your project
railway add --service postgres

# Get the DATABASE_URL
railway variables --service postgres
```

### Step 2: Update Environment Variables

Copy the `DATABASE_URL` from Railway and update your `.env` file:

```bash
# Replace this line in .env:
# DATABASE_URL="file:./dev.db"

# With your Railway PostgreSQL URL:
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"
```

### Step 3: Update Prisma Schema

```bash
# The schema has been updated to support both SQLite and PostgreSQL
# No changes needed!
```

### Step 4: Push Schema to PostgreSQL

```bash
cd packages/db
npx prisma generate
npx prisma db push
```

### Step 5: Seed the Database

```bash
cd packages/db
npx tsx src/seed.ts
```

### Step 6: Verify Migration

```bash
npx prisma studio
# Should open at http://localhost:5555
# You should see all your tables with seeded data
```

---

## Option 2: Local Docker PostgreSQL

### Step 1: Install Docker Desktop

Download and install from: https://www.docker.com/products/docker-desktop

### Step 2: Start PostgreSQL

```bash
cd /Users/nicholasdeblasio/printing-workflow
docker compose up -d postgres
```

### Step 3: Update .env

```bash
# Replace this line:
DATABASE_URL="file:./dev.db"

# With:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/printing_workflow?schema=public"
```

### Step 4: Push Schema

```bash
cd packages/db
npx prisma generate
npx prisma db push
```

### Step 5: Seed Database

```bash
cd packages/db
npx tsx src/seed.ts
```

---

## Option 3: Keep SQLite (Development Only)

If you want to stay with SQLite for local development:

1. Keep current `DATABASE_URL="file:./dev.db"`
2. Use PostgreSQL in production only
3. Set production `DATABASE_URL` via environment variables

**Warning:** SQLite will fail under concurrent load!

---

## Migration Checklist

- [ ] Choose migration option (Railway recommended)
- [ ] Create PostgreSQL database
- [ ] Update DATABASE_URL in .env
- [ ] Run `npx prisma generate`
- [ ] Run `npx prisma db push`
- [ ] Run `npx tsx src/seed.ts` to seed data
- [ ] Test API endpoints (create job, view jobs, etc.)
- [ ] Update production deployment with new DATABASE_URL
- [ ] Delete old `dev.db` file (after confirming migration works)

---

## Rollback Plan

If migration fails:

```bash
# Restore .env
DATABASE_URL="file:./dev.db"

# Regenerate Prisma client
cd packages/db
npx prisma generate

# Restart API server
cd apps/api
npx pnpm dev
```

---

## Cost Estimate

| Provider | Free Tier | Paid |
|----------|-----------|------|
| **Railway** | 500 hours/month | $5/month+ |
| **Supabase** | Unlimited | $25/month |
| **Render** | 90 days free | $7/month |
| **Docker Local** | Free | Free |

**Recommendation:** Railway for ease of use and production readiness.

---

## Next Steps After Migration

1. **Set up automated backups** (Railway does this automatically)
2. **Monitor database performance** (Railway dashboard)
3. **Enable connection pooling** (optional, for high traffic)
4. **Set up read replicas** (optional, for scaling)

---

## Troubleshooting

### "Can't reach database server"
- Check DATABASE_URL is correct
- Ensure database is running (`docker ps` or Railway dashboard)
- Check firewall/security groups allow connection

### "Prisma schema has errors"
- Run `npx prisma validate`
- Ensure Prisma version is compatible with PostgreSQL

### "Migration failed"
- Check database credentials
- Ensure database is empty (fresh PostgreSQL)
- Try `npx prisma db push --force-reset`

---

## Support

If you encounter issues:
1. Check Railway logs: `railway logs --service postgres`
2. Check Prisma logs in terminal
3. Verify DATABASE_URL format is correct
