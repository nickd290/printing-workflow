/**
 * Complete Bradford Jobs and Generate Invoices
 *
 * This script marks all Bradford jobs as COMPLETED and generates missing invoices.
 *
 * Run with: DATABASE_URL="file:./packages/db/prisma/dev.db" npx tsx apps/api/src/scripts/complete-bradford-jobs.ts
 */

import { prisma } from '@printing-workflow/db';

const COMPANY_IDS = {
  JD_GRAPHIC: 'jd-graphic',
  BRADFORD: 'bradford',
  IMPACT_DIRECT: 'impact-direct',
};

async function generateInvoiceNumber(): Promise<string> {
  // Get the latest invoice number
  const latestInvoice = await prisma.invoice.findFirst({
    orderBy: { invoiceNo: 'desc' },
  });

  if (!latestInvoice) {
    return 'INV-2025-000001';
  }

  // Extract number from INV-YYYY-NNNNNN format
  const parts = latestInvoice.invoiceNo.split('-');
  const year = new Date().getFullYear();
  const num = parseInt(parts[2]) + 1;

  return `INV-${year}-${num.toString().padStart(6, '0')}`;
}

async function main() {
  console.log('\n========================================');
  console.log('🔧 COMPLETING BRADFORD JOBS & GENERATING INVOICES');
  console.log('========================================\n');

  // Step 1: Find all Bradford jobs
  const allJobs = await prisma.job.findMany({
    include: {
      purchaseOrders: {
        include: {
          originCompany: true,
          targetCompany: true,
        },
      },
      invoices: {
        include: {
          fromCompany: true,
          toCompany: true,
        },
      },
    },
  });

  // Filter jobs that involve Bradford
  const bradfordJobs = allJobs.filter((job) =>
    job.purchaseOrders.some(
      (po) =>
        po.targetCompanyId === COMPANY_IDS.BRADFORD ||
        po.originCompanyId === COMPANY_IDS.BRADFORD
    )
  );

  console.log(`Found ${bradfordJobs.length} total Bradford jobs\n`);

  // Step 2: Mark non-completed jobs as COMPLETED
  const nonCompletedJobs = bradfordJobs.filter(j => j.status !== 'COMPLETED');

  console.log(`Marking ${nonCompletedJobs.length} jobs as COMPLETED...`);
  for (const job of nonCompletedJobs) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    console.log(`  ✅ ${job.jobNo} -> COMPLETED`);
  }

  // Step 3: Generate missing invoices
  console.log(`\nChecking for missing invoices...`);

  let generatedCount = 0;

  for (const job of bradfordJobs) {
    // Check if job has Bradford → Impact Direct invoice
    const hasOutgoingInvoice = job.invoices.some(
      inv => inv.fromCompanyId === COMPANY_IDS.BRADFORD && inv.toCompanyId === COMPANY_IDS.IMPACT_DIRECT
    );

    // Check if job has JD → Bradford invoice
    const hasIncomingInvoice = job.invoices.some(
      inv => inv.fromCompanyId === COMPANY_IDS.JD_GRAPHIC && inv.toCompanyId === COMPANY_IDS.BRADFORD
    );

    // Only generate outgoing invoice if job has pricing and doesn't already have one
    if (!hasOutgoingInvoice && job.bradfordTotal && parseFloat(job.bradfordTotal.toString()) > 0) {
      const invoiceNo = await generateInvoiceNumber();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // Net 30

      await prisma.invoice.create({
        data: {
          invoiceNo,
          jobId: job.id,
          fromCompanyId: COMPANY_IDS.BRADFORD,
          toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
          amount: job.bradfordTotal,
          dueAt: dueDate,
          status: 'PAID', // Mark as paid since work is done
        },
      });

      console.log(`  ✅ Generated outgoing invoice ${invoiceNo} for ${job.jobNo}: $${job.bradfordTotal}`);
      generatedCount++;
    }

    // Generate incoming invoice if missing and job has JD cost
    if (!hasIncomingInvoice && job.jdTotal && parseFloat(job.jdTotal.toString()) > 0) {
      const invoiceNo = await generateInvoiceNumber();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      await prisma.invoice.create({
        data: {
          invoiceNo,
          jobId: job.id,
          fromCompanyId: COMPANY_IDS.JD_GRAPHIC,
          toCompanyId: COMPANY_IDS.BRADFORD,
          amount: job.jdTotal,
          dueAt: dueDate,
          status: 'PAID',
        },
      });

      console.log(`  ✅ Generated incoming invoice ${invoiceNo} for ${job.jobNo}: $${job.jdTotal}`);
      generatedCount++;
    }
  }

  console.log(`\n📊 Generated ${generatedCount} invoices`);

  // Step 4: Verify results
  console.log('\n========================================');
  console.log('📊 VERIFICATION');
  console.log('========================================\n');

  const updatedJobs = await prisma.job.findMany({
    where: {
      id: { in: bradfordJobs.map(j => j.id) },
    },
    include: {
      invoices: true,
    },
  });

  const allCompleted = updatedJobs.every(j => j.status === 'COMPLETED');
  const totalMargin = updatedJobs.reduce((sum, j) => {
    const margin = j.bradfordTotalMargin ? parseFloat(j.bradfordTotalMargin.toString()) : 0;
    return sum + margin;
  }, 0);

  console.log(`✅ All jobs COMPLETED: ${allCompleted ? 'YES' : 'NO'}`);
  console.log(`✅ Total Bradford Margin: $${totalMargin.toFixed(2)}`);
  console.log(`✅ Total Jobs with Margins: ${updatedJobs.filter(j => j.bradfordTotalMargin && parseFloat(j.bradfordTotalMargin.toString()) > 0).length}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
