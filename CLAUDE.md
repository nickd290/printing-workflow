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
- **Containerization:** Docker Compose (for local PostgreSQL)

## Deployment
- **Platform:** Railway
- **Railway Project:** nurturing-eagerness
- **Production Web URL:** https://web-production-851ca.up.railway.app
- **Production API URL:** https://api-production-100d.up.railway.app
- **API Health Check:** https://api-production-100d.up.railway.app/health
- **Database:** Railway PostgreSQL (internal: postgres.railway.internal:5432)
- **Status:** Live and healthy (last updated: Nov 6, 2025)
- **Local Database:** Docker PostgreSQL (localhost:5432)

## Database
- **Type:** PostgreSQL
- **Connection:** DATABASE_URL (in .env)
- **Schema:** `packages/db/prisma/schema.prisma`
- **Migrations:** `pnpm db:migrate` (production), `pnpm db:push` (dev)
- **Seed:** `pnpm db:seed`
- **Studio:** `pnpm db:studio`

## Environment Variables
Check individual apps for required variables

## Development
- **Setup:** `pnpm setup` (starts Docker + generates + pushes + seeds DB)
- **Dev All:** `pnpm dev:all` (runs API, workers, and web concurrently)
- **Dev (Turbo):** `pnpm dev` (uses Turborepo)
- **Build:** `pnpm build` (Turborepo builds all apps)
- **Test:** `pnpm test` (runs API and web tests)
- **E2E Tests:** `pnpm test:e2e` (Playwright)
- **Docker Up:** `pnpm docker:up`
- **Docker Down:** `pnpm docker:down`

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
- **Database:** Run `pnpm docker:up` before dev to start PostgreSQL
- **Monorepo:** Changes to packages/db require `pnpm db:generate` in root
- **Workers:** Background workers run separately via `pnpm dev:workers`
- **Testing:** Run E2E tests with `pnpm test:e2e`
- **Reset DB:** `pnpm db:reset` to force reset and reseed

## Related Projects
- **Shares code with:** None (monorepo contains all code)
- **Similar to:** None
- **Depends on:** Docker for PostgreSQL
