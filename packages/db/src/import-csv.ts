import { PrismaClient, Role, JobStatus, InvoiceStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

// Map old job IDs to new job IDs for proofs and invoices
const jobIdMap = new Map<string, string>();

// Robust CSV parsing helper that handles quoted fields with commas
function parseCSV(content: string): any[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  // First, split into proper lines (handling quotes that span lines)
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentLine += '""';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
        currentLine += char;
      }
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }

  // Add last line if exists
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const rows: any[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : null;
    });
    rows.push(row);
  }

  return rows;
}

// Parse a single CSV line, handling quoted fields
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote - add single quote
        currentValue += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  // Add last value
  values.push(currentValue.trim());

  return values;
}

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

function mapUserRole(oldRole: string): Role {
  const role = oldRole?.toLowerCase();
  if (role === 'broker') return 'BROKER_ADMIN';
  if (role === 'customer') return 'CUSTOMER';
  if (role === 'bradford') return 'BRADFORD_ADMIN';
  if (role === 'manager') return 'MANAGER';
  return 'CUSTOMER'; // default
}

// Date parsing
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr || dateStr === 'null' || dateStr.trim() === '') return null;
  try {
    const cleaned = dateStr.replace(/^"+|"+$/g, '');
    const date = new Date(cleaned);
    // Check if date is valid
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

// Number parsing
function parseNumber(numStr: string | null): number {
  if (!numStr || numStr === 'null') return 0;
  const cleaned = numStr.replace(/[$,]/g, '');
  return parseFloat(cleaned) || 0;
}

async function importUsers() {
  console.log('\n📧 Importing Users...');

  const csvPath = path.join(__dirname, '../../../data/imports/users.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  users.csv not found, skipping');
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const email = row.email?.trim();
      if (!email) {
        skipped++;
        continue;
      }

      await prisma.user.create({
        data: {
          email,
          name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || email,
          role: mapUserRole(row.role),
          emailVerified: new Date(),
          // Note: Passwords should be reset by users
        },
      });

      imported++;
    } catch (error: any) {
      console.error(`  ❌ Failed to import user ${row.email}:`, error.message);
      skipped++;
    }
  }

  console.log(`  ✅ Imported ${imported} users, skipped ${skipped}`);
}

async function importCompanies() {
  console.log('\n🏢 Creating Default Companies...');

  // Create the core companies that we need
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

async function importCompaniesFromJobs() {
  console.log('\n🏢 Pre-scanning Jobs CSV for Customer Companies...');

  const csvPath = path.join(__dirname, '../../../data/imports/jobs (1).csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  jobs (1).csv not found, skipping');
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  // Extract unique customers from jobs
  const customersMap = new Map<string, { name: string; email: string | null }>();

  for (const row of rows) {
    const customerId = row.customer_id?.trim();
    const customerName = row.customer_name?.trim();
    const customerEmail = row.customer_email?.trim();

    if (customerId && !customersMap.has(customerId)) {
      // Use customer_name or derive from email, or use a placeholder
      let name = customerName || 'Unknown Customer';
      if (!customerName && customerEmail) {
        // Extract name from email (e.g., "jennifer@ballantine.com" -> "Ballantine")
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

  // Create Company records for each unique customer
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

  console.log(`  ✅ Created ${created} customer companies from jobs CSV`);
}

async function importJobs() {
  console.log('\n💼 Importing Jobs...');

  const csvPath = path.join(__dirname, '../../../data/imports/jobs (1).csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  jobs (1).csv not found, skipping');
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  // Build ID map from existing jobs first (for re-runs)
  const existingJobs = await prisma.job.findMany({ select: { id: true, jobNo: true } });
  const jobNoToNewId = new Map(existingJobs.map(j => [j.jobNo, j.id]));

  // Map old IDs to new IDs by matching job numbers
  for (const row of rows) {
    const oldJobId = row.id?.trim();
    const jobNo = row.job_number?.trim();
    if (oldJobId && jobNo) {
      const newJobId = jobNoToNewId.get(jobNo);
      if (newJobId) {
        jobIdMap.set(oldJobId, newJobId);
      }
    }
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const jobNo = row.job_number?.trim();
      const oldJobId = row.id?.trim();
      const customerId = row.customer_id?.trim();

      if (!jobNo) {
        skipped++;
        continue;
      }

      // Use customer_id from CSV, or fall back to impact-direct if missing
      const finalCustomerId = customerId || 'impact-direct';

      // Verify customer exists
      const customerExists = await prisma.company.findUnique({ where: { id: finalCustomerId } });
      if (!customerExists) {
        console.error(`  ⚠️  Customer ${finalCustomerId} not found for job ${jobNo}, using impact-direct`);
        // Fall back to impact-direct if customer doesn't exist
        const impactDirect = await prisma.company.findUnique({ where: { id: 'impact-direct' } });
        if (!impactDirect) {
          console.error(`  ❌ Cannot import job ${jobNo}: no valid customer found`);
          skipped++;
          continue;
        }
      }

      // Parse specifications JSON from CSV if it exists
      let csvSpecs = {};
      if (row.specifications) {
        try {
          csvSpecs = JSON.parse(row.specifications);
        } catch (e) {
          // If specifications is not valid JSON, ignore it
        }
      }

      // Build comprehensive specs JSON with all metadata
      const specs: any = {
        ...csvSpecs, // Include any nested specifications from CSV
      };

      // Add product details to specs
      if (row.size) specs.size = row.size;
      if (row.colors) specs.colors = row.colors;
      if (row.finishing) specs.finishing = row.finishing;
      if (row.bindery) specs.bindery = row.bindery;
      if (row.paper_type) specs.paperType = row.paper_type;

      // Add delivery/production info to specs
      if (row.delivery_method) specs.deliveryMethod = row.delivery_method;
      if (row.delivery_address) specs.deliveryAddress = row.delivery_address;
      if (row.notes) specs.notes = row.notes;
      if (row.start_date) specs.startDate = row.start_date;
      if (row.estimated_completion_date) specs.estimatedCompletionDate = row.estimated_completion_date;
      if (row.pickup_scheduled) specs.pickupScheduled = row.pickup_scheduled;

      // Add artwork/file info to specs
      if (row.artworkUrls) {
        try {
          specs.artworkUrls = JSON.parse(row.artworkUrls);
        } catch (e) {
          specs.artworkUrls = row.artworkUrls;
        }
      }

      // Add proof info to specs
      if (row.proof_status) specs.proofStatus = row.proof_status;
      if (row.proof_url) specs.proofUrl = row.proof_url;

      // Add sample shipment info to specs
      if (row.sample_sent_date || row.sample_tracking_number || row.sample_delivery_address || row.sample_notes) {
        specs.sampleInfo = {
          sentDate: row.sample_sent_date || null,
          trackingNumber: row.sample_tracking_number || null,
          deliveryAddress: row.sample_delivery_address || null,
          notes: row.sample_notes || null,
        };
      }

      // Add file submission info to specs
      if (row.files_submitted_at || row.files_submitted_by) {
        specs.filesInfo = {
          submittedAt: row.files_submitted_at || null,
          submittedBy: row.files_submitted_by || null,
        };
      }

      const newJob = await prisma.job.create({
        data: {
          jobNo,
          customerId: finalCustomerId,
          title: row.title || null,
          description: row.description || null,
          customerPONumber: row.customer_po_number || null,
          status: mapJobStatus(row.status),
          specs,
          sizeName: row.size || null,
          quantity: parseNumber(row.quantity),
          paperType: row.paper_type || null,
          customerTotal: parseNumber(row.total_price) || 0,
          impactMargin: 0, // Not in old data
          bradfordTotal: 0, // Not in old data
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

      if (imported % 50 === 0) {
        console.log(`  ... imported ${imported} jobs`);
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to import job ${row.job_number}:`, error.message);
      skipped++;
    }
  }

  console.log(`  ✅ Imported ${imported} jobs, skipped ${skipped}`);
}

async function importProofs() {
  console.log('\n📄 Importing Proofs...');

  const csvPath = path.join(__dirname, '../../../data/imports/proofs.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  proofs.csv not found, skipping');
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const oldJobId = row.job_id?.trim();
      if (!oldJobId) {
        skipped++;
        continue;
      }

      // Map old job ID to new job ID
      const newJobId = jobIdMap.get(oldJobId);
      if (!newJobId) {
        skipped++;
        continue;
      }

      const version = parseInt(row.version) || 1;
      const approved = row.approved === 'true';

      await prisma.proof.create({
        data: {
          jobId: newJobId,
          version,
          status: approved ? 'APPROVED' : 'PENDING',
          adminNotes: row.comments || null,
          createdAt: parseDate(row.created_at) || new Date(),
          updatedAt: parseDate(row.updated_at) || new Date(),
        },
      });

      imported++;
    } catch (error: any) {
      console.error(`  ❌ Failed to import proof for job ${row.job_id}:`, error.message);
      skipped++;
    }
  }

  console.log(`  ✅ Imported ${imported} proofs, skipped ${skipped}`);
}

async function importInvoices() {
  console.log('\n📜 Importing Invoices...');

  const csvPath = path.join(__dirname, '../../../data/imports/invoices.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  invoices.csv not found, skipping');
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  const impactDirect = await prisma.company.findUnique({ where: { id: 'impact-direct' } });
  const bradford = await prisma.company.findUnique({ where: { id: 'bradford' } });

  if (!impactDirect || !bradford) {
    console.error('  ❌ Required companies not found');
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const invoiceNo = row.invoice_number?.trim();
      const oldJobId = row.job_id?.trim();

      if (!invoiceNo) {
        skipped++;
        continue;
      }

      // Map old job ID to new job ID (job_id is optional for invoices)
      let newJobId: string | null = null;
      if (oldJobId) {
        newJobId = jobIdMap.get(oldJobId) || null;
        // If we have an old job ID but can't find mapping, skip this invoice
        if (!newJobId) {
          skipped++;
          continue;
        }
      }

      // Map invoice type to companies
      const type = row.type;
      let toCompanyId = impactDirect.id;
      let fromCompanyId = bradford.id;

      if (type === 'impact_to_customer') {
        fromCompanyId = impactDirect.id;
        toCompanyId = impactDirect.id; // Placeholder
      }

      await prisma.invoice.create({
        data: {
          invoiceNo,
          jobId: newJobId,
          toCompanyId,
          fromCompanyId,
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

async function importImpactPOs() {
  console.log('\n📦 Importing Impact Direct → Bradford POs...');

  const csvPath = path.join(__dirname, '../../../data/imports/impact_pos.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  impact_pos.csv not found, skipping');
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  const impactDirect = await prisma.company.findUnique({ where: { id: 'impact-direct' } });
  const bradford = await prisma.company.findUnique({ where: { id: 'bradford' } });

  if (!impactDirect || !bradford) {
    console.error('  ❌ Required companies not found');
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const oldJobId = row.job_id?.trim();

      if (!oldJobId) {
        skipped++;
        continue;
      }

      // Map old job ID to new job ID
      const newJobId = jobIdMap.get(oldJobId);
      if (!newJobId) {
        console.error(`  ⚠️  Job ${oldJobId} not found in map, skipping PO`);
        skipped++;
        continue;
      }

      const originalAmount = parseNumber(row.original_amount) || 0;
      const vendorAmount = parseNumber(row.vendor_amount) || 0;
      const marginAmount = parseNumber(row.margin_amount) || (originalAmount - vendorAmount);

      await prisma.purchaseOrder.create({
        data: {
          jobId: newJobId,
          originCompanyId: impactDirect.id,
          targetCompanyId: bradford.id,
          originalAmount,
          vendorAmount,
          marginAmount,
          status: row.status || 'PENDING',
          createdAt: parseDate(row.created_at) || new Date(),
          updatedAt: parseDate(row.updated_at) || new Date(),
        },
      });

      imported++;

      if (imported % 50 === 0) {
        console.log(`  ... imported ${imported} Impact POs`);
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to import Impact PO for job ${row.job_id}:`, error.message);
      skipped++;
    }
  }

  console.log(`  ✅ Imported ${imported} Impact POs, skipped ${skipped}`);
}

async function importBradfordPOs() {
  console.log('\n📦 Importing Bradford → JD Graphic POs...');

  const csvPath = path.join(__dirname, '../../../data/imports/bradford_pos.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  bradford_pos.csv not found, skipping');
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  const bradford = await prisma.company.findUnique({ where: { id: 'bradford' } });
  const jdGraphic = await prisma.company.findUnique({ where: { id: 'jd-graphic' } });

  if (!bradford || !jdGraphic) {
    console.error('  ❌ Required companies not found');
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const oldJobId = row.job_id?.trim();

      if (!oldJobId) {
        skipped++;
        continue;
      }

      // Map old job ID to new job ID
      const newJobId = jobIdMap.get(oldJobId);
      if (!newJobId) {
        console.error(`  ⚠️  Job ${oldJobId} not found in map, skipping PO`);
        skipped++;
        continue;
      }

      const originalAmount = parseNumber(row.original_amount) || 0;
      const vendorAmount = parseNumber(row.vendor_amount) || 0;
      const marginAmount = parseNumber(row.margin_amount) || (originalAmount - vendorAmount);

      await prisma.purchaseOrder.create({
        data: {
          jobId: newJobId,
          originCompanyId: bradford.id,
          targetCompanyId: jdGraphic.id,
          originalAmount,
          vendorAmount,
          marginAmount,
          status: row.status || 'PENDING',
          createdAt: parseDate(row.created_at) || new Date(),
          updatedAt: parseDate(row.updated_at) || new Date(),
        },
      });

      imported++;

      if (imported % 50 === 0) {
        console.log(`  ... imported ${imported} Bradford POs`);
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to import Bradford PO for job ${row.job_id}:`, error.message);
      skipped++;
    }
  }

  console.log(`  ✅ Imported ${imported} Bradford POs, skipped ${skipped}`);
}

async function main() {
  console.log('🚀 Starting CSV Import...\n');
  console.log('⚠️  WARNING: This will replace all existing data in the database!\n');

  try {
    // Import in order (respecting foreign keys)
    await importCompanies();
    await importCompaniesFromJobs(); // Pre-scan jobs to create customer companies
    await importUsers();
    await importJobs();
    await importProofs();
    await importInvoices();
    await importImpactPOs(); // Impact Direct → Bradford
    await importBradfordPOs(); // Bradford → JD Graphic

    console.log('\n✅ Import complete!');

    // Show summary
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.proof.count(),
      prisma.invoice.count(),
      prisma.purchaseOrder.count(),
    ]);

    console.log('\n📊 Database Summary:');
    console.log(`  Users: ${counts[0]}`);
    console.log(`  Jobs: ${counts[1]}`);
    console.log(`  Proofs: ${counts[2]}`);
    console.log(`  Invoices: ${counts[3]}`);
    console.log(`  Purchase Orders: ${counts[4]}`);

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
