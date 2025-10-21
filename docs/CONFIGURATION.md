# Configuration Guide

This document explains all configuration options, environment variables, and service setup for the Printing Workflow application.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Database Configuration](#database-configuration)
- [Redis Configuration](#redis-configuration)
- [Storage Configuration (S3)](#storage-configuration-s3)
- [Email Services](#email-services)
- [Authentication](#authentication)
- [API Configuration](#api-configuration)
- [OpenAI Integration](#openai-integration)
- [Port Assignments](#port-assignments)
- [Service Priority](#service-priority)
- [Deployment](#deployment)

## Environment Variables

All environment variables should be defined in a `.env` file at the project root.

**Setup:**

```bash
cp .env.example .env
# Edit .env with your values
```

**Important:** Never commit `.env` to version control. It's in `.gitignore`.

## Database Configuration

### Development (SQLite)

**Default Setup:** SQLite is used for local development.

```bash
DATABASE_URL="file:./packages/db/prisma/dev.db"
```

**Benefits:**
- No Docker required
- Fast setup
- Portable database file

**Location:** `packages/db/prisma/dev.db`

### Production (PostgreSQL)

**Recommended:** PostgreSQL for production and team development.

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/printing_workflow?schema=public"
```

**Docker Setup:**

The project includes a `docker-compose.yml` for PostgreSQL:

```bash
pnpm docker:up
```

This starts:
- PostgreSQL on port 5432
- Default credentials: `postgres:postgres`
- Database: `printing_workflow`

**Environment Variable:**

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/printing_workflow?schema=public"
```

### Switching Between Databases

**To SQLite:**

1. Update `.env`:
   ```bash
   DATABASE_URL="file:./packages/db/prisma/dev.db"
   ```

2. Update `schema.prisma` provider:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

3. Regenerate and push:
   ```bash
   pnpm db:generate
   pnpm db:push
   pnpm db:seed
   ```

**To PostgreSQL:**

1. Start Docker:
   ```bash
   pnpm docker:up
   ```

2. Update `.env`:
   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/printing_workflow?schema=public"
   ```

3. Update `schema.prisma` provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

4. Regenerate and push:
   ```bash
   pnpm db:generate
   pnpm db:push
   pnpm db:seed
   ```

## Redis Configuration

**Purpose:** Required for BullMQ background job queues.

**Docker Setup:**

Included in `docker-compose.yml`:

```bash
pnpm docker:up
```

**Environment Variables:**

```bash
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_URL="redis://localhost:6379"
```

**Optional:** Redis is only required if using background workers. The API will function without it, but worker features (email, PDF processing) won't be available.

**Cloud Redis:**

For production, use a managed Redis service (Railway, Upstash, Redis Cloud):

```bash
REDIS_URL="redis://username:password@host:port"
```

## Storage Configuration (S3)

**Purpose:** File storage for uploads (PDFs, images, documents).

### Development (MinIO)

**MinIO** provides S3-compatible local storage.

**Docker Setup:**

The `docker-compose.yml` includes MinIO:

```bash
pnpm docker:up
```

**Environment Variables:**

```bash
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_BUCKET="printing-files"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_PUBLIC_URL="http://localhost:9000"
```

**Access MinIO Console:**
- URL: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin`

**Create Bucket:**

1. Open http://localhost:9001
2. Login with credentials
3. Create bucket named `printing-files`
4. Set bucket policy to public (optional)

### Production (AWS S3)

**Setup:**

1. Create an S3 bucket in AWS
2. Create IAM user with S3 permissions
3. Generate access keys

**Environment Variables:**

```bash
S3_ENDPOINT=""              # Leave empty for AWS S3
S3_REGION="us-east-1"       # Your AWS region
S3_BUCKET="your-bucket-name"
S3_ACCESS_KEY_ID="your-access-key-id"
S3_SECRET_ACCESS_KEY="your-secret-access-key"
S3_PUBLIC_URL="https://your-bucket.s3.amazonaws.com"
```

**IAM Policy (Minimum Permissions):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

### Alternative: Cloudflare R2

```bash
S3_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="your-bucket-name"
S3_ACCESS_KEY_ID="your-r2-access-key"
S3_SECRET_ACCESS_KEY="your-r2-secret-key"
S3_PUBLIC_URL="https://your-public-domain.com"
```

**Optional:** If S3 is not configured, file upload features will be disabled.

## Email Services

**Purpose:** Send emails for notifications, invoices, quotes, etc.

The application supports **two email services** with automatic fallback:

1. **Resend** (Primary)
2. **SendGrid** (Fallback)

### Primary: Resend

**Recommended** for new projects.

**Setup:**

1. Create account at https://resend.com
2. Verify domain or use their test domain
3. Generate API key

**Environment Variables:**

```bash
RESEND_API_KEY="re_your_api_key_here"
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_FROM_NAME="Your Company Name"
```

**Test Mode:**

Redirect all emails to a test address during development:

```bash
EMAIL_REDIRECT_TO="your-test-email@example.com"
```

**Remove or leave empty for production:**

```bash
EMAIL_REDIRECT_TO=""
```

### Fallback: SendGrid

**Setup:**

1. Create account at https://sendgrid.com
2. Verify sender identity
3. Generate API key

**Environment Variables:**

```bash
SENDGRID_API_KEY="SG.your_api_key_here"
```

### Service Priority

The application tries services in this order:

1. **Resend** - If `RESEND_API_KEY` is set
2. **SendGrid** - If Resend fails and `SENDGRID_API_KEY` is set
3. **Error** - If both fail

**Implementation:**

```typescript
// lib/email.ts
export async function sendEmail(options: EmailOptions) {
  // Try Resend first
  if (process.env.RESEND_API_KEY) {
    try {
      await resend.send(options);
      return;
    } catch (error) {
      logger.warn('Resend failed, falling back to SendGrid');
    }
  }

  // Fallback to SendGrid
  if (process.env.SENDGRID_API_KEY) {
    await sendgrid.send(options);
    return;
  }

  throw new Error('No email service configured');
}
```

**Optional:** Email services are optional. If neither is configured, email features will be disabled.

## Authentication

### NextAuth Configuration

**Session Strategy:** Database sessions (stored in Prisma)

**Provider:** Credentials provider with email/password

**Environment Variables:**

```bash
NEXTAUTH_URL="http://localhost:5175"
NEXTAUTH_SECRET="your-secret-here-generate-with-openssl-rand-base64-32"
```

**Generate Secret:**

```bash
openssl rand -base64 32
```

**Production:**

```bash
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="production-secret-different-from-dev"
```

### API Authentication

**Method:** API key in header

**Environment Variable:**

```bash
API_SECRET_KEY="your-api-secret-key-here"
```

**Generate:**

```bash
openssl rand -base64 32
```

**Usage:**

```bash
curl -H "X-API-Key: your-api-secret-key-here" http://localhost:3001/api/jobs
```

### Webhook Security

**Webhook Secret:** For validating webhook signatures

```bash
WEBHOOK_SECRET="your-webhook-secret-here"
```

**Generate:**

```bash
openssl rand -base64 32
```

## API Configuration

**Environment Variables:**

```bash
API_URL="http://localhost:3001"        # Backend URL (for server-side)
API_PORT="3001"                        # Port for API server

# Frontend needs public API URL
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

**Production:**

```bash
API_URL="https://api.yourdomain.com"
API_PORT="3001"
NEXT_PUBLIC_API_URL="https://api.yourdomain.com"
```

**Important:** `NEXT_PUBLIC_*` variables are exposed to the browser. Never put secrets in them.

## OpenAI Integration

**Purpose:** AI-powered PDF parsing and text extraction (optional feature).

**Environment Variable:**

```bash
OPENAI_API_KEY="sk-your-openai-api-key-here"
```

**Setup:**

1. Create account at https://platform.openai.com
2. Add credits to account
3. Generate API key

**Optional:** If not set, AI features will be disabled. The app will use basic PDF parsing instead.

**Cost:** OpenAI charges per token. Monitor usage in your OpenAI dashboard.

## Port Assignments

| Service | Port | Description |
|---------|------|-------------|
| API (Fastify) | 3001 | Backend REST API |
| Web (Next.js) | 5175 | Frontend application |
| PostgreSQL | 5432 | Database (Docker) |
| Redis | 6379 | Queue/cache (Docker) |
| MinIO | 9000 | S3 storage (Docker) |
| MinIO Console | 9001 | MinIO admin UI (Docker) |

**Why 5175?**

Non-standard port to avoid conflicts with other projects typically using 3000.

**Change Ports:**

Edit `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev -p 5175"  // Change to your port
  }
}
```

And update environment variables:

```bash
NEXT_PUBLIC_API_URL="http://localhost:YOUR_PORT"
```

## Service Priority

### Required Services

**Always Required:**
- Database (SQLite or PostgreSQL)

**Required for Full Functionality:**
- Redis (for background workers)

### Optional Services

Can run without these (features will be disabled):

- **Email Service** (Resend/SendGrid) - Email features disabled
- **S3 Storage** (AWS/MinIO) - File upload disabled
- **OpenAI** - AI features use fallback parsing

### Minimal Setup

For basic development without Docker:

```bash
# .env minimal
DATABASE_URL="file:./packages/db/prisma/dev.db"
NEXTAUTH_URL="http://localhost:5175"
NEXTAUTH_SECRET="generated-secret"
NEXT_PUBLIC_API_URL="http://localhost:3001"
API_SECRET_KEY="generated-secret"
NODE_ENV="development"
```

This runs API + Web without workers, email, or S3.

### Full Setup

For complete feature set:

```bash
# Start all Docker services
pnpm docker:up

# .env full configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/printing_workflow?schema=public"
REDIS_URL="redis://localhost:6379"
S3_ENDPOINT="http://localhost:9000"
# ... all other variables from .env.example
```

## Deployment

### Railway

**Services to Deploy:**
1. PostgreSQL database
2. Redis instance
3. API (Fastify)
4. Web (Next.js)

**Environment Variables:**

Railway provides `DATABASE_URL` and `REDIS_URL` automatically. You need to add:

- `NEXTAUTH_SECRET`
- `API_SECRET_KEY`
- `WEBHOOK_SECRET`
- Email service keys (Resend/SendGrid)
- S3 credentials (if using AWS S3)
- `OPENAI_API_KEY` (optional)

**Build Commands:**

API:
```bash
pnpm install && pnpm --filter api build
```

Web:
```bash
pnpm install && pnpm --filter web build
```

**Start Commands:**

API:
```bash
pnpm --filter api start
```

Web:
```bash
pnpm --filter web start
```

### Vercel

**Deployment:**

Vercel is ideal for the Next.js frontend only.

**Configuration:**

1. Connect GitHub repository
2. Set root directory to `apps/web`
3. Add environment variables:
   - `DATABASE_URL`
   - `NEXTAUTH_URL` (your Vercel URL)
   - `NEXTAUTH_SECRET`
   - `NEXT_PUBLIC_API_URL` (your API URL)

**Backend:** Deploy API separately on Railway or another platform.

### Docker

**Build Images:**

```bash
# API
docker build -f apps/api/Dockerfile -t printing-workflow-api .

# Web
docker build -f apps/web/Dockerfile -t printing-workflow-web .
```

**Run with Docker Compose:**

```bash
docker-compose up -d
```

## Configuration Checklist

### Development Setup

- [ ] Copy `.env.example` to `.env`
- [ ] Install pnpm: `npm install -g pnpm@9.15.0`
- [ ] Install dependencies: `pnpm install`
- [ ] Start Docker services: `pnpm docker:up`
- [ ] Configure database URL in `.env`
- [ ] Generate Prisma client: `pnpm db:generate`
- [ ] Push schema: `pnpm db:push`
- [ ] Seed database: `pnpm db:seed`
- [ ] Generate secrets (NextAuth, API key, webhook)
- [ ] Test dev servers: `pnpm dev:all`

### Production Deployment

- [ ] Set up production database (PostgreSQL)
- [ ] Set up production Redis
- [ ] Configure S3 bucket (AWS/R2/equivalent)
- [ ] Set up email service (Resend or SendGrid)
- [ ] Generate production secrets (different from dev)
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS for API
- [ ] Set up monitoring/logging
- [ ] Test all critical features
- [ ] Set up backups for database

## Troubleshooting

### Database Connection Issues

**Error:** `Can't reach database server`

**Solution:**
```bash
# Check Docker is running
docker ps

# Restart Docker services
pnpm docker:reset

# Check connection string in .env
echo $DATABASE_URL
```

### Redis Connection Issues

**Error:** `Connection to Redis failed`

**Solution:**
```bash
# Check Redis is running
docker ps | grep redis

# Restart Redis
pnpm docker:up
```

### S3 Upload Failures

**Error:** `Failed to upload to S3`

**Solution:**
1. Check MinIO is running: `docker ps`
2. Verify bucket exists in MinIO console
3. Check credentials in `.env`
4. Verify bucket permissions

### Email Not Sending

**Error:** `Email send failed`

**Solution:**
1. Check API keys in `.env`
2. Verify sender domain is verified (Resend/SendGrid)
3. Check email logs: `apps/api` console output
4. Test with `EMAIL_REDIRECT_TO` to your address

### Port Already in Use

**Error:** `Port 3001 is already in use`

**Solution:**
```bash
# Find process
lsof -i :3001

# Kill it
kill -9 <PID>

# Or use cleanup script
pnpm clean
```

## Security Best Practices

1. **Never commit `.env`** - Already in `.gitignore`
2. **Use different secrets** for dev and production
3. **Rotate secrets** periodically
4. **Limit S3 permissions** to minimum required
5. **Use HTTPS** in production
6. **Enable CORS** properly for API
7. **Validate all inputs** server-side
8. **Keep dependencies updated** - run `pnpm update` regularly

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Fastify Documentation](https://fastify.dev)
- [BullMQ Documentation](https://docs.bullmq.io)
- [Resend Documentation](https://resend.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Vercel Documentation](https://vercel.com/docs)
