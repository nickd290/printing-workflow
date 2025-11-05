import { readFile } from 'fs/promises';
import pg from 'pg';

const { Client } = pg;

async function importSQL() {
  console.log('🚀 Starting SQL import to Railway PostgreSQL\n');

  // Railway connection details
  const client = new Client({
    host: 'maglev.proxy.rlwy.net',
    port: 10871,
    user: 'postgres',
    password: 'ptcLMcsOlOlstUBbmvOSaSlYYRVdmFSV',
    database: 'railway',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📡 Connecting to Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Read the SQL file
    console.log('📖 Reading SQL file...');
    const sqlContent = await readFile('/tmp/railway-import.sql', 'utf-8');
    console.log(`✅ Read ${sqlContent.split('\n').length} lines\n`);

    // Execute the SQL
    console.log('⚡ Executing SQL import...');
    await client.query(sqlContent);
    console.log('✅ SQL executed successfully\n');

    // Verify the data
    console.log('🔍 Verifying imported data:\n');

    const jobsResult = await client.query('SELECT COUNT(*) FROM "Job"');
    const posResult = await client.query('SELECT COUNT(*) FROM "PurchaseOrder"');
    const invoicesResult = await client.query('SELECT COUNT(*) FROM "Invoice"');
    const companiesResult = await client.query('SELECT COUNT(*) FROM "Company"');
    const usersResult = await client.query('SELECT COUNT(*) FROM "User"');

    console.log(`   Companies: ${companiesResult.rows[0].count}`);
    console.log(`   Users: ${usersResult.rows[0].count}`);
    console.log(`   Jobs: ${jobsResult.rows[0].count}`);
    console.log(`   Purchase Orders: ${posResult.rows[0].count}`);
    console.log(`   Invoices: ${invoicesResult.rows[0].count}`);
    console.log('');

    // Verify expected counts
    const expectedJobs = 23;
    const expectedPOs = 21;
    const expectedInvoices = 18;

    if (jobsResult.rows[0].count === expectedJobs.toString() &&
        posResult.rows[0].count === expectedPOs.toString() &&
        invoicesResult.rows[0].count === expectedInvoices.toString()) {
      console.log('✅ All data migrated successfully!');
    } else {
      console.log('⚠️  Data counts do not match expected values:');
      console.log(`   Expected Jobs: ${expectedJobs}, Got: ${jobsResult.rows[0].count}`);
      console.log(`   Expected POs: ${expectedPOs}, Got: ${posResult.rows[0].count}`);
      console.log(`   Expected Invoices: ${expectedInvoices}, Got: ${invoicesResult.rows[0].count}`);
    }

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n👋 Disconnected from Railway PostgreSQL');
  }
}

importSQL()
  .then(() => {
    console.log('\n🎉 Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration error:', error);
    process.exit(1);
  });
