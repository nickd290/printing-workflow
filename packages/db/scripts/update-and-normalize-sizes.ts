import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping of PO numbers to sizes for jobs that need updates
const poToSizeMap: Record<string, string> = {
  '34299-51200.31': '17 x 6',
  '34385-51200.28': '26 x 9.75',
  '34384-51200.32': '26 x 9.75',
  '34386-51200.24': '26 x 9.75',
  '34383-51200.30': '26 x 9.75',
  '34412.51200.23': '26 x 9.75',
  '34412.51200.33': '26 x 9.75',
  '44277': '8.5 x 11',
  '34386-51200.27': '26 x 9.75',
};

/**
 * Convert fractional measurements to decimals
 * Examples: "9-3/4" → 9.75, "1/2" → 0.5, "16-3/8" → 16.375
 */
function convertFractionToDecimal(str: string): string {
  // Handle cases like "9-3/4" or "16-3/8"
  const wholeAndFractionMatch = str.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (wholeAndFractionMatch) {
    const whole = parseInt(wholeAndFractionMatch[1]);
    const numerator = parseInt(wholeAndFractionMatch[2]);
    const denominator = parseInt(wholeAndFractionMatch[3]);
    return (whole + numerator / denominator).toString();
  }

  // Handle cases like "3/4" or "1/2"
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1]);
    const denominator = parseInt(fractionMatch[2]);
    return (numerator / denominator).toString();
  }

  // No fraction found, return as-is
  return str;
}

/**
 * Normalize size to format: "W x H" (lowercase x with spaces, decimals)
 * Examples:
 * - "26x9.75" → "26 x 9.75"
 * - "26 × 9-3/4" → "26 x 9.75"
 * - "6x11" → "6 x 11"
 * - "8.5x11" → "8.5 x 11"
 */
function normalizeSize(size: string | null): string | null {
  if (!size || size.trim() === '') return null;

  // Remove extra whitespace and convert to lowercase for parsing
  let normalized = size.trim();

  // Replace × (multiplication symbol) with x
  normalized = normalized.replace(/×/g, 'x');

  // Split by 'x' or 'X'
  const parts = normalized.split(/\s*[xX]\s*/);

  if (parts.length !== 2) {
    // Can't parse, return original trimmed
    console.warn(`  ⚠️  Unable to normalize size: "${size}"`);
    return size.trim();
  }

  // Convert fractions to decimals in both parts
  const width = convertFractionToDecimal(parts[0].trim());
  const height = convertFractionToDecimal(parts[1].trim());

  // Format as "W x H"
  return `${width} x ${height}`;
}

async function updateAndNormalizeSizes() {
  console.log('📏 Starting Size Update & Normalization...\n');

  try {
    // Fetch all jobs
    const jobs = await prisma.job.findMany({
      select: {
        id: true,
        jobNo: true,
        customerPONumber: true,
        sizeName: true,
        specs: true,
      },
    });

    console.log(`Found ${jobs.length} jobs to process\n`);

    let newSizeCount = 0;
    let normalizedCount = 0;
    let skippedCount = 0;

    const updates: Array<{
      jobNo: string;
      po: string | null;
      before: string | null;
      after: string | null;
      action: 'new' | 'normalized' | 'skipped';
    }> = [];

    for (const job of jobs) {
      const po = job.customerPONumber?.trim();
      let currentSize = job.sizeName;
      let newSize: string | null = null;
      let action: 'new' | 'normalized' | 'skipped' = 'skipped';

      // Step 1: Check if this job needs a NEW size (from PO map)
      if (po && poToSizeMap[po]) {
        newSize = poToSizeMap[po];
        action = 'new';
        newSizeCount++;
      }
      // Step 2: If no new size, normalize existing size
      else if (currentSize && currentSize.trim() !== '') {
        const normalized = normalizeSize(currentSize);
        if (normalized && normalized !== currentSize) {
          newSize = normalized;
          action = 'normalized';
          normalizedCount++;
        } else {
          // Already normalized or couldn't normalize
          skippedCount++;
        }
      } else {
        // No size at all and not in our map
        skippedCount++;
      }

      // Update if we have a new size
      if (newSize) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            sizeName: newSize,
            // Also update specs.size for consistency
            specs: {
              ...(job.specs as any),
              size: newSize,
            },
          },
        });

        updates.push({
          jobNo: job.jobNo,
          po,
          before: currentSize,
          after: newSize,
          action,
        });

        const emoji = action === 'new' ? '✨' : '🔧';
        const label = action === 'new' ? 'NEW' : 'NORMALIZED';
        console.log(`${emoji} ${label} ${job.jobNo} (PO: ${po || 'N/A'})`);
        console.log(`   "${currentSize || '(empty)'}" → "${newSize}"`);
        console.log('');
      }
    }

    console.log('\n📊 Update Summary:');
    console.log(`   ✨ New sizes added: ${newSizeCount}`);
    console.log(`   🔧 Sizes normalized: ${normalizedCount}`);
    console.log(`   ⏭️  Jobs skipped (no changes): ${skippedCount}`);
    console.log(`   📦 Total jobs processed: ${jobs.length}`);

    if (updates.length > 0) {
      console.log('\n📝 Detailed Changes:');
      console.log('─'.repeat(100));
      console.log(
        'Job Number'.padEnd(20) +
        'Customer PO'.padEnd(25) +
        'Action'.padEnd(12) +
        'Size Change'
      );
      console.log('─'.repeat(100));

      for (const update of updates) {
        const actionLabel = update.action === 'new' ? '✨ NEW' : '🔧 NORMALIZE';
        console.log(
          update.jobNo.padEnd(20) +
          (update.po || 'N/A').padEnd(25) +
          actionLabel.padEnd(12) +
          `"${update.before || '(empty)'}" → "${update.after}"`
        );
      }
      console.log('─'.repeat(100));
    }

  } catch (error) {
    console.error('💥 Update failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateAndNormalizeSizes()
  .then(() => {
    console.log('\n✅ Update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  });
