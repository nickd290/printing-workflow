# Printing Workflow - Project Context

## Quick Start for New Session

To work on this project in a new chat, simply say:

```
"I want to work on printing-workflow on localhost"
```

Then provide your specific task or instructions.

## Project Overview
- **Name:** printing-workflow
- **Description:** Print shop workflow management system for managing jobs, purchase orders, quotes, proofs, and invoicing
- **Priority:** P1 (Active Development - client work)
- **Status:** Active Development
- **What it does:**
  - Manages print shop jobs and workflows
  - Purchase order tracking and management
  - Quote generation and approval
  - Proof generation and customer approval workflow
  - Invoice creation and tracking
  - Customer and company management
  - Revenue metrics and reporting

## Tech Stack
- **Framework:** Turborepo monorepo (apps/api + apps/web + packages/db)
- **Backend:** Fastify API server with TypeScript
- **Frontend:** Next.js 15 with TypeScript
- **Database:** PostgreSQL (Prisma ORM v6.17.1)
- **Styling:** Tailwind CSS
- **Package Manager:** pnpm (REQUIRED - do not use npm/yarn)
- **Containerization:** N/A (using Homebrew PostgreSQL)

## Deployment
- **Platform:** Railway
- **Railway Project:** nurturing-eagerness
- **Production Web URL:** https://web-production-851ca.up.railway.app
- **Production API URL:** https://api-production-100d.up.railway.app
- **API Health Check:** https://api-production-100d.up.railway.app/health
- **Database:** Railway PostgreSQL (internal: postgres.railway.internal:5432)
- **Status:** Live and healthy (last updated: Nov 17, 2025)
- **Local Database:** Homebrew PostgreSQL@16 (localhost:5432/printing_workflow)

## Database
- **Type:** PostgreSQL 16 (installed via Homebrew)
- **Connection:** DATABASE_URL="postgresql://nicholasdeblasio@localhost:5432/printing_workflow"
- **Schema:** `packages/db/prisma/schema.prisma`
- **Data Source:** Production data migrated from Railway (23 jobs, 18 invoices, 22 POs)
- **Service:** `brew services start postgresql@16` (auto-starts on boot)
- **Studio:** `pnpm db:studio` (Prisma Studio for database GUI)
- **Commands:**
  - `pnpm db:generate` - Regenerate Prisma client
  - `pnpm db:push` - Push schema changes to database (dev only)
  - `pnpm db:studio` - Open Prisma Studio
- **Important:** Local database contains PRODUCTION DATA - be careful with modifications!

## Environment Variables
Check individual apps for required variables

## Development
- **Prerequisites:** PostgreSQL 16 must be running (`brew services start postgresql@16`)
- **Setup:** `pnpm install && pnpm db:generate` (install deps + generate Prisma client)
- **Dev All:** `pnpm dev:all` (runs API, workers, and web concurrently)
- **Dev (Turbo):** `pnpm dev` (uses Turborepo)
- **Build:** `pnpm build` (Turborepo builds all apps)
- **Test:** `pnpm test` (runs API and web tests)
- **E2E Tests:** `pnpm test:e2e` (Playwright)
- **Important:** PostgreSQL must be running before starting dev servers

## Project Structure
```
printing-workflow/
├── apps/
│   ├── api/          # Backend API server
│   └── web/          # Frontend web app
├── packages/
│   └── db/           # Shared Prisma database package
└── docker-compose.yml
```

## Key Features
- Monorepo architecture with shared database package
- Background workers (apps/api/src/workers/)
- Docker Compose for local development
- Turborepo for optimized builds
- E2E testing with Playwright

## Specific Instructions
- **Package Manager:** MUST use pnpm (not npm/yarn)
- **Database:** PostgreSQL 16 must be running (`brew services start postgresql@16`)
- **Monorepo:** Changes to packages/db require `pnpm db:generate` in root
- **Workers:** Background workers run separately via `pnpm dev:workers`
- **Testing:** Run E2E tests with `pnpm test:e2e`
- **Important:** Do NOT run `pnpm db:reset` or `pnpm db:seed` - database has production data!
- **Data Safety:** Local database contains real production data migrated from Railway

## Related Projects
- **Shares code with:** None (monorepo contains all code)
- **Similar to:** None
- **Depends on:** Homebrew PostgreSQL 16
