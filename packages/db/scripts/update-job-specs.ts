import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface UpdateStats {
  jobNo: string;
  customerPO: string | null;
  sizeUpdated: boolean;
  sizeBefore: string | null;
  sizeAfter: string | null;
  quantityUpdated: boolean;
  quantityBefore: number | null;
  quantityAfter: number | null;
}

async function updateJobSpecs() {
  console.log('📥 Starting Job Specs Update (size & quantity)...\n');

  try {
    // Fetch all jobs
    const jobs = await prisma.job.findMany({
      select: {
        id: true,
        jobNo: true,
        customerPONumber: true,
        sizeName: true,
        quantity: true,
        specs: true,
      },
    });

    console.log(`Found ${jobs.length} jobs to process\n`);

    const updates: UpdateStats[] = [];
    let sizeUpdateCount = 0;
    let quantityUpdateCount = 0;
    let skippedCount = 0;

    for (const job of jobs) {
      const specs = job.specs as any;
      let needsUpdate = false;
      let newSizeName = job.sizeName;
      let newQuantity = job.quantity;

      const updateStat: UpdateStats = {
        jobNo: job.jobNo,
        customerPO: job.customerPONumber,
        sizeUpdated: false,
        sizeBefore: job.sizeName,
        sizeAfter: job.sizeName,
        quantityUpdated: false,
        quantityBefore: job.quantity,
        quantityAfter: job.quantity,
      };

      // Check if we should update sizeName from specs.size
      if (specs && specs.size && typeof specs.size === 'string' && specs.size.trim() !== '') {
        // Only update if current sizeName is null or empty
        if (!job.sizeName || job.sizeName.trim() === '') {
          newSizeName = specs.size.trim();
          needsUpdate = true;
          updateStat.sizeUpdated = true;
          updateStat.sizeAfter = newSizeName;
          sizeUpdateCount++;
        }
      }

      // Check if we should update quantity from specs.quantity
      if (specs && specs.quantity !== null && specs.quantity !== undefined) {
        const specsQuantity = typeof specs.quantity === 'number'
          ? specs.quantity
          : parseInt(specs.quantity);

        // Only update if current quantity is null or 0
        if (!job.quantity || job.quantity === 0) {
          newQuantity = specsQuantity;
          needsUpdate = true;
          updateStat.quantityUpdated = true;
          updateStat.quantityAfter = newQuantity;
          quantityUpdateCount++;
        }
      }

      if (needsUpdate) {
        // Perform the update
        await prisma.job.update({
          where: { id: job.id },
          data: {
            sizeName: newSizeName,
            quantity: newQuantity,
          },
        });

        updates.push(updateStat);

        console.log(`✅ Updated ${job.jobNo} (PO: ${job.customerPONumber || 'N/A'})`);
        if (updateStat.sizeUpdated) {
          console.log(`   Size: "${updateStat.sizeBefore || '(empty)'}" → "${updateStat.sizeAfter}"`);
        }
        if (updateStat.quantityUpdated) {
          console.log(`   Quantity: ${updateStat.quantityBefore || 0} → ${updateStat.quantityAfter}`);
        }
        console.log('');
      } else {
        skippedCount++;
      }
    }

    console.log('\n📊 Update Summary:');
    console.log(`   ✅ Size fields updated: ${sizeUpdateCount}`);
    console.log(`   ✅ Quantity fields updated: ${quantityUpdateCount}`);
    console.log(`   ⏭️  Jobs skipped (no updates needed): ${skippedCount}`);
    console.log(`   📦 Total jobs processed: ${jobs.length}`);

    if (updates.length > 0) {
      console.log('\n📝 Detailed Changes:');
      console.log('─'.repeat(80));
      console.log('Job Number'.padEnd(20) + 'Customer PO'.padEnd(25) + 'Changes');
      console.log('─'.repeat(80));

      for (const update of updates) {
        const changes: string[] = [];
        if (update.sizeUpdated) {
          changes.push(`Size: ${update.sizeAfter}`);
        }
        if (update.quantityUpdated) {
          changes.push(`Qty: ${update.quantityAfter}`);
        }

        console.log(
          update.jobNo.padEnd(20) +
          (update.customerPO || 'N/A').padEnd(25) +
          changes.join(', ')
        );
      }
      console.log('─'.repeat(80));
    }

  } catch (error) {
    console.error('💥 Update failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateJobSpecs()
  .then(() => {
    console.log('\n✅ Update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  });
