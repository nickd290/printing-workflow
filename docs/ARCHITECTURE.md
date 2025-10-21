# Architecture Documentation

This document describes the architecture patterns, conventions, and best practices used in the Printing Workflow application.

## Table of Contents

- [Overview](#overview)
- [Monorepo Structure](#monorepo-structure)
- [Backend Architecture (Fastify API)](#backend-architecture-fastify-api)
- [Frontend Architecture (Next.js)](#frontend-architecture-nextjs)
- [Shared Packages](#shared-packages)
- [Database Patterns](#database-patterns)
- [Background Jobs & Workers](#background-jobs--workers)
- [Authentication & Authorization](#authentication--authorization)
- [File Handling](#file-handling)
- [Error Handling](#error-handling)
- [Naming Conventions](#naming-conventions)

## Overview

Printing Workflow is a full-stack TypeScript application built as a Turborepo monorepo with:

- **Backend:** Fastify REST API with BullMQ workers
- **Frontend:** Next.js 15 with React 19 and Tailwind CSS
- **Database:** Prisma ORM with PostgreSQL (production) or SQLite (development)
- **Queue:** BullMQ with Redis for background job processing
- **Storage:** AWS S3-compatible storage for file uploads

## Monorepo Structure

```
printing-workflow/
├── apps/
│   ├── api/          # Fastify backend (port 3001)
│   └── web/          # Next.js frontend (port 5175)
├── packages/
│   ├── db/           # Shared Prisma client and database utilities
│   └── shared/       # Shared types, schemas, and constants
└── scripts/          # Development and deployment scripts
```

**Workspace Dependencies:**

- Both apps import from packages using workspace aliases:
  - `@printing-workflow/db`
  - `@printing-workflow/shared`

**Build Tool:** Turborepo orchestrates builds, tests, and linting with caching for faster rebuilds.

## Backend Architecture (Fastify API)

**Location:** `apps/api/`

### Directory Structure

```
apps/api/src/
├── routes/           # API route handlers
│   ├── jobs.route.ts
│   ├── invoices.route.ts
│   └── ...
├── services/         # Business logic layer
│   ├── job.service.ts
│   ├── invoice.service.ts
│   └── ...
├── workers/          # Background job workers
│   ├── email.worker.ts
│   ├── pdf.worker.ts
│   └── index.ts
├── middleware/       # Request middleware
│   ├── auth.ts
│   ├── validate.ts
│   └── webhook.ts
├── lib/              # Utilities and helpers
│   ├── email.ts
│   ├── s3.ts
│   ├── openai.ts
│   └── queue.ts
├── types/            # TypeScript type definitions
└── index.ts          # Server entry point
```

### Core Patterns

#### 1. Route → Service → Database Flow

**Pattern:** Routes handle HTTP, services contain business logic, database is accessed via Prisma.

**Example:**

```typescript
// routes/jobs.route.ts
import { FastifyPluginAsync } from 'fastify';
import { jobService } from '../services/job.service';

export const jobsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/jobs', async (request, reply) => {
    try {
      const jobs = await jobService.getAllJobs();
      return reply.send(jobs);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};
```

```typescript
// services/job.service.ts
import { prisma } from '@printing-workflow/db';

export const jobService = {
  async getAllJobs() {
    return await prisma.job.findMany({
      include: {
        customer: true,
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};
```

#### 2. Route Registration

All routes are registered in `src/index.ts`:

```typescript
// index.ts
import { jobsRoute } from './routes/jobs.route';
import { invoicesRoute } from './routes/invoices.route';

await fastify.register(jobsRoute);
await fastify.register(invoicesRoute);
```

#### 3. Middleware Pattern

Middleware is applied using Fastify's `addHook` or as route-specific preHandlers:

```typescript
// middleware/auth.ts
export const authenticateRequest = async (request, reply) => {
  const apiKey = request.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
};

// Usage in route:
fastify.get('/api/protected', {
  preHandler: [authenticateRequest],
  handler: async (request, reply) => {
    // ... handler logic
  },
});
```

#### 4. Validation with Zod

Request validation uses Zod schemas from `@printing-workflow/shared`:

```typescript
import { createJobSchema } from '@printing-workflow/shared/schemas';
import { validate } from '../middleware/validate';

fastify.post('/api/jobs', {
  preHandler: [validate(createJobSchema)],
  handler: async (request, reply) => {
    const jobData = request.body; // Typed and validated
    // ...
  },
});
```

#### 5. Error Handling

- Use try-catch blocks in route handlers
- Log errors with Pino logger
- Return appropriate HTTP status codes
- Never expose internal error details to clients

```typescript
try {
  const result = await someOperation();
  return reply.send(result);
} catch (error) {
  fastify.log.error({ error, context: 'operation-name' }, 'Operation failed');
  return reply.status(500).send({ error: 'Internal server error' });
}
```

### API Conventions

- **Base URL:** `/api/*`
- **HTTP Methods:** Use REST conventions (GET, POST, PUT, DELETE)
- **Response Format:** JSON
- **Status Codes:**
  - 200: Success
  - 201: Created
  - 400: Bad request (validation errors)
  - 401: Unauthorized
  - 404: Not found
  - 500: Internal server error

## Frontend Architecture (Next.js)

**Location:** `apps/web/`

### Directory Structure

```
apps/web/src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── dashboard/         # Dashboard pages
│   │   ├── page.tsx
│   │   └── jobs/
│   └── ...
├── components/             # React components
│   ├── ui/                # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Badge.tsx
│   ├── JobsTable.tsx      # Feature components
│   ├── JobDetailModal.tsx
│   └── ...
├── contexts/               # React contexts
│   └── UserContext.tsx
├── lib/                    # Utilities
│   ├── api-client.ts      # API client wrapper
│   └── utils.ts
└── styles/                 # Global styles
    └── globals.css
```

### Core Patterns

#### 1. App Router Structure

Using Next.js 15 App Router with:
- File-based routing in `app/`
- Server components by default
- Client components marked with `'use client'`

**Example Page:**

```typescript
// app/dashboard/jobs/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { JobsTable } from '@/components/JobsTable';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    apiClient.jobs.getAll().then(setJobs);
  }, []);

  return (
    <div>
      <h1>Jobs</h1>
      <JobsTable jobs={jobs} />
    </div>
  );
}
```

#### 2. Component Organization

**UI Components** (`components/ui/`):
- Reusable, generic components
- Accept props for customization
- No business logic

**Feature Components** (`components/`):
- Domain-specific components
- May contain business logic
- Can use contexts and API client

**Naming:**
- PascalCase for component files: `JobsTable.tsx`
- Use descriptive names: `CreateJobForm.tsx` not `Form.tsx`

#### 3. API Client Pattern

Centralized API client in `lib/api-client.ts`:

```typescript
class APIClient {
  private baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`);
    if (!response.ok) throw new APIError(response);
    return response.json();
  }

  jobs = {
    getAll: () => this.get<Job[]>('/api/jobs'),
    getById: (id: string) => this.get<Job>(`/api/jobs/${id}`),
    create: (data: CreateJobInput) => this.post<Job>('/api/jobs', data),
  };
}

export const apiClient = new APIClient();
```

**Usage:**

```typescript
import { apiClient } from '@/lib/api-client';

const jobs = await apiClient.jobs.getAll();
```

#### 4. State Management with Context

Global state uses React Context:

```typescript
// contexts/UserContext.tsx
'use client';

import { createContext, useContext, useState } from 'react';

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};
```

**Usage:**

```typescript
'use client';

import { useUser } from '@/contexts/UserContext';

export function Header() {
  const { user } = useUser();
  return <div>Welcome, {user?.name}</div>;
}
```

#### 5. Styling with Tailwind CSS

- Use Tailwind utility classes
- Define custom colors/themes in `tailwind.config.js`
- Global styles in `styles/globals.css`

```typescript
export function Button({ children }) {
  return (
    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
      {children}
    </button>
  );
}
```

### Frontend Conventions

- **Client Components:** Mark with `'use client'` at top of file
- **Server Components:** Default, no directive needed
- **Data Fetching:** Use API client in `useEffect` for client components
- **Forms:** Validate with Zod schemas before submitting
- **Errors:** Show user-friendly toast notifications (react-hot-toast)

## Shared Packages

### packages/db

**Purpose:** Shared Prisma client and database utilities

**Exports:**

```typescript
// packages/db/src/index.ts
export { prisma } from './client';
export * from '@prisma/client';
```

**Usage:**

```typescript
import { prisma, Job, User } from '@printing-workflow/db';

const users = await prisma.user.findMany();
```

### packages/shared

**Purpose:** Shared types, schemas, and constants

**Exports:**

```typescript
// packages/shared/src/index.ts
export * from './types';
export * from './schemas';
export * from './constants';
```

**Example - Zod Schemas:**

```typescript
// packages/shared/src/schemas.ts
import { z } from 'zod';

export const createJobSchema = z.object({
  jobNo: z.string().min(1),
  customerPONumber: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
```

**Usage:**

```typescript
import { createJobSchema } from '@printing-workflow/shared/schemas';

const result = createJobSchema.parse(requestBody);
```

## Database Patterns

**ORM:** Prisma

**Schema Location:** `packages/db/prisma/schema.prisma`

### Naming Conventions

- **Models:** PascalCase singular (e.g., `User`, `Job`, `Invoice`)
- **Fields:** camelCase (e.g., `jobNo`, `customerPONumber`)
- **Relations:** Descriptive names (e.g., `customer`, `invoice`)
- **Enums:** PascalCase (e.g., `Role`, `JobStatus`)

### Common Patterns

**1. Relations:**

```prisma
model Job {
  id                String   @id @default(cuid())
  jobNo             String   @unique
  customerId        String
  customer          Company  @relation("JobCustomer", fields: [customerId], references: [id])
  invoice           Invoice?
}

model Company {
  id                String   @id @default(cuid())
  name              String
  jobs              Job[]    @relation("JobCustomer")
}
```

**2. Timestamps:**

```prisma
model Job {
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**3. Enums:**

```prisma
enum Role {
  CUSTOMER
  BROKER_ADMIN
  BRADFORD_ADMIN
  MANAGER
}
```

### Query Patterns

**Include Relations:**

```typescript
const job = await prisma.job.findUnique({
  where: { id },
  include: {
    customer: true,
    invoice: true,
  },
});
```

**Filtering and Sorting:**

```typescript
const jobs = await prisma.job.findMany({
  where: {
    status: 'COMPLETED',
    customerId: companyId,
  },
  orderBy: { createdAt: 'desc' },
  take: 10,
});
```

## Background Jobs & Workers

**Location:** `apps/api/src/workers/`

**Queue System:** BullMQ with Redis

### Worker Pattern

**1. Define Job Type:**

```typescript
// workers/email.worker.ts
export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
}
```

**2. Create Worker:**

```typescript
import { Worker } from 'bullmq';
import { sendEmail } from '../lib/email';

export const emailWorker = new Worker(
  'email-queue',
  async (job) => {
    const { to, subject, body } = job.data as EmailJobData;
    await sendEmail({ to, subject, body });
  },
  { connection: redisConnection }
);
```

**3. Add Job to Queue:**

```typescript
import { emailQueue } from '../lib/queue';

await emailQueue.add('send-email', {
  to: 'user@example.com',
  subject: 'Job Complete',
  body: 'Your job is ready',
});
```

### Worker Types

- **email.worker.ts** - Email sending (Resend/SendGrid)
- **pdf.worker.ts** - PDF generation and processing
- **purchase-order.worker.ts** - Purchase order processing

## Authentication & Authorization

**Frontend:** NextAuth 5.0 (beta) with Prisma adapter

**Backend:** API key authentication (X-API-Key header)

### NextAuth Setup

**Provider:** Credentials provider with database verification

**Session:** Database sessions stored in Prisma

**Usage:**

```typescript
import { auth } from '@/lib/auth';

export default async function ProtectedPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return <div>Protected content</div>;
}
```

### API Authentication

```typescript
// middleware/auth.ts
export const authenticateRequest = async (request, reply) => {
  const apiKey = request.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
};
```

## File Handling

**Storage:** AWS S3 (production) or S3-compatible (MinIO for dev)

**Upload:** Fastify multipart with limits (10MB per file, 5 files max)

### Upload Pattern

**Backend:**

```typescript
import { uploadToS3 } from '../lib/s3';

fastify.post('/api/upload', async (request, reply) => {
  const data = await request.file();
  const buffer = await data.toBuffer();

  const url = await uploadToS3({
    key: `uploads/${Date.now()}-${data.filename}`,
    body: buffer,
    contentType: data.mimetype,
  });

  return reply.send({ url });
});
```

**Frontend:**

```typescript
import { useDropzone } from 'react-dropzone';

const { getRootProps, getInputProps } = useDropzone({
  onDrop: async (files) => {
    const formData = new FormData();
    formData.append('file', files[0]);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const { url } = await response.json();
  },
});
```

## Error Handling

### Backend Error Handling

**1. Try-Catch in Routes:**

```typescript
try {
  const result = await service.doSomething();
  return reply.send(result);
} catch (error) {
  fastify.log.error(error);
  return reply.status(500).send({ error: 'Internal server error' });
}
```

**2. Custom Error Classes:**

```typescript
class NotFoundError extends Error {
  statusCode = 404;
}

class ValidationError extends Error {
  statusCode = 400;
}
```

**3. Error Logging:**

Use Pino logger with context:

```typescript
fastify.log.error({
  error,
  userId: request.user?.id,
  endpoint: request.url,
}, 'Error processing request');
```

### Frontend Error Handling

**1. API Client Error Class:**

```typescript
class APIError extends Error {
  constructor(public response: Response) {
    super(`API Error: ${response.status}`);
  }
}
```

**2. User-Friendly Messages:**

```typescript
import toast from 'react-hot-toast';

try {
  await apiClient.jobs.create(data);
  toast.success('Job created successfully');
} catch (error) {
  toast.error('Failed to create job. Please try again.');
}
```

## Naming Conventions

### Files

| Type | Pattern | Example |
|------|---------|---------|
| Route | `*.route.ts` | `jobs.route.ts` |
| Service | `*.service.ts` | `job.service.ts` |
| Worker | `*.worker.ts` | `email.worker.ts` |
| Component | `PascalCase.tsx` | `JobsTable.tsx` |
| Page | `page.tsx` | `app/jobs/page.tsx` |
| Layout | `layout.tsx` | `app/layout.tsx` |
| Utility | `camelCase.ts` | `apiClient.ts` |

### Code

| Element | Convention | Example |
|---------|------------|---------|
| Variables | camelCase | `jobData`, `userId` |
| Functions | camelCase | `createJob()`, `sendEmail()` |
| Classes | PascalCase | `APIClient`, `JobService` |
| Components | PascalCase | `JobsTable`, `Button` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `API_URL` |
| Types/Interfaces | PascalCase | `User`, `CreateJobInput` |
| Enums | PascalCase | `Role`, `JobStatus` |

### Database

| Element | Convention | Example |
|---------|------------|---------|
| Models | PascalCase singular | `User`, `Job` |
| Fields | camelCase | `jobNo`, `createdAt` |
| Relations | Descriptive | `customer`, `jobs` |

## Best Practices

1. **Separation of Concerns:**
   - Keep routes thin, move logic to services
   - Keep components focused on presentation
   - Extract reusable logic to utilities

2. **Type Safety:**
   - Define explicit types for all data structures
   - Use Zod for runtime validation
   - Avoid `any` type

3. **Error Handling:**
   - Always handle errors gracefully
   - Log errors with context
   - Show user-friendly messages

4. **Performance:**
   - Use database indexes on frequently queried fields
   - Implement pagination for large datasets
   - Cache expensive computations

5. **Security:**
   - Validate all user inputs
   - Use environment variables for secrets
   - Implement proper authentication/authorization
   - Sanitize data before storing

6. **Code Quality:**
   - Run linting before commits
   - Write tests for critical paths
   - Document complex logic with comments
   - Keep functions small and focused
