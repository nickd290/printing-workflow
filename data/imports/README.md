# CSV Data Import Guide

## 📁 Folder Structure

Drop your CSV files into these folders:

```
data/imports/
├── companies/       # Customer, broker, and manufacturer companies
├── jobs/           # Job data (main production jobs)
├── users/          # User accounts
├── contacts/       # Company contacts
├── purchase-orders/ # Purchase orders between companies
└── invoices/       # Invoices
```

## 📝 CSV File Formats

### Companies (`companies/*.csv`)
Required columns:
- `name` - Company name
- `type` - One of: customer, broker, manufacturer
- `email` - Contact email
- `phone` - Phone number (optional)
- `address` - Full address (optional)

Example:
```csv
name,type,email,phone,address
"Acme Corp",customer,orders@acme.com,555-1234,"123 Main St, City, ST 12345"
```

### Jobs (`jobs/*.csv`)
Required columns:
- `jobNo` - Job number (e.g., J-2025-000001)
- `customerName` - Customer company name (must exist in companies)
- `customerPONumber` - Customer PO number
- `status` - One of: PENDING, IN_PRODUCTION, READY_FOR_PROOF, PROOF_APPROVED, COMPLETED
- `customerTotal` - Total amount charged to customer (decimal)

Optional columns:
- `impactMargin` - Impact Direct margin (decimal)
- `bradfordTotal` - Bradford total (decimal)
- `quantity` - Quantity
- `sizeName` - Size (e.g., "8.5 x 11")
- `deliveryDate` - Delivery date (YYYY-MM-DD format)
- `product` - Product type (e.g., "Flyers", "Business Cards")
- `paper` - Paper specification
- `colors` - Color specification (e.g., "4/4")
- `finishing` - Finishing details

Example:
```csv
jobNo,customerName,customerPONumber,status,customerTotal,impactMargin,bradfordTotal,quantity,product,paper,colors
"J-2025-000001","Acme Corp","ACME-PO-001",PENDING,450.00,90.00,360.00,5000,"Business Cards","14pt Uncoated","4/4"
```

### Users (`users/*.csv`)
Required columns:
- `email` - User email (unique)
- `name` - Full name
- `role` - One of: BROKER_ADMIN, BRADFORD_ADMIN, MANAGER, CUSTOMER
- `companyName` - Associated company name (must exist in companies)

Example:
```csv
email,name,role,companyName
admin@acme.com,"John Doe",CUSTOMER,"Acme Corp"
```

### Contacts (`contacts/*.csv`)
Required columns:
- `companyName` - Company name (must exist in companies)
- `name` - Contact name
- `email` - Contact email
- `phone` - Phone number (optional)
- `isPrimary` - true/false (optional, defaults to false)

Example:
```csv
companyName,name,email,phone,isPrimary
"Acme Corp","Jane Smith",jane@acme.com,555-5678,true
```

## 🚀 How to Import

1. **Drop your CSV files** into the appropriate folders above

2. **Run the import script**:
   ```bash
   cd /Users/nicholasdeblasio/printing-workflow
   npm run import:csv
   ```

3. **Check the output** - The script will tell you:
   - How many records were imported
   - Any errors or skipped records
   - Which files were processed

## 📋 Import Order

The script automatically imports in the correct order:
1. Companies (needed first for relationships)
2. Users (needs companies)
3. Contacts (needs companies)
4. Jobs (needs companies)
5. Purchase Orders (needs jobs)
6. Invoices (needs jobs)

## ⚠️ Important Notes

- **Backup first**: The import will ADD to existing data (not replace)
- **CSV format**: Use UTF-8 encoding
- **Dates**: Use YYYY-MM-DD format (e.g., 2025-01-15)
- **Decimals**: Use standard decimal notation (e.g., 123.45)
- **Required fields**: Make sure all required columns have values
- **Relationships**: Companies must exist before importing jobs/users/contacts

## 🔄 Fresh Start (Replace All Data)

If you want to completely replace the existing data:

```bash
# 1. Clear the database
cd /Users/nicholasdeblasio/printing-workflow/packages/db
DATABASE_URL="file:/Users/nicholasdeblasio/printing-workflow/packages/db/prisma/dev.db" npx prisma db push --force-reset

# 2. Run the import
cd /Users/nicholasdeblasio/printing-workflow
npm run import:csv
```

## 🆘 Troubleshooting

**"Company not found" error**
- Make sure you've imported companies first
- Check that company names match exactly (case-sensitive)

**"Invalid status" error**
- Status must be one of: PENDING, IN_PRODUCTION, READY_FOR_PROOF, PROOF_APPROVED, COMPLETED

**"Duplicate email" error**
- Each user email must be unique
- Check for duplicate emails in your CSV

**File encoding issues**
- Save your CSV as UTF-8 encoding
- Avoid special characters that might cause encoding issues
