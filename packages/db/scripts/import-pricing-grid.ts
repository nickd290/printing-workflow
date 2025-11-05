/**
 * Import Pricing Grid from CSV
 *
 * Parses the "Third Party Production Costs" CSV and loads pricing data into PricingRule table.
 *
 * Usage: DATABASE_URL="file:./prisma/dev.db" npx tsx packages/db/scripts/import-pricing-grid.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// CSV file path
const CSV_FILE_PATH = '/Users/nicholasdeblasio/Downloads/Third Party Production Costs.xlsx - Sheet3.csv';

interface PricingGridRow {
  sizeName: string;
  rollSize: number;

  // JD TO BRADFORD
  paperUsagePerM: number; // Paper lbs per M
  paperCostPerM: number; // Paper cost per M
  paperSellPerM: number; // Paper sell price per M (what Bradford charges)
  jdInvoicePerM: number; // JD invoice to Bradford per M

  // BRADFORD TO IMPACT
  printCPM: number; // Bradford's print CPM
  bradfordInvoicePerM: number; // Bradford invoice to Impact per M

  // IMPACT TO CUSTOMER
  impactInvoicePerM: number; // Impact invoice to customer per M (standard rate)
}

/**
 * Normalize size name to handle variations
 * e.g., "7 1/4 x 16 3/8" → "7 1/4 x 16 3/8"
 *      "9 3/4 x 22 1/8" → "9 3/4 x 22 1/8"
 */
function normalizeSizeName(sizeName: string): string {
  return sizeName.trim();
}

/**
 * Parse dollar amount string to number
 * "$15.46" → 15.46
 */
function parseDollar(value: string): number {
  if (!value || value === '') return 0;
  return parseFloat(value.replace(/[$,]/g, ''));
}

/**
 * Parse number string to number
 */
function parseNumber(value: string): number {
  if (!value || value === '') return 0;
  return parseFloat(value.replace(/,/g, ''));
}

/**
 * Parse CSV file and extract pricing data
 */
function parseCSV(filePath: string): PricingGridRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);

  console.log(`📄 Parsing CSV: ${filePath}`);
  console.log(`   Total lines: ${lines.length}\n`);

  // Find section boundaries
  let jdToBradfordStart = -1;
  let bradfordToImpactStart = -1;
  let impactToCustomerStart = -1;

  lines.forEach((line, index) => {
    if (line.includes('JD TO BRADFORD')) jdToBradfordStart = index;
    if (line.includes('BRADFORD TO IMPACT')) bradfordToImpactStart = index;
    if (line.includes('Impact to Customer')) impactToCustomerStart = index;
  });

  console.log(`   JD TO BRADFORD section starts at line ${jdToBradfordStart}`);
  console.log(`   BRADFORD TO IMPACT section starts at line ${bradfordToImpactStart}`);
  console.log(`   Impact to Customer section starts at line ${impactToCustomerStart}\n`);

  // Parse each section
  const jdToBradford = parseSectionJdToBradford(lines, jdToBradfordStart);
  const bradfordToImpact = parseSectionBradfordToImpact(lines, bradfordToImpactStart);
  const impactToCustomer = parseSectionImpactToCustomer(lines, impactToCustomerStart);

  // Merge data by size name
  const merged = new Map<string, PricingGridRow>();

  jdToBradford.forEach(row => {
    merged.set(row.sizeName, { ...row });
  });

  bradfordToImpact.forEach(row => {
    const existing = merged.get(row.sizeName);
    if (existing) {
      Object.assign(existing, {
        printCPM: row.printCPM,
        bradfordInvoicePerM: row.bradfordInvoicePerM,
      });
    }
  });

  impactToCustomer.forEach(row => {
    const existing = merged.get(row.sizeName);
    if (existing) {
      Object.assign(existing, {
        impactInvoicePerM: row.impactInvoicePerM,
      });
    }
  });

  return Array.from(merged.values());
}

/**
 * Parse "JD TO BRADFORD" section
 */
function parseSectionJdToBradford(lines: string[], startIndex: number): Partial<PricingGridRow>[] {
  const rows: Partial<PricingGridRow>[] = [];

  // Skip header row (startIndex + 1)
  for (let i = startIndex + 2; i < lines.length; i++) {
    const line = lines[i];

    // Stop if we hit next section or empty line with comma-only
    if (line.includes('BRADFORD TO IMPACT') || line === ',,,,,' || line === ',,,,,') {
      break;
    }

    const cols = line.split(',');

    // Skip if not enough columns or size name is empty
    if (cols.length < 6 || !cols[0] || cols[0].trim() === '') {
      continue;
    }

    const sizeName = normalizeSizeName(cols[0]);
    const rollSize = parseNumber(cols[1]);
    const paperUsagePerM = parseNumber(cols[2]);
    const paperCostPerM = parseDollar(cols[3]);
    const paperSellPerM = parseDollar(cols[4]);
    const jdInvoicePerM = parseDollar(cols[5]);

    rows.push({
      sizeName,
      rollSize,
      paperUsagePerM,
      paperCostPerM,
      paperSellPerM,
      jdInvoicePerM,
      printCPM: 0, // Will be filled from next section
      bradfordInvoicePerM: 0,
      impactInvoicePerM: 0,
    });
  }

  console.log(`   ✓ Parsed ${rows.length} rows from JD TO BRADFORD section`);
  return rows as PricingGridRow[];
}

/**
 * Parse "BRADFORD TO IMPACT" section
 */
function parseSectionBradfordToImpact(lines: string[], startIndex: number): Partial<PricingGridRow>[] {
  const rows: Partial<PricingGridRow>[] = [];

  // Skip header row (startIndex + 1)
  for (let i = startIndex + 2; i < lines.length; i++) {
    const line = lines[i];

    // Stop if we hit next section or empty line
    if (line.includes('Impact to Customer') || line === ',,,,,' || line === ',,,,,') {
      break;
    }

    const cols = line.split(',');

    // Skip if not enough columns or size name is empty
    if (cols.length < 6 || !cols[0] || cols[0].trim() === '') {
      continue;
    }

    const sizeName = normalizeSizeName(cols[0]);
    const printCPM = parseDollar(cols[2]);
    const bradfordInvoicePerM = parseDollar(cols[5]);

    rows.push({
      sizeName,
      printCPM,
      bradfordInvoicePerM,
    });
  }

  console.log(`   ✓ Parsed ${rows.length} rows from BRADFORD TO IMPACT section`);
  return rows;
}

/**
 * Parse "Impact to Customer" section
 */
function parseSectionImpactToCustomer(lines: string[], startIndex: number): Partial<PricingGridRow>[] {
  const rows: Partial<PricingGridRow>[] = [];

  // Skip header row (startIndex + 1)
  for (let i = startIndex + 2; i < lines.length; i++) {
    const line = lines[i];

    // Stop if empty line or end of file
    if (!line || line === ',,,,,' || line === ',,,,,') {
      break;
    }

    const cols = line.split(',');

    // Skip if not enough columns or size name is empty
    if (cols.length < 6 || !cols[0] || cols[0].trim() === '') {
      continue;
    }

    const sizeName = normalizeSizeName(cols[0]);
    const impactInvoicePerM = parseDollar(cols[5]);

    rows.push({
      sizeName,
      impactInvoicePerM,
    });
  }

  console.log(`   ✓ Parsed ${rows.length} rows from Impact to Customer section`);
  return rows;
}

/**
 * Calculate paper markup percentage
 */
function calculatePaperMarkup(cost: number, sell: number): number {
  if (cost === 0) return 0;
  return ((sell - cost) / cost) * 100;
}

/**
 * Main import function
 */
async function importPricingGrid() {
  console.log('🚀 Starting Pricing Grid Import\n');
  console.log('========================================\n');

  // Check if CSV file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_FILE_PATH}`);
    process.exit(1);
  }

  // Parse CSV
  const rows = parseCSV(CSV_FILE_PATH);

  console.log('\n========================================');
  console.log(`📊 Found ${rows.length} pricing rules to import\n`);

  // Import each row
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const paperMarkupPercent = calculatePaperMarkup(row.paperCostPerM, row.paperSellPerM);
      const paperCostPerLb = row.paperUsagePerM > 0 ? row.paperCostPerM / row.paperUsagePerM : 0;

      // Upsert pricing rule
      const existing = await prisma.pricingRule.findUnique({
        where: { sizeName: row.sizeName },
      });

      const data = {
        sizeName: row.sizeName,
        baseCPM: row.impactInvoicePerM, // Use customer rate as base
        printCPM: row.printCPM,
        jdInvoicePerM: row.jdInvoicePerM,
        paperWeightPer1000: row.paperUsagePerM,
        paperCostPerLb,
        paperCPM: row.paperCostPerM,
        paperChargedCPM: row.paperSellPerM,
        paperMarkupPercent,
        rollSize: row.rollSize,
        bradfordInvoicePerM: row.bradfordInvoicePerM,
        impactInvoicePerM: row.impactInvoicePerM,
        isActive: true,
      };

      if (existing) {
        await prisma.pricingRule.update({
          where: { id: existing.id },
          data,
        });
        updated++;
        console.log(`   ✓ Updated: ${row.sizeName} (Customer CPM: $${row.impactInvoicePerM.toFixed(2)})`);
      } else {
        await prisma.pricingRule.create({
          data,
        });
        created++;
        console.log(`   ✓ Created: ${row.sizeName} (Customer CPM: $${row.impactInvoicePerM.toFixed(2)})`);
      }
    } catch (error: any) {
      errors++;
      console.error(`   ❌ Error processing ${row.sizeName}:`, error.message);
    }
  }

  console.log('\n========================================');
  console.log('✅ Import Complete!\n');
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors:  ${errors}`);
  console.log('========================================\n');
}

// Run import
importPricingGrid()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
