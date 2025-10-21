# Contributing to Printing Workflow

Thank you for contributing to the Printing Workflow project! This guide will help you get started with development.

## Table of Contents

- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Development Workflow](#development-workflow)
- [Monorepo Structure](#monorepo-structure)
- [Common Commands](#common-commands)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Database Operations](#database-operations)
- [Git Workflow](#git-workflow)
- [Troubleshooting](#troubleshooting)

## Project Overview

Printing Workflow is a full-stack print shop management system built as a Turborepo monorepo with:

- **apps/api** - Fastify backend with BullMQ workers (port 3001)
- **apps/web** - Next.js 15 + React 19 frontend (port 5175)
- **packages/db** - Shared Prisma database package
- **packages/shared** - Shared types, schemas, and utilities

**Tech Stack:** TypeScript, Fastify, Next.js 15, React 19, Prisma, PostgreSQL/SQLite, BullMQ, Redis, Tailwind CSS

## Prerequisites

Before you begin, ensure you have:

- **Node.js** ≥ 20.0.0
- **pnpm** 9.15.0 (install via: `npm install -g pnpm@9.15.0`)
- **Docker** and Docker Compose (for PostgreSQL and Redis)
- **Git** for version control

## Initial Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd printing-workflow
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure required variables (see [docs/CONFIGURATION.md](./docs/CONFIGURATION.md))

4. **Start services and initialize database:**
   ```bash
   pnpm setup
   ```
   This command:
   - Starts Docker containers (PostgreSQL + Redis)
   - Generates Prisma client
   - Pushes schema to database
   - Seeds initial data

5. **Start development servers:**
   ```bash
   pnpm dev:all
   ```
   This starts:
   - API server (http://localhost:3001)
   - Background workers
   - Web app (http://localhost:5175)

## Development Workflow

### Day-to-Day Development

1. **Start Docker services** (if not running):
   ```bash
   pnpm docker:up
   ```

2. **Start all dev servers**:
   ```bash
   pnpm dev:all
   ```
   Or start individual apps:
   ```bash
   # API only
   pnpm --filter api dev

   # Web only
   pnpm --filter web dev

   # Workers only
   pnpm dev:workers
   ```

3. **Check server status**:
   ```bash
   pnpm status
   # Or watch continuously
   pnpm status:watch
   ```

4. **Make your changes** following our [Architecture Patterns](./docs/ARCHITECTURE.md)

5. **Run tests**:
   ```bash
   pnpm test          # Unit tests
   pnpm test:e2e      # E2E tests with Playwright
   ```

6. **Lint and format**:
   ```bash
   pnpm lint          # Check all packages
   pnpm lint:fix      # Auto-fix issues
   pnpm format        # Format all files
   pnpm format:check  # Check formatting
   ```

7. **Build for production**:
   ```bash
   pnpm build
   ```

### Working with Feature Branches

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit frequently:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

3. Push to remote:
   ```bash
   git push -u origin feature/your-feature-name
   ```

## Monorepo Structure

```
printing-workflow/
├── apps/
│   ├── api/                    # Fastify backend
│   │   ├── src/
│   │   │   ├── routes/        # API route handlers
│   │   │   ├── services/      # Business logic
│   │   │   ├── workers/       # Background job workers
│   │   │   ├── middleware/    # Auth, validation, etc.
│   │   │   ├── lib/           # Utilities (email, S3, OpenAI)
│   │   │   └── index.ts       # Server entry point
│   │   └── package.json
│   │
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/           # App router pages
│       │   ├── components/    # React components
│       │   ├── contexts/      # React contexts
│       │   ├── lib/           # API client, utilities
│       │   └── styles/        # Global styles
│       └── package.json
│
├── packages/
│   ├── db/                     # Database package
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # Database schema
│   │   │   └── dev.db         # SQLite dev database
│   │   └── src/
│   │       ├── index.ts       # Prisma client export
│   │       ├── seed.ts        # Database seeding
│   │       └── import-csv.ts  # CSV import utilities
│   │
│   └── shared/                 # Shared utilities
│       └── src/
│           ├── types.ts       # TypeScript types
│           ├── schemas.ts     # Zod validation schemas
│           └── constants.ts   # Shared constants
│
├── scripts/                    # Development helper scripts
├── data/                       # Data files and imports
├── logs/                       # Application logs
├── uploads/                    # File uploads
└── docker-compose.yml          # Docker services
```

## Common Commands

### Root Level Commands

| Command | Description |
|---------|-------------|
| `pnpm setup` | Full setup: Docker up + DB generate + push + seed |
| `pnpm dev` | Start all apps via Turborepo |
| `pnpm dev:all` | Start API, workers, and web concurrently |
| `pnpm build` | Build all apps for production |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm lint:fix` | Auto-fix linting issues |
| `pnpm format` | Format all files with Prettier |
| `pnpm format:check` | Check formatting without changes |
| `pnpm status` | Check dev server status |
| `pnpm clean` | Clean up hanging processes on ports |

### Database Commands

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema changes (dev) |
| `pnpm db:migrate` | Create and run migrations (prod) |
| `pnpm db:seed` | Seed database with initial data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:reset` | Reset database and reseed |

### Docker Commands

| Command | Description |
|---------|-------------|
| `pnpm docker:up` | Start PostgreSQL + Redis |
| `pnpm docker:down` | Stop containers |
| `pnpm docker:reset` | Reset volumes and restart |

### Package-Specific Commands

Run commands in specific packages using `--filter`:

```bash
# API commands
pnpm --filter api dev
pnpm --filter api test
pnpm --filter api build

# Web commands
pnpm --filter web dev
pnpm --filter web lint
pnpm --filter web build
```

## Code Standards

### TypeScript

- Use TypeScript strict mode
- Define explicit types for function parameters and return values
- Avoid `any` - use `unknown` with type guards if needed
- Prefer interfaces for object shapes
- Use Zod schemas for runtime validation

### Code Style

We use **ESLint** and **Prettier** to enforce consistent code style:

- **Indentation:** 2 spaces
- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Line length:** 100 characters max
- **Trailing commas:** ES5 style

Run `pnpm lint:fix` and `pnpm format` before committing.

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files - Routes | `*.route.ts` | `jobs.route.ts` |
| Files - Services | `*.service.ts` | `job.service.ts` |
| Files - Workers | `*.worker.ts` | `email.worker.ts` |
| Components | PascalCase | `JobsTable.tsx` |
| Functions | camelCase | `getUserById()` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Types/Interfaces | PascalCase | `User`, `JobStatus` |

### Code Organization

- **Backend:** Route → Service → Database
- **Frontend:** Page → Component → API Client
- **Shared Logic:** Extract to `packages/shared`
- **Utilities:** Group by domain in `lib/`

### Error Handling

- Use try-catch blocks in async functions
- Return proper HTTP status codes (API)
- Log errors with context using Pino
- Show user-friendly error messages (frontend)

## Testing

### Unit Tests

We use **Vitest** for unit testing:

```bash
# Run all tests
pnpm test

# Run tests in watch mode (API)
pnpm --filter api test:watch

# Run tests in watch mode (shared)
pnpm --filter shared test:watch
```

### E2E Tests

We use **Playwright** for end-to-end testing:

```bash
# Run E2E tests
pnpm test:e2e

# Run E2E tests in UI mode
pnpm --filter web test:e2e --ui
```

### Test Guidelines

- Write tests for critical business logic
- Test database operations with sample data
- Mock external API calls
- Aim for >80% coverage on critical paths

## Database Operations

### Schema Changes

1. **Modify the schema:**
   Edit `packages/db/prisma/schema.prisma`

2. **Generate Prisma client:**
   ```bash
   pnpm db:generate
   ```

3. **Push changes (development):**
   ```bash
   pnpm db:push
   ```

4. **Create migration (production):**
   ```bash
   pnpm db:migrate
   ```

### Seeding Data

Add seed data in `packages/db/src/seed.ts`, then run:

```bash
pnpm db:seed
```

### Accessing the Database

- **Prisma Studio:** `pnpm db:studio` (GUI)
- **Direct SQLite:** `sqlite3 packages/db/prisma/dev.db`
- **Direct PostgreSQL:** Use connection string from `.env`

## Git Workflow

### Commit Message Format

Use conventional commits:

```
<type>(<scope>): <description>

[optional body]
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

**Examples:**
```bash
git commit -m "feat(api): add job creation endpoint"
git commit -m "fix(web): resolve authentication redirect issue"
git commit -m "docs: update contributing guide"
```

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates

### Pull Requests

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Push and create a PR
5. Request review from team members
6. Address feedback
7. Merge when approved

## Troubleshooting

### Port Already in Use

If ports 3001 or 5175 are in use:

```bash
pnpm clean        # Kill processes on known ports
pnpm clean:all    # Force kill all related processes
```

Or manually:

```bash
lsof -i :3001     # Find process
kill -9 <PID>     # Kill it
```

### Prisma Client Out of Sync

```bash
pnpm db:generate
```

### Database Issues

Reset the database:

```bash
pnpm db:reset
```

### Docker Issues

Reset Docker containers:

```bash
pnpm docker:reset
```

### Node Modules Issues

```bash
rm -rf node_modules
pnpm install
```

### Build Failures

Clear Turbo cache:

```bash
rm -rf .turbo
pnpm build
```

### Worker Issues

If background workers aren't processing jobs:

1. Check Redis is running: `docker ps`
2. Check worker logs in console
3. Restart workers: Stop `dev:all` and restart

## Getting Help

- **Architecture questions:** See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Configuration questions:** See [docs/CONFIGURATION.md](./docs/CONFIGURATION.md)
- **Quick reference:** See [docs/QUICK_START.md](./docs/QUICK_START.md)
- **Project issues:** Check existing issues or create a new one

## License

This project is private and proprietary.
