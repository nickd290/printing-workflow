# Printing Workflow - Project Context

## Project Overview
- **Name:** printing-workflow
- **Description:** Print shop workflow management system
- **Priority:** P1 (Active Development - client work)
- **Status:** Active Development

## Tech Stack
- **Framework:** Turborepo monorepo (apps/api + apps/web + packages/db)
- **Language:** TypeScript
- **Database:** PostgreSQL (Prisma ORM)
- **Styling:** TBD (check apps/web)
- **Package Manager:** pnpm
- **Containerization:** Docker Compose

## Deployment
- **Platform:** To be determined
- **Production URL:** Not deployed yet
- **Database Host:** Docker PostgreSQL (development)

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
