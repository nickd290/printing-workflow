import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface SpreadsheetJob {
  jobNumber: string;
  projectDescription: string;
  quantity: number;
  pageCount: number;
  flatSize: string;
  calculatedPaperUsageLbs: number;
  status: string;
}

interface Discrepancy {
  jobNumber: string;
  inSpreadsheet: boolean;
  inDatabase: boolean;
  spreadsheetQuantity: number | null;
  databaseQuantity: number | null;
  spreadsheetPaperLbs: number | null;
  databasePaperLbs: number | null;
  quantityDiff: number | null;
  paperDiff: number | null;
  paperDiffPercent: number | null;
  pageCount: number | null;
  description: string;
}

function parseCSV(filePath: string): SpreadsheetJob[] {
  const content = fs.readFileSync(filePath, 'utf-8');

  const jobs: SpreadsheetJob[] = [];
  const lines: string[] = [];

  // First, split into proper records handling multi-line quoted fields
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }

  // Add last line if any
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  // Skip header
  const dataLines = lines.slice(1);

  for (const line of dataLines) {
    // Parse CSV fields
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }

    // Add last field
    fields.push(currentField.trim());

    if (fields.length < 7) continue;

    const jobNumber = fields[0];
    const projectDescription = fields[1].replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const quantityStr = fields[2].replace(/,/g, '');
    const pageCountStr = fields[3];
    const flatSize = fields[4];
    const paperUsageStr = fields[5];
    const status = fields[6];

    // Only add if we have a valid job number (starts with digits or XX-XXXXX format)
    if (jobNumber && /^\d{2}-\d+$/.test(jobNumber)) {
      jobs.push({
        jobNumber,
        projectDescription,
        quantity: parseInt(quantityStr) || 0,
        pageCount: parseInt(pageCountStr) || 0,
        flatSize,
        calculatedPaperUsageLbs: parseFloat(paperUsageStr) || 0,
        status
      });
    }
  }

  return jobs;
}

async function reconcileInventory() {
  console.log('🔍 Starting inventory reconciliation...\n');

  // 1. Load spreadsheet data
  const csvPath = path.join(process.env.HOME!, 'Desktop', 'TSP_Paper_Usage_Calculated.csv');
  console.log(`📊 Loading spreadsheet: ${csvPath}`);
  const spreadsheetJobs = parseCSV(csvPath);
  console.log(`   Found ${spreadsheetJobs.length} jobs in spreadsheet\n`);

  // 2. Load database jobs
  console.log('💾 Loading jobs from database...');
  const dbJobs = await prisma.job.findMany({
    select: {
      jobNo: true,
      quantity: true,
      paperWeightTotal: true,
      paperWeightPer1000: true,
      title: true,
      description: true,
      specs: true
    }
  });
  console.log(`   Found ${dbJobs.length} jobs in database\n`);

  // 3. Create lookup maps
  const spreadsheetMap = new Map<string, SpreadsheetJob>();
  for (const job of spreadsheetJobs) {
    spreadsheetMap.set(job.jobNumber, job);
  }

  const dbMap = new Map<string, typeof dbJobs[0]>();
  for (const job of dbJobs) {
    dbMap.set(job.jobNo, job);
  }

  // 4. Find discrepancies
  const discrepancies: Discrepancy[] = [];

  // Check all jobs from spreadsheet
  for (const [jobNumber, ssJob] of spreadsheetMap) {
    const dbJob = dbMap.get(jobNumber);

    if (!dbJob) {
      // Job in spreadsheet but not in database
      discrepancies.push({
        jobNumber,
        inSpreadsheet: true,
        inDatabase: false,
        spreadsheetQuantity: ssJob.quantity,
        databaseQuantity: null,
        spreadsheetPaperLbs: ssJob.calculatedPaperUsageLbs,
        databasePaperLbs: null,
        quantityDiff: null,
        paperDiff: null,
        paperDiffPercent: null,
        pageCount: ssJob.pageCount,
        description: ssJob.projectDescription
      });
    } else {
      // Job exists in both - compare
      const dbQuantity = dbJob.quantity || 0;
      const dbPaperLbs = dbJob.paperWeightTotal ? parseFloat(dbJob.paperWeightTotal.toString()) : 0;

      const quantityDiff = dbQuantity - ssJob.quantity;
      const paperDiff = dbPaperLbs - ssJob.calculatedPaperUsageLbs;
      const paperDiffPercent = ssJob.calculatedPaperUsageLbs > 0
        ? (paperDiff / ssJob.calculatedPaperUsageLbs) * 100
        : 0;

      // Only record if there's a significant discrepancy (>5% or >10 lbs)
      if (Math.abs(paperDiffPercent) > 5 || Math.abs(paperDiff) > 10 || Math.abs(quantityDiff) > 0) {
        discrepancies.push({
          jobNumber,
          inSpreadsheet: true,
          inDatabase: true,
          spreadsheetQuantity: ssJob.quantity,
          databaseQuantity: dbQuantity,
          spreadsheetPaperLbs: ssJob.calculatedPaperUsageLbs,
          databasePaperLbs: dbPaperLbs,
          quantityDiff,
          paperDiff,
          paperDiffPercent,
          pageCount: ssJob.pageCount,
          description: ssJob.projectDescription
        });
      }
    }
  }

  // Check for jobs in database but not in spreadsheet
  for (const [jobNumber, dbJob] of dbMap) {
    if (!spreadsheetMap.has(jobNumber)) {
      const dbQuantity = dbJob.quantity || 0;
      const dbPaperLbs = dbJob.paperWeightTotal ? parseFloat(dbJob.paperWeightTotal.toString()) : 0;

      discrepancies.push({
        jobNumber,
        inSpreadsheet: false,
        inDatabase: true,
        spreadsheetQuantity: null,
        databaseQuantity: dbQuantity,
        spreadsheetPaperLbs: null,
        databasePaperLbs: dbPaperLbs,
        quantityDiff: null,
        paperDiff: null,
        paperDiffPercent: null,
        pageCount: null,
        description: dbJob.title || dbJob.description || 'N/A'
      });
    }
  }

  // 5. Generate report
  console.log('=' .repeat(120));
  console.log('INVENTORY RECONCILIATION REPORT');
  console.log('='.repeat(120));
  console.log();

  // Summary
  const totalDiscrepancies = discrepancies.length;
  const missingFromDB = discrepancies.filter(d => !d.inDatabase).length;
  const missingFromSpreadsheet = discrepancies.filter(d => !d.inSpreadsheet).length;
  const mismatchedData = discrepancies.filter(d => d.inDatabase && d.inSpreadsheet).length;

  console.log('📋 SUMMARY');
  console.log('-'.repeat(120));
  console.log(`Total Jobs in Spreadsheet: ${spreadsheetJobs.length}`);
  console.log(`Total Jobs in Database: ${dbJobs.length}`);
  console.log(`Total Discrepancies Found: ${totalDiscrepancies}`);
  console.log(`  - Jobs in spreadsheet but not in database: ${missingFromDB}`);
  console.log(`  - Jobs in database but not in spreadsheet: ${missingFromSpreadsheet}`);
  console.log(`  - Jobs with mismatched data: ${mismatchedData}`);
  console.log();

  // Calculate totals
  const totalSpreadsheetPaper = spreadsheetJobs.reduce((sum, j) => sum + j.calculatedPaperUsageLbs, 0);
  const totalDatabasePaper = dbJobs.reduce((sum, j) => {
    const paperLbs = j.paperWeightTotal ? parseFloat(j.paperWeightTotal.toString()) : 0;
    return sum + paperLbs;
  }, 0);
  const totalPaperDiff = totalDatabasePaper - totalSpreadsheetPaper;

  console.log(`Total Paper Usage (Spreadsheet): ${totalSpreadsheetPaper.toFixed(2)} lbs`);
  console.log(`Total Paper Usage (Database): ${totalDatabasePaper.toFixed(2)} lbs`);
  console.log(`Total Discrepancy: ${totalPaperDiff > 0 ? '+' : ''}${totalPaperDiff.toFixed(2)} lbs (${((totalPaperDiff / totalSpreadsheetPaper) * 100).toFixed(2)}%)`);
  console.log();

  // Detailed discrepancies
  if (missingFromDB > 0) {
    console.log('🚨 JOBS IN SPREADSHEET BUT NOT IN DATABASE');
    console.log('-'.repeat(120));
    const missing = discrepancies.filter(d => !d.inDatabase);
    for (const disc of missing) {
      console.log(`Job: ${disc.jobNumber}`);
      console.log(`  Description: ${disc.description.substring(0, 80)}`);
      console.log(`  Quantity: ${disc.spreadsheetQuantity?.toLocaleString()}`);
      console.log(`  Page Count: ${disc.pageCount}`);
      console.log(`  Paper Usage: ${disc.spreadsheetPaperLbs?.toFixed(2)} lbs`);
      console.log();
    }
  }

  if (missingFromSpreadsheet > 0) {
    console.log('🚨 JOBS IN DATABASE BUT NOT IN SPREADSHEET');
    console.log('-'.repeat(120));
    const missing = discrepancies.filter(d => !d.inSpreadsheet);
    for (const disc of missing) {
      console.log(`Job: ${disc.jobNumber}`);
      console.log(`  Description: ${disc.description.substring(0, 80)}`);
      console.log(`  Quantity: ${disc.databaseQuantity?.toLocaleString()}`);
      console.log(`  Paper Usage: ${disc.databasePaperLbs?.toFixed(2)} lbs`);
      console.log();
    }
  }

  if (mismatchedData > 0) {
    console.log('⚠️  JOBS WITH MISMATCHED DATA');
    console.log('-'.repeat(120));
    const mismatched = discrepancies
      .filter(d => d.inDatabase && d.inSpreadsheet)
      .sort((a, b) => Math.abs(b.paperDiff!) - Math.abs(a.paperDiff!));

    for (const disc of mismatched) {
      console.log(`Job: ${disc.jobNumber}`);
      console.log(`  Description: ${disc.description.substring(0, 80)}`);

      if (disc.quantityDiff !== 0) {
        console.log(`  ⚠️  Quantity Mismatch:`);
        console.log(`      Spreadsheet: ${disc.spreadsheetQuantity?.toLocaleString()}`);
        console.log(`      Database: ${disc.databaseQuantity?.toLocaleString()}`);
        console.log(`      Difference: ${disc.quantityDiff! > 0 ? '+' : ''}${disc.quantityDiff?.toLocaleString()}`);
      }

      if (disc.paperDiff && Math.abs(disc.paperDiff) > 0.01) {
        console.log(`  ⚠️  Paper Usage Mismatch:`);
        console.log(`      Spreadsheet: ${disc.spreadsheetPaperLbs?.toFixed(2)} lbs`);
        console.log(`      Database: ${disc.databasePaperLbs?.toFixed(2)} lbs`);
        console.log(`      Difference: ${disc.paperDiff > 0 ? '+' : ''}${disc.paperDiff.toFixed(2)} lbs (${disc.paperDiffPercent?.toFixed(2)}%)`);
      }

      console.log();
    }
  }

  // Save detailed report to file
  const reportPath = path.join(process.env.HOME!, 'Desktop', 'inventory-reconciliation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    summary: {
      totalJobsSpreadsheet: spreadsheetJobs.length,
      totalJobsDatabase: dbJobs.length,
      totalDiscrepancies,
      missingFromDB,
      missingFromSpreadsheet,
      mismatchedData,
      totalSpreadsheetPaper,
      totalDatabasePaper,
      totalPaperDiff,
      totalPaperDiffPercent: (totalPaperDiff / totalSpreadsheetPaper) * 100
    },
    discrepancies
  }, null, 2));

  console.log('✅ Detailed report saved to:', reportPath);
  console.log();
}

reconcileInventory()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
