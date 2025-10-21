import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface BradfordPORow {
  id: string;
  po_number: string;
  job_id: string;
  job_number: string;
  customer_po_number: string;
  total_amount: string;
  status: string;
}

async function importBradfordPOs() {
  try {
    console.log('📥 Starting Bradford → JD Graphic PO import...\n');

    // Read CSV file
    const csvPath = '/Users/nicholasdeblasio/Downloads/invoices - Bradford POs.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    // Parse CSV
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');

    const pos: BradfordPORow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = line.split(',');

      // Skip if first column (id) is empty
      if (!values[0]) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      pos.push(row);
    }

    console.log(`Found ${pos.length} POs to import\n`);

    // Verify company IDs exist
    const bradford = await prisma.company.findUnique({ where: { id: 'bradford' } });
    const jdGraphic = await prisma.company.findUnique({ where: { id: 'jd-graphic' } });

    if (!bradford || !jdGraphic) {
      throw new Error('Bradford or JD Graphic company not found in database');
    }

    console.log('✅ Companies verified: Bradford & JD Graphic\n');

    // Import each PO
    let successCount = 0;
    let errorCount = 0;

    for (const po of pos) {
      try {
        // Check if PO already exists
        const existingPO = await prisma.purchaseOrder.findFirst({
          where: {
            poNumber: po.po_number,
            originCompanyId: 'bradford',
            targetCompanyId: 'jd-graphic',
          },
        });

        if (existingPO) {
          console.log(`⏭️  PO ${po.po_number} already exists - skipping`);
          errorCount++;
          continue;
        }

        // Find job by job number instead of CSV job_id
        const job = await prisma.job.findFirst({ where: { jobNo: po.job_number } });

        if (!job) {
          console.warn(`⚠️  Job ${po.job_number} not found in database - skipping PO ${po.po_number}`);
          errorCount++;
          continue;
        }

        const vendorAmount = parseFloat(po.total_amount);

        await prisma.purchaseOrder.create({
          data: {
            originCompanyId: 'bradford',
            targetCompanyId: 'jd-graphic',
            poNumber: po.po_number,
            jobId: job.id,  // Use actual job ID from database
            referencePONumber: po.customer_po_number || null,
            vendorAmount: vendorAmount,
            originalAmount: vendorAmount,
            marginAmount: 0,  // Bradford->JD has no margin for Bradford
            status: 'COMPLETED',  // POs are already sent/completed
          },
        });

        console.log(`✅ Imported PO ${po.po_number} for job ${po.job_number} ($${vendorAmount.toFixed(2)})`);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Error importing PO ${po.po_number}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📦 Total: ${pos.length}`);

    // Verify final count
    const finalCount = await prisma.purchaseOrder.count({
      where: {
        originCompanyId: 'bradford',
        targetCompanyId: 'jd-graphic',
      },
    });

    console.log(`\n✨ Final database count: ${finalCount} Bradford→JD POs`);

  } catch (error) {
    console.error('💥 Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

importBradfordPOs()
  .then(() => {
    console.log('\n✅ Import complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
