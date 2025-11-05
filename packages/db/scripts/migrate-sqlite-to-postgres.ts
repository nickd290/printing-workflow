import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const TEMP_DATA_FILE = path.join(process.cwd(), '.migration-data.json');

async function exportData() {
  console.log('📤 Step 1: Exporting data from SQLite...\n');

  const sourceDb = new PrismaClient();

  try {
    await sourceDb.$connect();
    console.log('✅ Connected to SQLite database\n');

    const data = {
      companies: await sourceDb.company.findMany(),
      users: await sourceDb.user.findMany(),
      contacts: await sourceDb.contact.findMany(),
      accounts: await sourceDb.account.findMany(),
      quoteRequests: await sourceDb.quoteRequest.findMany(),
      quotes: await sourceDb.quote.findMany(),
      jobs: await sourceDb.job.findMany(),
      files: await sourceDb.file.findMany(),
      proofs: await sourceDb.proof.findMany(),
      proofApprovals: await sourceDb.proofApproval.findMany(),
      purchaseOrders: await sourceDb.purchaseOrder.findMany(),
      invoices: await sourceDb.invoice.findMany(),
      shipments: await sourceDb.shipment.findMany(),
      shipmentRecipients: await sourceDb.shipmentRecipient.findMany(),
      sampleShipments: await sourceDb.sampleShipment.findMany(),
      notifications: await sourceDb.notification.findMany(),
      webhookEvents: await sourceDb.webhookEvent.findMany(),
      paperInventory: await sourceDb.paperInventory.findMany(),
      paperTransactions: await sourceDb.paperTransaction.findMany(),
      pricingRules: await sourceDb.pricingRule.findMany(),
    };

    console.log('📊 Data exported:');
    console.log(`   Companies: ${data.companies.length}`);
    console.log(`   Users: ${data.users.length}`);
    console.log(`   Contacts: ${data.contacts.length}`);
    console.log(`   Accounts: ${data.accounts.length}`);
    console.log(`   Quote Requests: ${data.quoteRequests.length}`);
    console.log(`   Quotes: ${data.quotes.length}`);
    console.log(`   Jobs: ${data.jobs.length}`);
    console.log(`   Files: ${data.files.length}`);
    console.log(`   Proofs: ${data.proofs.length}`);
    console.log(`   Proof Approvals: ${data.proofApprovals.length}`);
    console.log(`   Purchase Orders: ${data.purchaseOrders.length}`);
    console.log(`   Invoices: ${data.invoices.length}`);
    console.log(`   Shipments: ${data.shipments.length}`);
    console.log(`   Shipment Recipients: ${data.shipmentRecipients.length}`);
    console.log(`   Sample Shipments: ${data.sampleShipments.length}`);
    console.log(`   Notifications: ${data.notifications.length}`);
    console.log(`   Webhook Events: ${data.webhookEvents.length}`);
    console.log(`   Paper Inventory: ${data.paperInventory.length}`);
    console.log(`   Paper Transactions: ${data.paperTransactions.length}`);
    console.log(`   Pricing Rules: ${data.pricingRules.length}\n`);

    await fs.writeFile(TEMP_DATA_FILE, JSON.stringify(data, null, 2));
    console.log('✅ Data saved to temporary file\n');

    return data;
  } finally {
    await sourceDb.$disconnect();
  }
}

async function importData(data: any) {
  console.log('📥 Step 2: Importing data to PostgreSQL...\n');

  const targetDb = new PrismaClient();

  try {
    await targetDb.$connect();
    console.log('✅ Connected to PostgreSQL database\n');

    // Phase 0: Clear target database
    console.log('🗑️  Clearing target database...\n');
    await targetDb.proofApproval.deleteMany();
    await targetDb.proof.deleteMany();
    await targetDb.purchaseOrder.deleteMany();
    await targetDb.invoice.deleteMany();
    await targetDb.shipmentRecipient.deleteMany();
    await targetDb.shipment.deleteMany();
    await targetDb.sampleShipment.deleteMany();
    await targetDb.notification.deleteMany();
    await targetDb.file.deleteMany();
    await targetDb.job.deleteMany();
    await targetDb.quote.deleteMany();
    await targetDb.quoteRequest.deleteMany();
    await targetDb.paperTransaction.deleteMany();
    await targetDb.paperInventory.deleteMany();
    await targetDb.pricingRule.deleteMany();
    await targetDb.webhookEvent.deleteMany();
    await targetDb.account.deleteMany();
    await targetDb.contact.deleteMany();
    await targetDb.user.deleteMany();
    await targetDb.company.deleteMany();
    console.log('✅ Target database cleared\n');

    // Phase 1: Core entities
    console.log('📦 Phase 1: Migrating core entities...\n');
    for (const company of data.companies) {
      await targetDb.company.create({ data: company });
    }
    console.log(`   ✅ Migrated ${data.companies.length} companies`);

    for (const user of data.users) {
      await targetDb.user.create({ data: user });
    }
    console.log(`   ✅ Migrated ${data.users.length} users`);

    for (const contact of data.contacts) {
      await targetDb.contact.create({ data: contact });
    }
    console.log(`   ✅ Migrated ${data.contacts.length} contacts`);

    for (const account of data.accounts) {
      await targetDb.account.create({ data: account });
    }
    console.log(`   ✅ Migrated ${data.accounts.length} accounts\n`);

    // Phase 2: Quote system
    console.log('💰 Phase 2: Migrating quotes...\n');
    for (const quoteRequest of data.quoteRequests) {
      await targetDb.quoteRequest.create({ data: quoteRequest });
    }
    console.log(`   ✅ Migrated ${data.quoteRequests.length} quote requests`);

    for (const quote of data.quotes) {
      await targetDb.quote.create({ data: quote });
    }
    console.log(`   ✅ Migrated ${data.quotes.length} quotes\n`);

    // Phase 3: Jobs & Files
    console.log('📋 Phase 3: Migrating jobs and files...\n');
    for (const job of data.jobs) {
      await targetDb.job.create({ data: job });
    }
    console.log(`   ✅ Migrated ${data.jobs.length} jobs`);

    for (const file of data.files) {
      await targetDb.file.create({ data: file });
    }
    console.log(`   ✅ Migrated ${data.files.length} files\n`);

    // Phase 4: Proofs
    console.log('📄 Phase 4: Migrating proofs...\n');
    for (const proof of data.proofs) {
      await targetDb.proof.create({ data: proof });
    }
    console.log(`   ✅ Migrated ${data.proofs.length} proofs`);

    for (const approval of data.proofApprovals) {
      await targetDb.proofApproval.create({ data: approval });
    }
    console.log(`   ✅ Migrated ${data.proofApprovals.length} proof approvals\n`);

    // Phase 5: Orders & Invoices
    console.log('💵 Phase 5: Migrating orders and invoices...\n');
    for (const po of data.purchaseOrders) {
      await targetDb.purchaseOrder.create({ data: po });
    }
    console.log(`   ✅ Migrated ${data.purchaseOrders.length} purchase orders`);

    for (const invoice of data.invoices) {
      await targetDb.invoice.create({ data: invoice });
    }
    console.log(`   ✅ Migrated ${data.invoices.length} invoices\n`);

    // Phase 6: Shipping
    console.log('🚚 Phase 6: Migrating shipments...\n');
    for (const shipment of data.shipments) {
      await targetDb.shipment.create({ data: shipment });
    }
    console.log(`   ✅ Migrated ${data.shipments.length} shipments`);

    for (const recipient of data.shipmentRecipients) {
      await targetDb.shipmentRecipient.create({ data: recipient });
    }
    console.log(`   ✅ Migrated ${data.shipmentRecipients.length} shipment recipients`);

    for (const sample of data.sampleShipments) {
      await targetDb.sampleShipment.create({ data: sample });
    }
    console.log(`   ✅ Migrated ${data.sampleShipments.length} sample shipments\n`);

    // Phase 7: Supporting data
    console.log('📊 Phase 7: Migrating supporting data...\n');
    for (const notification of data.notifications) {
      await targetDb.notification.create({ data: notification });
    }
    console.log(`   ✅ Migrated ${data.notifications.length} notifications`);

    for (const webhook of data.webhookEvents) {
      await targetDb.webhookEvent.create({ data: webhook });
    }
    console.log(`   ✅ Migrated ${data.webhookEvents.length} webhook events`);

    for (const paper of data.paperInventory) {
      await targetDb.paperInventory.create({ data: paper });
    }
    console.log(`   ✅ Migrated ${data.paperInventory.length} paper inventory items`);

    for (const transaction of data.paperTransactions) {
      await targetDb.paperTransaction.create({ data: transaction });
    }
    console.log(`   ✅ Migrated ${data.paperTransactions.length} paper transactions`);

    for (const rule of data.pricingRules) {
      await targetDb.pricingRule.create({ data: rule });
    }
    console.log(`   ✅ Migrated ${data.pricingRules.length} pricing rules\n`);

    // Final Summary
    console.log('📊 Import Summary:\n');
    console.log('Core Entities:');
    console.log(`   Companies: ${data.companies.length}`);
    console.log(`   Users: ${data.users.length}`);
    console.log(`   Contacts: ${data.contacts.length}`);
    console.log(`   Accounts: ${data.accounts.length}`);
    console.log('');
    console.log('Business Data:');
    console.log(`   Quote Requests: ${data.quoteRequests.length}`);
    console.log(`   Quotes: ${data.quotes.length}`);
    console.log(`   Jobs: ${data.jobs.length}`);
    console.log(`   Files: ${data.files.length}`);
    console.log('');
    console.log('Workflow:');
    console.log(`   Proofs: ${data.proofs.length}`);
    console.log(`   Proof Approvals: ${data.proofApprovals.length}`);
    console.log(`   Purchase Orders: ${data.purchaseOrders.length}`);
    console.log(`   Invoices: ${data.invoices.length}`);
    console.log('');
    console.log('Shipping:');
    console.log(`   Shipments: ${data.shipments.length}`);
    console.log(`   Shipment Recipients: ${data.shipmentRecipients.length}`);
    console.log(`   Sample Shipments: ${data.sampleShipments.length}`);
    console.log('');
    console.log('Supporting:');
    console.log(`   Notifications: ${data.notifications.length}`);
    console.log(`   Webhook Events: ${data.webhookEvents.length}`);
    console.log(`   Paper Inventory: ${data.paperInventory.length}`);
    console.log(`   Paper Transactions: ${data.paperTransactions.length}`);
    console.log(`   Pricing Rules: ${data.pricingRules.length}`);
    console.log('');

    console.log('✅ Import completed successfully!');

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await targetDb.$disconnect();
  }
}

async function migrate() {
  console.log('🚀 Starting database migration: SQLite → PostgreSQL\n');

  try {
    let data;

    // Check if we already have exported data
    try {
      const existingData = await fs.readFile(TEMP_DATA_FILE, 'utf-8');
      data = JSON.parse(existingData);
      console.log('📂 Found existing exported data, skipping export step\n');
    } catch {
      // No existing data, need to export
      data = await exportData();
    }

    // Step 2: Import to PostgreSQL
    await importData(data);

    // Don't cleanup - leave the JSON file in case we need to re-run
    console.log('💾 Data file saved at:', TEMP_DATA_FILE);
    console.log('   (You can delete this manually after verifying the migration)\n');

    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

migrate()
  .then(() => {
    console.log('\n🎉 All done! Your Railway database now has your production data.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration error:', error);
    process.exit(1);
  });
