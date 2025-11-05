# Printing Workflow - Session Summary

**Last Updated**: 2025-10-30
**Project**: Printing Workflow Management System
**Status**: Active Development (Phase 2 in progress)

---

## 🚀 Quick Start

### Start Development Servers
```bash
# Terminal 1 - API Server
cd /Users/nicholasdeblasio/printing-workflow
cd apps/api && npx pnpm dev
# Runs on: http://localhost:3001

# Terminal 2 - Web App
cd /Users/nicholasdeblasio/printing-workflow
cd apps/web && npx pnpm dev
# Runs on: http://localhost:5175
```

### Access the App
- **Web Interface**: http://localhost:5175
- **API Endpoint**: http://localhost:3001
- **Database**: SQLite at `/packages/db/prisma/dev.db`

---

## 📋 Project Overview

### Purpose
B2B printing workflow management system connecting:
- **Customers** (e.g., JJSA, Ballantine) - Submit orders, approve proofs, track jobs
- **Broker (Impact Direct)** - Manage orders, create quotes, coordinate production
- **Printer (Bradford)** - Execute production, manage inventory

### Tech Stack
- **Framework**: Next.js 15.5.5 (React, TypeScript)
- **Monorepo**: Turborepo
- **Database**: Prisma ORM + SQLite (dev) / PostgreSQL (production)
- **Styling**: Tailwind CSS
- **Package Manager**: pnpm
- **API**: Express.js (Node.js)

### Architecture
```
printing-workflow/
├── apps/
│   ├── api/          # Backend API (Express, port 3001)
│   └── web/          # Frontend (Next.js, port 5175)
├── packages/
│   └── db/           # Shared Prisma database
└── docker-compose.yml
```

---

## 🎯 Session Accomplishments

### ✅ PHASE 1: Critical Visibility Improvements

#### 1. Late Job Warnings & Delivery Countdown
**Component**: `DeliveryUrgencyBadge.tsx`
- Created color-coded urgency badges:
  - 🔴 **RED (Late)**: Overdue jobs
  - 🔴 **RED (Urgent)**: 0-2 days remaining
  - 🟡 **YELLOW (Warning)**: 3-7 days remaining
  - 🟢 **GREEN (Normal)**: 8+ days remaining
- Auto-sorts customer jobs by urgency (late first)
- Added helper function `getDeliveryUrgency()` for sorting

**Files Created**:
- `/apps/web/src/components/jobs/DeliveryUrgencyBadge.tsx`

**Files Modified**:
- `/apps/web/src/app/dashboard/page.tsx` - Added urgency sorting and badges

#### 2. Customer PO File Viewer
**Component**: `POViewer.tsx`
- Displays customer purchase order files with metadata
- Download functionality for PO PDFs
- Shows upload date and file details
- Collapsible UI design

**Files Created**:
- `/apps/web/src/components/jobs/POViewer.tsx`

**Files Modified**:
- `/apps/web/src/components/JobDetailModal.tsx` - Integrated PO viewer

#### 3. File Upload Clarity
**Enhanced Component**: `FileChecklist.tsx`
- Added **explicit requirements banner** at top:
  - "You need X files: N artwork files, N data files"
  - Clear file type descriptions (PDF/AI/EPS for artwork, CSV/XLSX for data)
  - Progress counter showing "X of Y files uploaded"
- Better visual hierarchy and messaging

**Files Modified**:
- `/apps/web/src/components/jobs/FileChecklist.tsx`

---

### ✅ PHASE 2: Sample Shipment Tracking (Partial)

#### 1. Sample Shipment Card
**Component**: `SampleShipmentCard.tsx`
- Displays sample shipments with tracking information
- **Carrier tracking links** for UPS, FedEx, USPS, DHL
- Recipient details (name, email, address)
- "Request Sample" button for customers
- Status badges (Sent vs Pending)

**Files Created**:
- `/apps/web/src/components/jobs/SampleShipmentCard.tsx`

**Files Modified**:
- `/apps/web/src/components/JobDetailModal.tsx` - Added "Samples" tab for customers

#### 2. Database Models Used
```prisma
model SampleShipment {
  id               String   @id @default(cuid())
  jobId            String
  description      String
  carrier          String   // UPS, FedEx, USPS, DHL
  trackingNo       String?
  recipientName    String
  recipientEmail   String
  recipientAddress String?
  sentAt           DateTime?
  createdAt        DateTime @default(now())
  job              Job      @relation(fields: [jobId], references: [id])
}
```

---

### ✅ UI/UX VISUAL ENHANCEMENTS

#### 1. Stats Dashboard Bar
**Component**: `JobStatsBar.tsx`
- Beautiful gradient stat cards showing:
  - **Late Jobs** (red with pulse animation)
  - **Urgent Jobs** (orange, 0-2 days)
  - **Proof Needed** (yellow)
  - **In Production** (blue)
  - **Completed** (green)
- Responsive grid: 2 columns (mobile) → 3 (tablet) → 5 (desktop)
- Hover effects with subtle glow and lift

**Files Created**:
- `/apps/web/src/components/jobs/JobStatsBar.tsx`

#### 2. Dashboard Layout Transformation
**Before**: Vertical list (monotonous, cramped)
**After**: Responsive grid with visual polish

**Changes to** `/apps/web/src/app/dashboard/page.tsx`:
- **Grid Layout**: 1 column (mobile) → 2 (tablet) → 3 (desktop)
- **Enhanced Header**: Gradient text title, larger size (4xl)
- **Stats Bar Integration**: Displays above job grid
- **Better Spacing**:
  - Container: `px-6 sm:px-8 lg:px-12`, `py-12`
  - Grid gaps: `gap-6`
  - Card padding: `p-6`

#### 3. Card Visual Enhancements
- **Gradient Backgrounds**: `from-slate-800 to-slate-900`
- **Subtle Glow Effects**: Color-coded by urgency with soft shadows
- **Better Shadows**: `shadow-lg hover:shadow-xl`
- **Smooth Transitions**: 300ms on all interactive elements
- **Hover Lift**: `hover:-translate-y-1`
- **Rounded Corners**: Upgraded to `rounded-xl`
- **Background Element**: Animated blur orb on hover

#### 4. Typography Improvements
- **Card Titles**: `text-xl font-bold tracking-tight`
- **Job Numbers**: `text-xs font-medium` for hierarchy
- **Descriptions**: `text-sm leading-relaxed line-clamp-2`
- **Better Contrast**: Lighter text colors on dark backgrounds

#### 5. Status Badges & Buttons
- **Status Badges**: Gradient backgrounds with shadows
- **Price Display**: Green accent badge with icon and border
- **Buttons**: Gradient hover effects with lift animation
- **Proof Approval**: Enhanced with gradients and micro-interactions

#### 6. Color Palette Refinement
- **Background**: Gradient `from-slate-950 via-slate-900 to-slate-950`
- **Urgency Borders**: Soft opacity (`/50`) with matching glow
- **Interactive Elements**: Brighter blues on hover
- **Overall**: Modern, minimal, sophisticated dark theme

---

## 📁 Files Created (This Session)

1. `/apps/web/src/components/jobs/DeliveryUrgencyBadge.tsx` - Urgency indicators
2. `/apps/web/src/components/jobs/POViewer.tsx` - PO file viewer
3. `/apps/web/src/components/jobs/SampleShipmentCard.tsx` - Sample tracking
4. `/apps/web/src/components/jobs/JobStatsBar.tsx` - Dashboard stats

---

## 📝 Files Modified (This Session)

1. `/apps/web/src/app/dashboard/page.tsx` - Grid layout, stats, urgency sorting
2. `/apps/web/src/components/JobDetailModal.tsx` - PO viewer, samples tab, urgency badge
3. `/apps/web/src/components/jobs/FileChecklist.tsx` - Requirements banner

---

## 👥 User Roles & Views

### CUSTOMER Role (e.g., JJSA, Ballantine)
**What They See**:
- Only their own jobs (filtered by `customerId`)
- Jobs auto-sorted by delivery urgency
- Stats bar showing their job counts
- "New Order" button to submit jobs
- Proof approval interface when proofs are ready
- Sample shipment tracking (new!)
- Customer PO file viewer

**Dashboard URL**: `/dashboard` (after login)

### BROKER_ADMIN Role (Impact Direct)
**What They See**:
- ALL jobs from all customers
- Can create jobs for customers
- Manage quotes and purchase orders
- Full admin dashboard

**Dashboard URL**: `/dashboard` (shows ImpactDirectDashboard)

### BRADFORD_ADMIN Role (Printer)
**What They See**:
- Only jobs with Bradford purchase orders
- Production management views
- Inventory and fulfillment

**Dashboard URL**: `/dashboard` (shows BradfordDashboard)

---

## 🗄️ Database Information

### Connection
```bash
# Development Database
DATABASE_URL="file:./packages/db/prisma/dev.db"

# Location
/Users/nicholasdeblasio/printing-workflow/packages/db/prisma/dev.db
```

### Key Models Used
```prisma
model Job {
  id                String    @id @default(cuid())
  jobNo             String    @unique
  customerId        String
  customerPONumber  String?
  customerPOFile    String?
  deliveryDate      DateTime?
  completedAt       DateTime?
  status            JobStatus
  specs             Json?
  customerTotal     Float?
  proofs            Proof[]
  sampleShipments   SampleShipment[]
  purchaseOrders    PurchaseOrder[]
  // ... more fields
}

model SampleShipment {
  id               String   @id @default(cuid())
  jobId            String
  description      String
  carrier          String
  trackingNo       String?
  recipientName    String
  recipientEmail   String
  recipientAddress String?
  sentAt           DateTime?
  createdAt        DateTime @default(now())
  job              Job      @relation(fields: [jobId], references: [id])
}

model Proof {
  id          String   @id @default(cuid())
  jobId       String
  version     Int
  fileUrl     String
  status      ProofStatus
  approvedBy  String?
  approvedAt  DateTime?
  // ... more fields
}

enum JobStatus {
  DRAFT
  PENDING_QUOTE
  QUOTED
  READY_FOR_PROOF
  PROOF_APPROVED
  IN_PRODUCTION
  COMPLETED
  CANCELLED
}
```

### Useful Prisma Commands
```bash
# Generate Prisma Client (after schema changes)
npx pnpm db:generate

# Push schema changes to database (dev)
npx pnpm db:push

# View database in browser
npx pnpm db:studio

# Reset database
npx pnpm db:reset
```

---

## ⏳ Pending Tasks

### PHASE 2 - Remaining
- [ ] **Customer Invoice Portal** - Create `/invoices` page filtered by customer

### PHASE 3 - Job Timeline Visualization
- [ ] **JobTimeline Component** - Visual timeline of job progression
  - Show JobActivity entries
  - Display status changes, comments, file uploads
  - Timeline visualization with icons
- [ ] **Integrate into JobDetailModal** - Add "Timeline" tab

---

## 🐛 Known Issues / Notes

1. **Syntax Error Fix Applied**: Fixed extra closing `</div>` tag in dashboard grid (line 571)
2. **Multiple Dev Servers Running**: Several background shells from testing - can be killed if needed
3. **Environment Variables**: API URL defaults to `http://localhost:3001` if not set

---

## 💡 Key Implementation Details

### Urgency Calculation Logic
```typescript
export function getDeliveryUrgency(
  deliveryDate: string | null | undefined,
  completedAt?: string | null
): number {
  if (!deliveryDate || completedAt) return 999; // Not urgent

  const now = new Date();
  const delivery = new Date(deliveryDate);
  const daysUntil = Math.ceil((delivery.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return -1;  // Late (overdue)
  if (daysUntil <= 2) return 0;  // Urgent (0-2 days)
  if (daysUntil <= 7) return 1;  // Warning (3-7 days)
  return 2;                       // Normal (8+ days)
}
```

### Stats Calculation
```typescript
const jobStats = useMemo(() => {
  const stats = { late: 0, urgent: 0, proofNeeded: 0, inProduction: 0, completed: 0 };

  filteredJobs.forEach((job) => {
    const urgency = getDeliveryUrgency(job.deliveryDate, job.completedAt);
    if (urgency === -1) stats.late++;
    else if (urgency === 0) stats.urgent++;

    if (job.status === 'READY_FOR_PROOF') stats.proofNeeded++;
    if (job.status === 'IN_PRODUCTION' || job.status === 'PROOF_APPROVED') stats.inProduction++;
    if (job.status === 'COMPLETED') stats.completed++;
  });

  return stats;
}, [filteredJobs]);
```

---

## 🎨 Visual Design System

### Color Palette
- **Late/Error**: Red (`red-500`, `red-900`)
- **Urgent**: Orange (`orange-500`, `orange-900`)
- **Warning**: Yellow (`yellow-500`, `yellow-900`)
- **Success**: Green (`green-500`, `green-900`)
- **Info**: Blue (`blue-500`, `blue-900`)
- **Neutral**: Slate (`slate-700` to `slate-950`)

### Spacing Scale
- Card padding: `p-6`
- Grid gaps: `gap-6`
- Section spacing: `space-y-8`
- Container padding: `px-6 sm:px-8 lg:px-12`

### Typography Scale
- Page title: `text-4xl font-bold tracking-tight`
- Card title: `text-xl font-bold tracking-tight`
- Body text: `text-sm leading-relaxed`
- Labels: `text-xs font-medium`

---

## 🔄 Common Development Tasks

### Add a New Component
```bash
# Create in appropriate directory
touch apps/web/src/components/[category]/[ComponentName].tsx

# Follow pattern:
'use client';  // For client-side interactivity

interface [ComponentName]Props {
  // props
}

export function [ComponentName]({ ...props }: [ComponentName]Props) {
  // component
}
```

### Modify Database Schema
```bash
# 1. Edit schema
nano packages/db/prisma/schema.prisma

# 2. Generate Prisma client
npx pnpm db:generate

# 3. Push changes (dev only)
npx pnpm db:push

# 4. Restart API server
```

### Debug API Issues
```bash
# Check API logs in terminal running:
cd apps/api && npx pnpm dev

# Test API endpoint
curl http://localhost:3001/api/jobs
```

---

## 📞 Support & Context

### For Next Session
**Copy this to new chat**:
> I'm working on the printing-workflow app. Here's the context:
> - **Web**: http://localhost:5175
> - **API**: http://localhost:3001
> - **Database**: SQLite at `/packages/db/prisma/dev.db`
> - **Main file**: `/apps/web/src/app/dashboard/page.tsx`
>
> **Completed**: Phase 1 (late warnings, PO viewer, file clarity), Phase 2 partial (sample tracking), UI enhancements (grid layout, stats bar, visual polish)
>
> **Next**: [Describe what you want to work on]

### Repository Location
```
/Users/nicholasdeblasio/printing-workflow
```

---

## ✨ Summary

This session significantly improved the customer experience with:
1. **Urgent job visibility** - Late jobs are impossible to miss
2. **Sample tracking** - Customers can track their samples
3. **Better file upload UX** - Clear requirements eliminate confusion
4. **Visual appeal** - Modern grid layout that's enjoyable to use
5. **Stats dashboard** - At-a-glance overview of all jobs

The app is now **much more user-friendly** with a **professional, modern appearance** that customers will want to use daily.

**Status**: ✅ Ready for continued development or deployment testing
