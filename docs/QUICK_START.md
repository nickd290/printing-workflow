# Quick Start Guide

Get up and running with Printing Workflow in under 5 minutes.

## TL;DR

```bash
# 1. Install dependencies
npm install -g pnpm@9.15.0
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env and add your secrets

# 3. Setup (starts Docker + DB)
pnpm setup

# 4. Start everything
pnpm dev:all
```

**Access:**
- Frontend: http://localhost:5175
- API: http://localhost:3001

## Minimal Setup (No Docker)

If you don't want to use Docker, you can run with SQLite only:

```bash
# 1. Install
npm install -g pnpm@9.15.0
pnpm install

# 2. Configure for SQLite
cp .env.example .env

# Edit .env:
DATABASE_URL="file:./packages/db/prisma/dev.db"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
API_SECRET_KEY="$(openssl rand -base64 32)"

# 3. Setup database
pnpm db:generate
pnpm db:push
pnpm db:seed

# 4. Start (without workers)
pnpm dev
```

**Note:** Workers (email, PDF processing) won't run without Redis.

## Full Setup (With Docker)

For complete feature set including background workers:

```bash
# 1. Prerequisites
# Install Node.js ≥20, pnpm, and Docker

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env

# Edit .env with these required values:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/printing_workflow?schema=public"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
API_SECRET_KEY="<generate with: openssl rand -base64 32>"
NEXT_PUBLIC_API_URL="http://localhost:3001"

# 4. Start Docker services
pnpm docker:up

# 5. Initialize database
pnpm db:generate
pnpm db:push
pnpm db:seed

# 6. Start all services
pnpm dev:all
```

## Common Commands Cheatsheet

### Daily Development

```bash
# Start everything (API + Workers + Web)
pnpm dev:all

# Start individual services
pnpm --filter api dev     # API only
pnpm --filter web dev     # Web only
pnpm dev:workers          # Workers only

# Check server status
pnpm status
pnpm status:watch         # Continuous monitoring
```

### Database Operations

```bash
pnpm db:generate    # Generate Prisma client
pnpm db:push        # Push schema changes
pnpm db:seed        # Seed data
pnpm db:studio      # Open Prisma Studio GUI
pnpm db:reset       # Reset and reseed
```

### Code Quality

```bash
pnpm lint           # Check all packages
pnpm lint:fix       # Auto-fix issues
pnpm format         # Format with Prettier
pnpm test           # Run unit tests
pnpm test:e2e       # Run E2E tests
pnpm build          # Build for production
```

### Docker

```bash
pnpm docker:up      # Start PostgreSQL + Redis
pnpm docker:down    # Stop containers
pnpm docker:reset   # Reset volumes and restart
```

### Cleanup

```bash
pnpm clean          # Kill processes on known ports
pnpm clean:all      # Force kill all related processes
```

## Project Structure

```
printing-workflow/
├── apps/
│   ├── api/          # Backend (localhost:3001)
│   └── web/          # Frontend (localhost:5175)
├── packages/
│   ├── db/           # Prisma database
│   └── shared/       # Shared types/schemas
├── .env              # Your config (create from .env.example)
└── docker-compose.yml
```

## Environment Variables Quick Reference

**Required (Minimal):**

```bash
DATABASE_URL="file:./packages/db/prisma/dev.db"
NEXTAUTH_URL="http://localhost:5175"
NEXTAUTH_SECRET="<generate-secret>"
NEXT_PUBLIC_API_URL="http://localhost:3001"
API_SECRET_KEY="<generate-secret>"
NODE_ENV="development"
```

**Full Setup (With Docker):**

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/printing_workflow?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# S3 (MinIO local)
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET="printing-files"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"

# Auth
NEXTAUTH_URL="http://localhost:5175"
NEXTAUTH_SECRET="<generate>"
API_SECRET_KEY="<generate>"

# API
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Optional: Email
RESEND_API_KEY="<your-key>"
EMAIL_FROM="noreply@yourdomain.com"

# Optional: AI
OPENAI_API_KEY="<your-key>"

# Environment
NODE_ENV="development"
```

## Common Workflows

### Adding a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes (follow patterns in docs/ARCHITECTURE.md)

# 3. Test
pnpm lint
pnpm test
pnpm build

# 4. Commit
git add .
git commit -m "feat: add my feature"

# 5. Push
git push -u origin feature/my-feature
```

### Database Schema Changes

```bash
# 1. Edit schema
nano packages/db/prisma/schema.prisma

# 2. Regenerate client
pnpm db:generate

# 3. Push to DB
pnpm db:push

# 4. Restart dev servers
# Ctrl+C and run pnpm dev:all again
```

### Adding a New API Endpoint

1. Create route file: `apps/api/src/routes/your-feature.route.ts`
2. Create service: `apps/api/src/services/your-feature.service.ts`
3. Register route in `apps/api/src/index.ts`
4. Test with curl or Postman

### Adding a New Page

1. Create page: `apps/web/src/app/your-page/page.tsx`
2. Create components if needed: `apps/web/src/components/YourComponent.tsx`
3. Add navigation link to layout
4. Test in browser

## Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Port in use | `pnpm clean` |
| Prisma out of sync | `pnpm db:generate` |
| Database issues | `pnpm db:reset` |
| Docker issues | `pnpm docker:reset` |
| Build failures | `rm -rf .turbo && pnpm build` |
| Lint errors | `pnpm lint:fix && pnpm format` |

## Port Reference

| Service | Port | URL |
|---------|------|-----|
| Web App | 5175 | http://localhost:5175 |
| API | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| MinIO Storage | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | http://localhost:9001 |

## Testing the Setup

After starting services, verify everything works:

**1. Check API:**
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok"}
```

**2. Check Database:**
```bash
pnpm db:studio
# Opens Prisma Studio in browser
```

**3. Check Web App:**

Open http://localhost:5175 in browser

**4. Check Workers (if using Redis):**

Look for console output:
```
[worker] Email worker started
[worker] PDF worker started
```

## Next Steps

- Read [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed development workflow
- Review [docs/ARCHITECTURE.md](./ARCHITECTURE.md) for code patterns
- Check [docs/CONFIGURATION.md](./CONFIGURATION.md) for environment setup

## Getting Help

**Common Issues:**
- Port conflicts: `lsof -i :3001` then `kill -9 <PID>`
- Database locked: `pnpm docker:reset`
- Module not found: `pnpm install`

**Documentation:**
- Architecture patterns: [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- Configuration guide: [docs/CONFIGURATION.md](./CONFIGURATION.md)
- Contributing guide: [CONTRIBUTING.md](../CONTRIBUTING.md)

## Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Fastify Docs](https://fastify.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
