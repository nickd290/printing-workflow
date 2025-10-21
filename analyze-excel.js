const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const filePath = '/Users/nicholasdeblasio/Desktop/invoices (1).xlsx';
console.log(`\n📊 Analyzing Excel file: ${filePath}\n`);

try {
  const workbook = XLSX.readFile(filePath);

  console.log(`Found ${workbook.SheetNames.length} sheets:\n`);

  workbook.SheetNames.forEach((sheetName, index) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Sheet ${index + 1}: "${sheetName}"`);
    console.log('='.repeat(60));

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length === 0) {
      console.log('  ⚠️  Empty sheet');
      return;
    }

    // Get headers (first row)
    const headers = data[0];
    console.log(`\nColumns (${headers.length} total):`);
    headers.forEach((header, i) => {
      console.log(`  ${i + 1}. ${header}`);
    });

    // Show row count
    console.log(`\nTotal rows: ${data.length - 1} (excluding header)`);

    // Show first 3 data rows as examples
    if (data.length > 1) {
      console.log(`\nSample data (first 3 rows):`);
      for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
        console.log(`\n  Row ${i}:`);
        const row = data[i];
        headers.forEach((header, colIndex) => {
          const value = row[colIndex];
          if (value !== undefined && value !== null && value !== '') {
            console.log(`    ${header}: ${value}`);
          }
        });
      }
    }
  });

  console.log(`\n${'='.repeat(60)}\n`);
  console.log('✅ Analysis complete!\n');

} catch (error) {
  console.error('❌ Error reading Excel file:', error.message);
  process.exit(1);
}
