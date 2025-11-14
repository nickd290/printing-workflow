#!/usr/bin/env tsx
/**
 * Audit and fix PO-Invoice sync mismatches
 *
 * This script:
 * 1. Finds all PO-Invoice pairs that should match (by jobId and opposite company direction)
 * 2. Reports any mismatches where PO vendorAmount != Invoice amount
 * 3. Optionally fixes mismatches by syncing invoice amounts to match PO amounts
 * 4. Generates a CSV report
 *
 * Usage:
 *   # Audit only (no changes)
 *   DATABASE_URL="file:./packages/db/prisma/dev.db" npx tsx packages/db/scripts/audit-po-invoice-sync.ts
 *
 *   # Audit and fix
 *   DATABASE_URL="file:./packages/db/prisma/dev.db" npx tsx packages/db/scripts/audit-po-invoice-sync.ts --fix
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface POInvoicePair {
  jobId: string;
  jobNo: string;
  poId: string;
  poOrigin: string;
  poTarget: string;
  poVendorAmount: number;
  invoiceId: string;
  invoiceNo: string;
  invoiceFrom: string;
  invoiceTo: string;
  invoiceAmount: number;
  mismatch: boolean;
  difference: number;
}

async function auditPOInvoiceSync(fix: boolean = false) {
  console.log('🔍 Auditing PO-Invoice sync...\n');

  // Get all jobs with POs and invoices
  const jobs = await prisma.job.findMany({
    where: {
      AND: [
        { purchaseOrders: { some: {} } },
        { invoices: { some: {} } },
      ],
    },
    select: {
      id: true,
      jobNo: true,
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

  console.log(`Found ${jobs.length} jobs with both POs and invoices\n`);

  const pairs: POInvoicePair[] = [];
  let mismatchCount = 0;

  for (const job of jobs) {
    for (const po of job.purchaseOrders) {
      // Find matching invoice: from = PO target, to = PO origin
      const matchingInvoice = job.invoices.find(
        (inv) =>
          inv.fromCompanyId === po.targetCompanyId &&
          inv.toCompanyId === po.originCompanyId
      );

      if (matchingInvoice) {
        const poAmount = Number(po.vendorAmount);
        const invoiceAmount = Number(matchingInvoice.amount);
        const mismatch = Math.abs(poAmount - invoiceAmount) > 0.01; // Allow 1 cent tolerance
        const difference = invoiceAmount - poAmount;

        if (mismatch) {
          mismatchCount++;
        }

        pairs.push({
          jobId: job.id,
          jobNo: job.jobNo,
          poId: po.id,
          poOrigin: po.originCompany.name,
          poTarget: po.targetCompany.name,
          poVendorAmount: poAmount,
          invoiceId: matchingInvoice.id,
          invoiceNo: matchingInvoice.invoiceNo,
          invoiceFrom: matchingInvoice.fromCompany.name,
          invoiceTo: matchingInvoice.toCompany.name,
          invoiceAmount: invoiceAmount,
          mismatch,
          difference,
        });
      }
    }
  }

  console.log(`📊 Summary:`);
  console.log(`  Total PO-Invoice pairs: ${pairs.length}`);
  console.log(`  Mismatches found: ${mismatchCount}`);
  console.log(`  Percentage in sync: ${((1 - mismatchCount / pairs.length) * 100).toFixed(2)}%\n`);

  // Display mismatches
  if (mismatchCount > 0) {
    console.log('❌ Mismatches found:\n');
    const mismatches = pairs.filter((p) => p.mismatch);

    mismatches.forEach((pair, idx) => {
      console.log(`${idx + 1}. Job ${pair.jobNo}`);
      console.log(`   PO: ${pair.poOrigin} → ${pair.poTarget} | $${pair.poVendorAmount.toFixed(2)}`);
      console.log(`   Invoice: ${pair.invoiceFrom} → ${pair.invoiceTo} (#${pair.invoiceNo}) | $${pair.invoiceAmount.toFixed(2)}`);
      console.log(`   Difference: $${pair.difference.toFixed(2)}\n`);
    });

    // Fix mismatches if requested
    if (fix) {
      console.log('🔧 Fixing mismatches...\n');

      let fixedCount = 0;
      for (const pair of mismatches) {
        try {
          // Update invoice amount to match PO vendorAmount
          await prisma.invoice.update({
            where: { id: pair.invoiceId },
            data: { amount: pair.poVendorAmount },
          });

          // Create sync log
          await prisma.syncLog.create({
            data: {
              trigger: 'PO_UPDATE',
              purchaseOrderId: pair.poId,
              invoiceId: pair.invoiceId,
              jobId: pair.jobId,
              field: 'amount',
              oldValue: pair.invoiceAmount,
              newValue: pair.poVendorAmount,
              changedBy: 'migration-script',
              notes: `Migration script synced invoice ${pair.invoiceNo} from $${pair.invoiceAmount} to $${pair.poVendorAmount} to match PO vendorAmount`,
            },
          });

          console.log(`  ✅ Fixed: Job ${pair.jobNo} - Invoice ${pair.invoiceNo}: $${pair.invoiceAmount.toFixed(2)} → $${pair.poVendorAmount.toFixed(2)}`);
          fixedCount++;
        } catch (error) {
          console.error(`  ❌ Error fixing Job ${pair.jobNo} - Invoice ${pair.invoiceNo}:`, error);
        }
      }

      console.log(`\n✅ Fixed ${fixedCount} of ${mismatchCount} mismatches\n`);
    } else {
      console.log('ℹ️  Run with --fix flag to automatically sync invoice amounts to match PO amounts\n');
    }
  } else {
    console.log('✅ All PO-Invoice pairs are in sync!\n');
  }

  // Generate CSV report
  const csvPath = path.join(process.cwd(), 'po-invoice-sync-report.csv');
  const csvHeader = 'Job No,PO Origin,PO Target,PO Vendor Amount,Invoice No,Invoice From,Invoice To,Invoice Amount,Mismatch,Difference\n';
  const csvRows = pairs.map((p) =>
    [
      p.jobNo,
      p.poOrigin,
      p.poTarget,
      p.poVendorAmount.toFixed(2),
      p.invoiceNo,
      p.invoiceFrom,
      p.invoiceTo,
      p.invoiceAmount.toFixed(2),
      p.mismatch ? 'YES' : 'NO',
      p.difference.toFixed(2),
    ].join(',')
  );
  const csvContent = csvHeader + csvRows.join('\n');

  fs.writeFileSync(csvPath, csvContent);
  console.log(`📄 Report saved to: ${csvPath}\n`);
}

async function main() {
  const fix = process.argv.includes('--fix');

  if (fix) {
    console.log('⚠️  FIX MODE ENABLED - Invoice amounts will be updated to match PO amounts\n');
  } else {
    console.log('📋 AUDIT MODE - No changes will be made\n');
  }

  await auditPOInvoiceSync(fix);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
