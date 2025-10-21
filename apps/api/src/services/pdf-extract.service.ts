/**
 * Get pdf-parse module with dynamic import for ESM compatibility
 */
async function getPdfParse() {
  const pdfParseModule = await import('pdf-parse');
  return pdfParseModule.default || pdfParseModule;
}

/**
 * Extract PO number from PDF using text extraction
 * Supports common PO number formats
 */
export async function extractPONumber(pdfBuffer: Buffer): Promise<string | null> {
  try {
    // Parse PDF to extract text
    const pdfParse = await getPdfParse();
    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    // Common PO number patterns (customize based on Bradford's format)
    const patterns = [
      /PO\s*#?\s*:?\s*([A-Z0-9-]+)/i,                    // PO# ABC-12345, PO #: ABC-12345
      /Purchase\s+Order\s*#?\s*:?\s*([A-Z0-9-]+)/i,      // Purchase Order # ABC-12345
      /P\.?O\.?\s*#?\s*:?\s*([A-Z0-9-]+)/i,              // P.O. # ABC-12345
      /Order\s*Number\s*:?\s*([A-Z0-9-]+)/i,             // Order Number: ABC-12345
      /PO\s+Number\s*:?\s*([A-Z0-9-]+)/i,                // PO Number: ABC-12345
      /\bBRA-\d{4,}/i,                                    // Bradford specific: BRA-1234
      /\b[A-Z]{2,4}-\d{4,}/,                             // General format: ABC-1234 or ABCD-12345
    ];

    // Try each pattern
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const poNumber = match[1].trim().toUpperCase();
        console.log(`✅ Extracted PO# from PDF: ${poNumber}`);
        return poNumber;
      }
    }

    // If no match found with capture group, try finding Bradford-specific format
    const bradfordMatch = text.match(/\bBRA-\d{4,}/i);
    if (bradfordMatch) {
      const poNumber = bradfordMatch[0].trim().toUpperCase();
      console.log(`✅ Extracted Bradford PO# from PDF: ${poNumber}`);
      return poNumber;
    }

    console.log('⚠️ No PO number found in PDF text');
    console.log('PDF Text Preview:', text.substring(0, 500)); // Log first 500 chars for debugging
    return null;
  } catch (error) {
    console.error('Error extracting PO number from PDF:', error);
    return null;
  }
}

/**
 * Extract multiple potential PO numbers from PDF
 * Returns an array of all matches for user selection
 */
export async function extractAllPONumbers(pdfBuffer: Buffer): Promise<string[]> {
  try {
    const pdfParse = await getPdfParse();
    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    const poNumbers = new Set<string>();

    // Try all patterns and collect matches
    const patterns = [
      /PO\s*#?\s*:?\s*([A-Z0-9-]+)/gi,
      /Purchase\s+Order\s*#?\s*:?\s*([A-Z0-9-]+)/gi,
      /P\.?O\.?\s*#?\s*:?\s*([A-Z0-9-]+)/gi,
      /Order\s*Number\s*:?\s*([A-Z0-9-]+)/gi,
      /\b[A-Z]{2,4}-\d{4,}/g,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const poNumber = (match[1] || match[0]).trim().toUpperCase();
        // Filter out common false positives
        if (poNumber.length >= 4 && poNumber.length <= 50) {
          poNumbers.add(poNumber);
        }
      }
    }

    return Array.from(poNumbers);
  } catch (error) {
    console.error('Error extracting PO numbers from PDF:', error);
    return [];
  }
}

/**
 * Validate PO number format
 * Customize based on your business rules
 */
export function validatePONumber(poNumber: string): boolean {
  if (!poNumber || typeof poNumber !== 'string') {
    return false;
  }

  // Basic validation: must be alphanumeric with optional hyphens/underscores
  const validFormat = /^[A-Z0-9][A-Z0-9-_]{2,49}$/i;
  return validFormat.test(poNumber.trim());
}

/**
 * Normalize PO number to consistent format
 */
export function normalizePONumber(poNumber: string): string {
  return poNumber.trim().toUpperCase();
}
