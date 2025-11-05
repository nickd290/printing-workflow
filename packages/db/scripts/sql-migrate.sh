#!/bin/bash
set -e

echo "🚀 Starting SQL-based migration: SQLite → PostgreSQL"
echo ""

# Export from SQLite
echo "📤 Step 1: Exporting data from SQLite..."
sqlite3 ./prisma/dev.db <<'SQL' > /tmp/printing-data.sql
.mode insert
SELECT 'DELETE FROM "ProofApproval";' UNION ALL
SELECT 'DELETE FROM "Proof";' UNION ALL
SELECT 'DELETE FROM "PurchaseOrder";' UNION ALL
SELECT 'DELETE FROM "Invoice";' UNION ALL
SELECT 'DELETE FROM "ShipmentRecipient";' UNION ALL
SELECT 'DELETE FROM "Shipment";' UNION ALL
SELECT 'DELETE FROM "SampleShipment";' UNION ALL
SELECT 'DELETE FROM "Notification";' UNION ALL
SELECT 'DELETE FROM "File";' UNION ALL
SELECT 'DELETE FROM "Job";' UNION ALL
SELECT 'DELETE FROM "Quote";' UNION ALL
SELECT 'DELETE FROM "QuoteRequest";' UNION ALL
SELECT 'DELETE FROM "PaperTransaction";' UNION ALL
SELECT 'DELETE FROM "PaperInventory";' UNION ALL
SELECT 'DELETE FROM "PricingRule";' UNION ALL
SELECT 'DELETE FROM "WebhookEvent";' UNION ALL
SELECT 'DELETE FROM "Account";' UNION ALL
SELECT 'DELETE FROM "Contact";' UNION ALL
SELECT 'DELETE FROM "User";' UNION ALL
SELECT 'DELETE FROM "Company";';

.mode insert Company
SELECT * FROM Company;

.mode insert User
SELECT * FROM User;

.mode insert Contact
SELECT * FROM Contact;

.mode insert Account
SELECT * FROM Account;

.mode insert QuoteRequest
SELECT * FROM QuoteRequest;

.mode insert Quote
SELECT * FROM Quote;

.mode insert Job
SELECT * FROM Job;

.mode insert File
SELECT * FROM File;

.mode insert Proof
SELECT * FROM Proof;

.mode insert ProofApproval
SELECT * FROM ProofApproval;

.mode insert PurchaseOrder
SELECT * FROM PurchaseOrder;

.mode insert Invoice
SELECT * FROM Invoice;

.mode insert Shipment
SELECT * FROM Shipment;

.mode insert ShipmentRecipient
SELECT * FROM ShipmentRecipient;

.mode insert SampleShipment
SELECT * FROM SampleShipment;

.mode insert Notification
SELECT * FROM Notification;

.mode insert WebhookEvent
SELECT * FROM WebhookEvent;

.mode insert PaperInventory
SELECT * FROM PaperInventory;

.mode insert PaperTransaction
SELECT * FROM PaperTransaction;

.mode insert PricingRule
SELECT * FROM PricingRule;
SQL

echo "✅ Data exported to /tmp/printing-data.sql"
echo ""

# Convert SQLite format to PostgreSQL format
echo "🔄 Step 2: Converting to PostgreSQL format..."
sed -i.bak \
  -e 's/INSERT INTO /INSERT INTO public."/g' \
  -e 's/ VALUES(/" VALUES(/g' \
  -e 's/BOOLEAN NOT NULL DEFAULT false/BOOLEAN NOT NULL DEFAULT false/g' \
  -e 's/BOOLEAN NOT NULL DEFAULT true/BOOLEAN NOT NULL DEFAULT true/g' \
  /tmp/printing-data.sql

echo "✅ Format converted"
echo ""

# Import to PostgreSQL
echo "📥 Step 3: Importing to Railway PostgreSQL..."
PGPASSWORD="${RAILWAY_PGPASSWORD}" psql -h "${RAILWAY_PGHOST}" -p "${RAILWAY_PGPORT}" -U "${RAILWAY_PGUSER}" -d "${RAILWAY_PGDATABASE}" < /tmp/printing-data.sql

echo ""
echo "✅ Migration complete!"
echo ""
echo "📊 Verifying record counts..."
PGPASSWORD="${RAILWAY_PGPASSWORD}" psql -h "${RAILWAY_PGHOST}" -p "${RAILWAY_PGPORT}" -U "${RAILWAY_PGUSER}" -d "${RAILWAY_PGDATABASE}" -c "SELECT 'Companies' as table_name, COUNT(*) FROM \"Company\" UNION ALL SELECT 'Users', COUNT(*) FROM \"User\" UNION ALL SELECT 'Jobs', COUNT(*) FROM \"Job\" UNION ALL SELECT 'Purchase Orders', COUNT(*) FROM \"PurchaseOrder\" UNION ALL SELECT 'Invoices', COUNT(*) FROM \"Invoice\";"
