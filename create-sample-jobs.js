// Create sample jobs for testing

const API_URL = 'http://localhost:3001';

async function createJob(customerId, description, total) {
  const response = await fetch(`${API_URL}/api/jobs/direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId,
      specs: { description },
      customerTotal: total,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create job: ${error}`);
  }

  return response.json();
}

async function main() {
  console.log('🎨 Creating sample jobs...\n');

  try {
    // JJSA Jobs
    const job1 = await createJob('jjsa', 'Business Cards - 1000 qty, 16pt Cardstock, 4/4 Full Color', 250);
    console.log(`✅ Created JJSA job: ${job1.jobNo}`);

    const job2 = await createJob('jjsa', 'Brochures - 500 qty, Tri-fold, Glossy finish', 450);
    console.log(`✅ Created JJSA job: ${job2.jobNo}`);

    // Ballantine Jobs
    const job3 = await createJob('ballantine', 'Letterhead - 2000 sheets, Premium paper', 380);
    console.log(`✅ Created Ballantine job: ${job3.jobNo}`);

    const job4 = await createJob('ballantine', 'Postcards - 1000 qty, 4x6 UV Coated', 220);
    console.log(`✅ Created Ballantine job: ${job4.jobNo}`);

    const job5 = await createJob('jjsa', 'Banners - 2x vinyl banners, full color', 175);
    console.log(`✅ Created JJSA job: ${job5.jobNo}`);

    console.log('\n🎉 All sample jobs created successfully!');
    console.log('\n📊 Summary:');
    console.log('  - 3 JJSA jobs');
    console.log('  - 2 Ballantine jobs');
    console.log('\n🌐 View them at: http://localhost:5174/jobs');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
