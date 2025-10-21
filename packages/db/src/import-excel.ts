import { PrismaClient, Role, JobStatus, InvoiceStatus } from '@prisma/client';
import XLSX from 'xlsx';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

// Map old job IDs to new job IDs for relationships
const jobIdMap = new Map<string, string>();

// Status mapping
function mapJobStatus(oldStatus: string): JobStatus {
  const status = oldStatus?.toLowerCase();
  if (status === 'completed') return 'COMPLETED';
  if (status === 'pending') return 'PENDING';
  if (status === 'in_production' || status === 'in production') return 'IN_PRODUCTION';
  if (status === 'ready_for_proof' || status === 'ready for proof') return 'READY_FOR_PROOF';
  if (status === 'proof_approved' || status === 'proof approved') return 'PROOF_APPROVED';
  return 'PENDING'; // default
}

function mapPOStatus(oldStatus: string): 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' {
  const status = oldStatus?.toLowerCase();
  if (status === 'completed') return 'COMPLETED';
  if (status === 'sent') return 'ACCEPTED'; // Map 'sent' to 'ACCEPTED'
  if (status === 'accepted') return 'ACCEPTED';
  if (status === 'in_progress' || status === 'in progress') return 'IN_PROGRESS';
  if (status === 'cancelled') return 'CANCELLED';
  return 'PENDING'; // default
}

// Date parsing
function parseDate(dateStr: string | null | number): Date | null {
  if (!dateStr || dateStr === 'null') return null;
  try {
    // Handle Excel serial date numbers
    if (typeof dateStr === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + dateStr * 86400000);
      return isNaN(date.getTime()) ? null : date;
    }
    // Handle string dates
    const cleaned = String(dateStr).replace(/^"+|"+$/g, '');
    const date = new Date(cleaned);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

// Number parsing
function parseNumber(numStr: string | number | null): number {
  if (!numStr || numStr === 'null') return 0;
  if (typeof numStr === 'number') return numStr;
  const cleaned = String(numStr).replace(/[$,]/g, '');
  return parseFloat(cleaned) || 0;
}

async function importCompanies() {
  console.log('\n🏢 Creating Default Companies...');

  await prisma.company.upsert({
    where: { id: 'impact-direct' },
    update: {},
    create: {
      id: 'impact-direct',
      name: 'Impact Direct',
      type: 'broker',
      email: 'info@impactdirect.com',
      phone: '555-0100',
    },
  });

  await prisma.company.upsert({
    where: { id: 'bradford' },
    update: {},
    create: {
      id: 'bradford',
      name: 'Bradford',
      type: 'broker',
      email: 'steve.gustafson@bgeltd.com',
      phone: '555-0200',
    },
  });

  await prisma.company.upsert({
    where: { id: 'jd-graphic' },
    update: {},
    create: {
      id: 'jd-graphic',
      name: 'JD Graphic',
      type: 'manufacturer',
      email: 'production@jdgraphic.com',
      phone: '555-0300',
    },
  });

  console.log('  ✅ Created 3 core companies');
}

async function importCompaniesFromJobs(jobsData: any[]) {
  console.log('\n🏢 Pre-scanning Jobs for Customer Companies...');

  const customersMap = new Map<string, { name: string; email: string | null }>();

  for (const row of jobsData) {
    const customerId = row.customer_id?.trim();
    const customerName = row.customer_name?.trim();
    const customerEmail = row.customer_email?.trim();

    if (customerId && !customersMap.has(customerId)) {
      let name = customerName || 'Unknown Customer';
      if (!customerName && customerEmail) {
        const emailDomain = customerEmail.split('@')[1]?.split('.')[0];
        if (emailDomain) {
          name = emailDomain.charAt(0).toUpperCase() + emailDomain.slice(1);
        }
      }

      customersMap.set(customerId, {
        name,
        email: customerEmail || null,
      });
    }
  }

  let created = 0;
  for (const [customerId, data] of customersMap.entries()) {
    try {
      await prisma.company.upsert({
        where: { id: customerId },
        update: {},
        create: {
          id: customerId,
          name: data.name,
          type: 'customer',
          email: data.email,
        },
      });
      created++;
    } catch (error: any) {
      console.error(`  ❌ Failed to create company ${customerId}:`, error.message);
    }
  }

  console.log(`  ✅ Created ${created} customer companies from jobs data`);
}

async function importJobs(jobsData: any[]) {
  console.log('\n💼 Importing Jobs...');

  let imported = 0;
  let skipped = 0;

  for (const row of jobsData) {
    try {
      const jobNo = row.job_number?.trim();
      const oldJobId = row.id?.trim();
      const customerId = row.customer_id?.trim();

      if (!jobNo) {
        skipped++;
        continue;
      }

      // Use customer_id from data, or fall back to impact-direct if missing
      const finalCustomerId = customerId || 'impact-direct';

      // Verify customer exists
      const customerExists = await prisma.company.findUnique({ where: { id: finalCustomerId } });
      if (!customerExists) {
        console.error(`  ⚠️  Customer ${finalCustomerId} not found for job ${jobNo}, using impact-direct`);
      }

      // Parse specifications JSON if it exists
      let csvSpecs = {};
      if (row.specifications) {
        try {
          csvSpecs = typeof row.specifications === 'string'
            ? JSON.parse(row.specifications)
            : row.specifications;
        } catch (e) {
          // Ignore invalid JSON
        }
      }

      // Build comprehensive specs JSON
      const specs: any = { ...csvSpecs };
      if (row.size) specs.size = row.size;
      if (row.colors) specs.colors = row.colors;
      if (row.finishing) specs.finishing = row.finishing;
      if (row.bindery) specs.bindery = row.bindery;
      if (row.paper_type) specs.paperType = row.paper_type;
      if (row.delivery_method) specs.deliveryMethod = row.delivery_method;
      if (row.delivery_address) specs.deliveryAddress = row.delivery_address;
      if (row.notes) specs.notes = row.notes;
      if (row.proof_status) specs.proofStatus = row.proof_status;
      if (row.proof_url) specs.proofUrl = row.proof_url;

      // Add artwork URLs
      if (row.artworkUrls) {
        try {
          specs.artworkUrls = typeof row.artworkUrls === 'string'
            ? JSON.parse(row.artworkUrls)
            : row.artworkUrls;
        } catch (e) {
          specs.artworkUrls = row.artworkUrls;
        }
      }

      const newJob = await prisma.job.create({
        data: {
          jobNo,
          customerId: finalCustomerId,
          title: row.title || null,
          description: row.description || null,
          customerPONumber: row.customer_po_number ? String(row.customer_po_number) : null,
          status: mapJobStatus(row.status),
          specs,
          sizeName: row.size || null,
          quantity: parseNumber(row.quantity),
          paperType: row.paper_type || null,
          customerTotal: parseNumber(row.total_price) || 0,
          impactMargin: 0,
          bradfordTotal: 0,
          deliveryDate: parseDate(row.delivery_date),
          mailDate: parseDate(row.mail_date),
          inHomesDate: parseDate(row.in_homes_date),
          completedAt: parseDate(row.actual_completion_date),
          createdAt: parseDate(row.created_at) || new Date(),
          updatedAt: parseDate(row.updated_at) || new Date(),
        },
      });

      // Map old job ID to new job ID
      if (oldJobId) {
        jobIdMap.set(oldJobId, newJob.id);
      }

      imported++;

      if (imported % 10 === 0) {
        console.log(`  ... imported ${imported} jobs`);
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to import job ${row.job_number}:`, error.message);
      skipped++;
    }
  }

  console.log(`  ✅ Imported ${imported} jobs, skipped ${skipped}`);
}

async function importInvoices(invoicesData: any[]) {
  console.log('\n📜 Importing Invoices...');

  const impactDirect = await prisma.company.findUnique({ where: { id: 'impact-direct' } });
  const bradford = await prisma.company.findUnique({ where: { id: 'bradford' } });

  if (!impactDirect || !bradford) {
    console.error('  ❌ Required companies not found');
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const row of invoicesData) {
    try {
      const invoiceNo = row.invoice_number?.trim();
      const oldJobId = row.job_id?.trim();

      if (!invoiceNo) {
        skipped++;
        continue;
      }

      // Map old job ID to new job ID
      let newJobId: string | null = null;
      if (oldJobId) {
        newJobId = jobIdMap.get(oldJobId) || null;
        if (!newJobId) {
          console.error(`  ⚠️  Job ${oldJobId} not found for invoice ${invoiceNo}, skipping`);
          skipped++;
          continue;
        }
      }

      // Determine companies based on type
      const type = row.type;
      let fromCompanyId = bradford.id;
      let toCompanyId = impactDirect.id;

      if (type === 'bradford_to_impact') {
        fromCompanyId = bradford.id;
        toCompanyId = impactDirect.id;
      } else if (type === 'impact_to_customer' && newJobId) {
        // Get customer from job
        const job = await prisma.job.findUnique({ where: { id: newJobId } });
        if (job) {
          fromCompanyId = impactDirect.id;
          toCompanyId = job.customerId;
        }
      }

      await prisma.invoice.create({
        data: {
          invoiceNo,
          jobId: newJobId,
          fromCompanyId,
          toCompanyId,
          amount: parseNumber(row.total_amount),
          status: row.status === 'sent' ? 'SENT' : 'DRAFT',
          issuedAt: parseDate(row.issued_date),
          dueAt: parseDate(row.due_date),
          paidAt: parseDate(row.paid_date),
          createdAt: parseDate(row.created_at) || new Date(),
          updatedAt: parseDate(row.updated_at) || new Date(),
        },
      });

      imported++;
    } catch (error: any) {
      console.error(`  ❌ Failed to import invoice ${row.invoice_number}:`, error.message);
      skipped++;
    }
  }

  console.log(`  ✅ Imported ${imported} invoices, skipped ${skipped}`);
}

async function importBradfordPOs(posData: any[]) {
  console.log('\n📦 Importing Bradford → JD Graphic POs...');

  const bradford = await prisma.company.findUnique({ where: { id: 'bradford' } });
  const jdGraphic = await prisma.company.findUnique({ where: { id: 'jd-graphic' } });

  if (!bradford || !jdGraphic) {
    console.error('  ❌ Required companies not found');
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const row of posData) {
    try {
      const oldJobId = typeof row.job_id === 'string' ? row.job_id.trim() : String(row.job_id || '').trim();
      const poNumber = row.po_number ? String(row.po_number) : null;

      if (!oldJobId) {
        skipped++;
        continue;
      }

      // Map old job ID to new job ID
      const newJobId = jobIdMap.get(oldJobId);
      if (!newJobId) {
        console.error(`  ⚠️  Job ${oldJobId} not found for PO ${poNumber}, skipping`);
        skipped++;
        continue;
      }

      const totalAmount = parseNumber(row.total_amount) || 0;

      await prisma.purchaseOrder.create({
        data: {
          jobId: newJobId,
          originCompanyId: bradford.id,
          targetCompanyId: jdGraphic.id,
          poNumber: poNumber || null,
          originalAmount: totalAmount,
          vendorAmount: totalAmount, // Bradford pays this to JD
          marginAmount: 0, // No margin on this leg
          status: mapPOStatus(row.status || 'PENDING'),
          externalRef: row.component_id || null,
          createdAt: parseDate(row.created_at) || new Date(),
          updatedAt: parseDate(row.updated_at) || new Date(),
        },
      });

      imported++;

      if (imported % 10 === 0) {
        console.log(`  ... imported ${imported} Bradford POs`);
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to import Bradford PO ${row.po_number}:`, error.message);
      skipped++;
    }
  }

  console.log(`  ✅ Imported ${imported} Bradford POs, skipped ${skipped}`);
}

async function main() {
  console.log('🚀 Starting Excel Import...\n');
  console.log('⚠️  WARNING: This will replace all existing data in the database!\n');

  try {
    // Read Excel file
    const excelPath = '/Users/nicholasdeblasio/Desktop/invoices (1).xlsx';
    console.log(`📂 Reading file: ${excelPath}\n`);

    const workbook = XLSX.readFile(excelPath);

    // Read each sheet
    const invoicesSheet = workbook.Sheets['invoices'];
    const jobsSheet = workbook.Sheets['Jobs'];
    const bradfordPOsSheet = workbook.Sheets['Bradford POs'];

    // Convert sheets to JSON (skip first row if empty)
    const invoicesData = XLSX.utils.sheet_to_json(invoicesSheet);
    const jobsData = XLSX.utils.sheet_to_json(jobsSheet);
    const bradfordPOsData = XLSX.utils.sheet_to_json(bradfordPOsSheet);

    console.log(`📊 Found data:`);
    console.log(`  - Invoices: ${invoicesData.length} rows`);
    console.log(`  - Jobs: ${jobsData.length} rows`);
    console.log(`  - Bradford POs: ${bradfordPOsData.length} rows`);
    console.log('');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await prisma.purchaseOrder.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.proof.deleteMany();
    await prisma.job.deleteMany();
    await prisma.company.deleteMany({ where: { type: 'customer' } });
    console.log('  ✅ Cleared\n');

    // Import in order (respecting foreign keys)
    await importCompanies();
    await importCompaniesFromJobs(jobsData);
    await importJobs(jobsData);
    await importInvoices(invoicesData);
    await importBradfordPOs(bradfordPOsData);

    console.log('\n✅ Import complete!');

    // Show summary
    const counts = await Promise.all([
      prisma.company.count(),
      prisma.job.count(),
      prisma.invoice.count(),
      prisma.purchaseOrder.count(),
    ]);

    console.log('\n📊 Database Summary:');
    console.log(`  Companies: ${counts[0]}`);
    console.log(`  Jobs: ${counts[1]}`);
    console.log(`  Invoices: ${counts[2]}`);
    console.log(`  Purchase Orders: ${counts[3]}`);

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
