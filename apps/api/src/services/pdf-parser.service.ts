import { CUSTOMER_CODE_TO_ID, COMPANY_IDS } from '@printing-workflow/shared';
import { parseTextWithAI } from '../lib/openai.js';

export interface ParsedBradfordPO {
  customerCode: string; // JJSG or BALSG
  customerId: string; // jjsa or ballantine
  amount: number;
  poNumber?: string;
  description?: string;
  rawText: string;
}

/**
 * Parse a Bradford PO PDF to extract key information
 *
 * Looks for:
 * - Customer codes: JJSG or BALSG in the subject/text
 * - Dollar amounts: $XXX.XX or XXX.XX
 * - PO numbers: various formats
 */
export async function parseBradfordPO(buffer: Buffer): Promise<ParsedBradfordPO> {
  // Parse PDF to text using pdf-parse v2 API (class-based)
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const text = result.text;
  await parser.destroy(); // Clean up resources

  // Find customer code (JJSG or BALSG)
  const jjsgMatch = text.match(/JJSG/i);
  const balsgMatch = text.match(/BALSG/i);

  let customerCode: string;
  let customerId: string;

  if (jjsgMatch) {
    customerCode = 'JJSG';
    customerId = CUSTOMER_CODE_TO_ID['JJSG'];
  } else if (balsgMatch) {
    customerCode = 'BALSG';
    customerId = CUSTOMER_CODE_TO_ID['BALSG'];
  } else {
    throw new Error('Could not identify customer code (JJSG or BALSG) in PDF');
  }

  // Find dollar amount - look for patterns like $1,234.56 or 1234.56
  const amountMatches = text.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g);

  let amount: number | undefined;
  if (amountMatches && amountMatches.length > 0) {
    // Take the largest amount found (likely to be the total)
    const amounts = amountMatches.map((match) => {
      const cleaned = match.replace(/[$,\s]/g, '');
      return parseFloat(cleaned);
    });
    amount = Math.max(...amounts);
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Could not find valid dollar amount in PDF');
  }

  // Try to find PO number - look for common patterns
  const poPatterns = [
    /PO[\s#]*(\d+)/i,
    /Purchase Order[\s#]*(\d+)/i,
    /Order[\s#]*(\d+)/i,
    /P\.O\.[\s#]*(\d+)/i,
  ];

  let poNumber: string | undefined;
  for (const pattern of poPatterns) {
    const match = text.match(pattern);
    if (match) {
      poNumber = match[1];
      break;
    }
  }

  // Try to extract a brief description (first 100 chars of cleaned text)
  const description = text
    .split('\n')
    .filter((line) => line.trim().length > 10)
    .slice(0, 3)
    .join(' ')
    .substring(0, 100)
    .trim();

  return {
    customerCode,
    customerId,
    amount,
    poNumber,
    description: description || 'Bradford PO',
    rawText: text,
  };
}

/**
 * Create a PO from Bradford to JD Graphic based on parsed PDF data
 */
export async function createPOFromParsedPDF(
  parsed: ParsedBradfordPO,
  jobId?: string
): Promise<{
  originCompanyId: string;
  targetCompanyId: string;
  jobId?: string;
  originalAmount: number;
  vendorAmount: number;
  marginAmount: number;
  externalRef?: string;
}> {
  return {
    originCompanyId: COMPANY_IDS.BRADFORD,
    targetCompanyId: COMPANY_IDS.JD_GRAPHIC,
    jobId,
    originalAmount: parsed.amount,
    vendorAmount: parsed.amount, // Bradford passes full amount to JD
    marginAmount: 0, // Bradford keeps the margin
    externalRef: parsed.poNumber
      ? `Bradford-${parsed.customerCode}-${parsed.poNumber}`
      : `Bradford-${parsed.customerCode}`,
  };
}

export interface SampleRecipient {
  quantity: number;
  recipientName: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface ParsedCustomerPO {
  description?: string;
  paper?: string;
  flatSize?: string;
  foldedSize?: string;
  colors?: string;
  finishing?: string;
  total?: number;
  poNumber?: string;
  deliveryDate?: string;
  samples?: string;
  quantity?: number;
  requiredArtworkCount?: number;  // Number of artwork files customer should upload
  requiredDataFileCount?: number; // Number of data files customer should upload
  orderDate?: string;              // Date the order was placed
  pickupDate?: string;             // ALG pick up date or ship date
  poolDate?: string;               // ALG pool date (often the final delivery date)
  sampleInstructions?: string;     // Full sample distribution instructions
  sampleRecipients?: SampleRecipient[]; // Structured sample distribution data
  rawText: string;
}

interface ParsedFilenameData {
  customerCode?: string;
  projectName?: string;
  year?: string;
  size?: string;
  productType?: string;
  quantity?: number;
  date?: string;
  version?: number;
}

/**
 * Parse filename to extract job information
 * Handles formats like: CE.Halloween.2025.6x9.postcard.8.25.25 (2).pdf
 *
 * Format patterns:
 * - CustomerCode.ProjectName.Year.Size.Type.Date.pdf
 * - CustomerCode.ProjectName.Size.Quantity.Type.Date.pdf
 * - Variations with dashes, underscores, or mixed delimiters
 */
function parseFilename(filename: string): ParsedFilenameData {
  console.log('📄 Parsing filename:', filename);

  // Remove .pdf extension and any parenthetical version numbers
  let cleanName = filename.replace(/\.pdf$/i, '');

  // Extract version number if present (e.g., "(2)" or " (2)")
  const versionMatch = cleanName.match(/\s*\((\d+)\)$/);
  const version = versionMatch ? parseInt(versionMatch[1]) : undefined;
  cleanName = cleanName.replace(/\s*\(\d+\)$/, '');

  // Split by dots (main delimiter)
  const parts = cleanName.split('.');

  if (parts.length < 2) {
    console.log('⚠️  Filename has too few parts, returning minimal data');
    return {};
  }

  const result: ParsedFilenameData = { version };

  // First part is usually customer code (2-4 letters)
  if (parts[0].length <= 4 && /^[A-Z]{2,4}$/i.test(parts[0])) {
    result.customerCode = parts[0].toUpperCase();
  }

  // Look for size pattern (e.g., 6x9, 8.5x11, 4x6)
  const sizePattern = /^(\d+\.?\d*)\s*x\s*(\d+\.?\d*)$/i;
  let sizeIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    const match = parts[i].match(sizePattern);
    if (match) {
      result.size = `${match[1]} x ${match[2]}`; // Normalize format
      sizeIndex = i;
      break;
    }
  }

  // Look for quantity (5+ digit numbers or formats like 50k, 100K)
  const quantityPattern = /^(\d{5,})$|^(\d+)[kK]$/;
  for (const part of parts) {
    const match = part.match(quantityPattern);
    if (match) {
      if (match[1]) {
        result.quantity = parseInt(match[1]);
      } else if (match[2]) {
        result.quantity = parseInt(match[2]) * 1000;
      }
      break;
    }
  }

  // Look for year (4-digit number starting with 20)
  for (const part of parts) {
    if (/^20\d{2}$/.test(part)) {
      result.year = part;
      break;
    }
  }

  // Look for product type keywords
  const productTypes = ['postcard', 'brochure', 'flyer', 'card', 'booklet', 'mailer', 'letter', 'envelope', 'poster'];
  for (const part of parts) {
    if (productTypes.includes(part.toLowerCase())) {
      result.productType = part.toLowerCase();
      break;
    }
  }

  // Try to parse date from remaining parts (look for patterns like 8.25.25, 08-25-25, etc.)
  const datePatterns = [
    /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/, // 8.25.25 or 08.25.2025
    /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/,   // 8-25-25 or 08-25-2025
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,     // 2025-08-25
  ];

  for (const part of parts) {
    for (const pattern of datePatterns) {
      const match = part.match(pattern);
      if (match) {
        // Convert to YYYY-MM-DD format
        if (pattern === datePatterns[2]) {
          // Already in YYYY-MM-DD
          result.date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else {
          // MM.DD.YY or MM-DD-YY format
          const month = match[1].padStart(2, '0');
          const day = match[2].padStart(2, '0');
          let year = match[3];
          // Convert 2-digit year to 4-digit
          if (year.length === 2) {
            year = `20${year}`;
          }
          result.date = `${year}-${month}-${day}`;
        }
        break;
      }
    }
    if (result.date) break;
  }

  // Build project name from parts between customer code and size/type/date
  // Typically: CustomerCode.ProjectName.Year.Size...
  const projectParts: string[] = [];
  for (let i = 1; i < parts.length && i < sizeIndex; i++) {
    // Skip year, quantity, and product type
    if (parts[i] !== result.year &&
        !quantityPattern.test(parts[i]) &&
        !productTypes.includes(parts[i].toLowerCase()) &&
        !datePatterns.some(p => p.test(parts[i]))) {
      projectParts.push(parts[i]);
    }
  }

  if (projectParts.length > 0) {
    result.projectName = projectParts.join(' ');
  }

  console.log('📄 Parsed filename data:', JSON.stringify(result, null, 2));
  return result;
}

export interface ParsedBradfordCustomerPO {
  poNumber?: string;
  componentId?: string;
  division?: string;
  buyer?: string;
  quantityOrdered?: number;
  shipTo?: string;
  envelope?: string;
  vendor?: string;
  newReprint?: string;
  reprintInvoice?: string;
  overallSize?: string;
  paperType?: string;
  componentCPM?: string;
  foldedSize?: string;
  paperLbs?: string;
  sampleDistribution?: string;
  vendorNotes?: string;
  orderDate?: string;
  fileDue?: string;
  shipDate?: string;
  rawText: string;
}

/**
 * Parse Bradford PO format with specific fields
 */
async function parseBradfordCustomerPOFormat(text: string): Promise<ParsedBradfordCustomerPO> {
  try {
    const prompt = `You are a printing industry expert analyzing a Bradford purchase order.

Extract the following information from the PO text:

- poNumber: PO Number (e.g., "1227419")
- componentId: Component ID (e.g., "BALSG - 2025-314062")
- division: Division field
- buyer: Buyer name
- quantityOrdered: Quantity as a number
- shipTo: Ship To address (e.g., "FOB JD Graphic")
- envelope: Envelope specification
- vendor: Vendor name (usually "J.D. Graphic")
- newReprint: New/Reprint status
- reprintInvoice: Reprint Invoice# if applicable
- overallSize: Overall Size/dimensions
- paperType: Paper Type (e.g., "93# Coated Matte")
- componentCPM: Component CPM cost (e.g., "$49.18")
- foldedSize: Folded Size
- paperLbs: Paper weight (e.g., "0#")
- sampleDistribution: Sample distribution info
- vendorNotes: Additional instructions or notes
- orderDate: Order date in YYYY-MM-DD format
- fileDue: File due date in YYYY-MM-DD format
- shipDate: Ship date in YYYY-MM-DD format

If any field cannot be found, set it to null.
Return ONLY the JSON object with these exact field names.`;

    const schema = {
      type: 'object',
      properties: {
        poNumber: { type: ['string', 'null'] },
        componentId: { type: ['string', 'null'] },
        division: { type: ['string', 'null'] },
        buyer: { type: ['string', 'null'] },
        quantityOrdered: { type: ['number', 'null'] },
        shipTo: { type: ['string', 'null'] },
        envelope: { type: ['string', 'null'] },
        vendor: { type: ['string', 'null'] },
        newReprint: { type: ['string', 'null'] },
        reprintInvoice: { type: ['string', 'null'] },
        overallSize: { type: ['string', 'null'] },
        paperType: { type: ['string', 'null'] },
        componentCPM: { type: ['string', 'null'] },
        foldedSize: { type: ['string', 'null'] },
        paperLbs: { type: ['string', 'null'] },
        sampleDistribution: { type: ['string', 'null'] },
        vendorNotes: { type: ['string', 'null'] },
        orderDate: { type: ['string', 'null'] },
        fileDue: { type: ['string', 'null'] },
        shipDate: { type: ['string', 'null'] },
      },
      required: ['poNumber', 'componentId', 'division', 'buyer', 'quantityOrdered', 'shipTo', 'envelope', 'vendor', 'newReprint', 'reprintInvoice', 'overallSize', 'paperType', 'componentCPM', 'foldedSize', 'paperLbs', 'sampleDistribution', 'vendorNotes', 'orderDate', 'fileDue', 'shipDate'],
      additionalProperties: false,
    };

    const parsed = await parseTextWithAI<ParsedBradfordCustomerPO>(text, prompt, schema);

    return {
      ...parsed,
      rawText: text,
    };
  } catch (error: any) {
    console.warn('OpenAI parsing failed for Bradford PO, returning raw text:', error.message);
    return {
      rawText: text,
    };
  }
}

/**
 * Parse a Customer PO (from JJSA or Ballantine) to extract job details
 *
 * Uses OpenAI GPT-4o to intelligently extract structured data from the PO text.
 * Falls back to regex-based parsing if OpenAI is not available.
 *
 * Optionally accepts a filename to extract initial data before PDF parsing.
 * PDF content takes priority over filename data when conflicts occur.
 *
 * NOTE: This is for customer POs only, NOT Bradford POs.
 * Bradford POs are handled separately via parseBradfordPO().
 */
export async function parseCustomerPO(buffer: Buffer, filename?: string): Promise<ParsedCustomerPO> {
  console.log('🔄 parseCustomerPO called');
  console.log('  - Buffer size:', buffer.length);
  console.log('  - Filename:', filename || '(no filename provided)');

  // Parse filename first if provided
  let filenameData: ParsedFilenameData = {};
  if (filename) {
    try {
      console.log('📝 Parsing filename...');
      filenameData = parseFilename(filename);
      console.log('📝 Filename parsed successfully:', JSON.stringify(filenameData, null, 2));
    } catch (error: any) {
      console.error('⚠️  Filename parsing failed (non-fatal):', error.message);
      // Continue anyway - filename parsing is optional
    }
  }

  // Try to parse as PDF first, fall back to plain text
  let text: string;

  try {
    // Use pdf-parse v2 API (class-based)
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    text = result.text;
    await parser.destroy(); // Clean up resources
    console.log('📄 PDF parsed successfully, extracted text length:', text.length);
    console.log('📄 First 500 chars:', text.substring(0, 500));
  } catch (error: any) {
    // If PDF parsing fails, try as plain text
    console.error('❌ PDF parsing error:', error.message);
    console.log('Trying as plain text...');
    text = buffer.toString('utf-8');
    console.log('📄 Plain text length:', text.length);
    console.log('📄 First 500 chars:', text.substring(0, 500));
  }

  // Check if we got PDF binary data instead of text
  if (text.startsWith('%PDF') || text.includes('endobj') || text.includes('stream')) {
    console.warn('⚠️  Got PDF binary data instead of extracted text');
    console.warn('⚠️  PDF text extraction may have failed');
    console.warn('⚠️  Text sample:', text.substring(0, 200));

    // Try to find any readable text in the PDF binary
    const readableText = text.split(/[\r\n]+/)
      .filter(line => {
        // Filter out binary lines and PDF structures
        return !line.includes('%PDF') &&
               !line.includes('endobj') &&
               !line.includes('stream') &&
               !line.match(/^[0-9]+ [0-9]+ obj/) &&
               line.length > 10 &&
               line.match(/[a-zA-Z]{3,}/);  // Has at least some readable words
      })
      .join('\n');

    if (readableText.length > 50) {
      console.log('✓ Found some readable text in PDF:', readableText.substring(0, 300));
      text = readableText;
    } else {
      throw new Error('Failed to extract text from PDF. The PDF may be encrypted, use complex encoding, or require OCR.');
    }
  }

  try {
    // Use OpenAI for intelligent parsing (customer PO only)
    console.log('🤖 Sending to OpenAI for parsing...');
    console.log('🤖 Text length:', text.length);

    // Build filename context for the prompt
    let filenameContext = '';
    if (filename) {
      filenameContext = `\n\nThe filename is: "${filename}"`;
      if (Object.keys(filenameData).length > 0) {
        filenameContext += `\nFrom the filename, we extracted: ${JSON.stringify(filenameData)}`;
      }
      filenameContext += '\nConsider both the filename and PDF content, but PDF content is more reliable and should take priority.';
    }

    const prompt = `You are a printing industry expert analyzing a purchase order (PO) from a customer.${filenameContext}

IMPORTANT: If the text appears to be PDF binary data, corrupted, or unreadable, return all fields as null.

Extract the following information from the PO text:

- description: Description of the printing job (e.g., "Tri-fold Brochures", "Business Cards", "The Old Mill Fall 2025 Postcards")
- paper: Paper type specification (e.g., "100lb Gloss Text", "80lb Cover", "14pt C2S", "93# Coated Matte", "100# Gloss cover #3")
- flatSize: Flat/unfolded dimensions (e.g., "8.5 x 11", "17 x 11", "5 x 7"). Look for "Flat size:", "Overall Size:", or similar labels.
- foldedSize: Final/folded size (e.g., "8.5 x 3.67", "5.5 x 8.5"). Look for "Finished size:", "Folded Size:", or similar. Set to null if same as flat size or not applicable.
- colors: Color specification using standard notation (e.g., "4/4" = full color both sides, "4/2" = full color front/2 color back, "4/0" = full color one side, "1/1" = black both sides). Look for "Ink:", "Colors:", or "4/4 process".
- finishing: Finishing processes like "Trim to size", "Cut, Fold, Glue", "UV coating", "Lamination", etc. Look for "Bindery:", "Finishing:", or bindery instructions.
- total: The FINAL GRAND TOTAL amount the customer will pay in dollars as a number (e.g., 1234.56). This should be the LARGEST, MOST PROMINENT total on the PO.
  Priority search order (look for these labels):
  1. "Grand Total:", "Invoice Total:", "Total Amount:", "Amount Due:" - USE THIS VALUE
  2. "Total:" at bottom of PO (usually after any subtotals, taxes, fees)
  3. If you see price per thousand ($/M, $/K, "per M", "per thousand"): calculate (quantity / 1000) × unit_price_per_M. Example: "15,000 @ $30.00/M" = (15000/1000) × 30 = 450.00

  DO NOT use:
  - Unit prices ($/M, $/K, $/piece) - these are NOT the grand total
  - Subtotals before taxes/fees
  - Individual line item prices
  - "PRICE" column values unless they represent the final total

  If multiple dollar amounts exist, always choose the largest final total amount.
- poNumber: Purchase order number. Look for "Purchase Order NO:", "PO#", "P.O. #", "PO Number" - usually a 4-6 digit number in the header area (e.g., "43729", "1227419").
- quantity: Quantity of items to be printed (e.g., 50000, 15000, 10000). Look for "QUANTITY", "QTY", or quantity fields. May include version info like "15,000 (1 version)".
- deliveryDate: Primary delivery date in YYYY-MM-DD format. Look for "ALG pool:", "Delivery date:", "Ship date:", or "In-hands date:". ALG pool is typically the final delivery date.
- samples: Sample information including quantities and distribution. Look for "SAMPLES:", "SEND X SAMPLES", sample shipping instructions.
- requiredArtworkCount: Number of artwork files needed (e.g., 1 for simple jobs, 2+ for front/back or multi-piece jobs). Look for version counts or complexity. Default to 1 if not specified.
- requiredDataFileCount: Number of data/mailing list files needed (e.g., 1 for direct mail, 0 for non-personalized). Default to 0 if not specified or not a data-driven job.
- orderDate: Date the order was placed in YYYY-MM-DD format. Look for "DATE OF ORDER:", "Order Date:", or similar date fields near the top of the PO.
- pickupDate: ALG pick up date or initial ship date in YYYY-MM-DD format. Look for "ALG pick up:", "Pick up:", or "Ship from vendor:".
- poolDate: ALG pool date in YYYY-MM-DD format. Look for "ALG pool:", "Pool date:", or "Warehouse delivery:". This is often the final delivery date to the customer's facility.
- sampleInstructions: Complete sample distribution instructions as a single text block. Include all sample shipping details, addresses, quantities, and special instructions. Look for sections starting with "SAMPLES:", "SEND X SAMPLES", "SHIP UNDER BLIND COPY", etc.
- sampleRecipients: Array of structured sample distribution data. Parse sample shipping instructions into an array of objects, each containing:
  * quantity: Number of samples to send (e.g., 5, 25, 50)
  * recipientName: Full name of recipient (e.g., "Lorie Modelevsky", "Janie Maples")
  * address: Street address (e.g., "5 S. Cambridge Ave", "3448 Butler Street")
  * city: City name (e.g., "Ventnor City", "Pigeon Forge")
  * state: State abbreviation (e.g., "NJ", "TN", "IL")
  * zip: ZIP code (e.g., "08406", "37863", "60007")

  Example: If text says "SEND 5 SAMPLES TO LORIE MODELEVSKY AT JJS&A INC. 5 S. CAMBRIDGE AVE. VENTNOR CITY NJ 08406" and "5 COPIES TO: Janie Maples 3448 Butler Street Pigeon Forge, TN 37863", return:
  [
    {"quantity": 5, "recipientName": "Lorie Modelevsky", "address": "5 S. Cambridge Ave", "city": "Ventnor City", "state": "NJ", "zip": "08406"},
    {"quantity": 5, "recipientName": "Janie Maples", "address": "3448 Butler Street", "city": "Pigeon Forge", "state": "TN", "zip": "37863"}
  ]

Important parsing rules:
- If any field cannot be found, set it to null
- For colors, use standard X/Y notation (front/back)
- For finishing, list all processes (e.g., "Cut, Fold, Glue" or "Trim to size")
- Convert all dates to YYYY-MM-DD format (e.g., "11/14/25" becomes "2025-11-14")
- For quantity, extract just the number (e.g., "15,000 (1 version)" becomes 15000)
- For total price: calculate from $/M notation if needed, otherwise look for total amounts
- For PO numbers: extract just the number portion (e.g., "43729" from "Purchase Order NO: 43729")
- For sample instructions: capture the complete text including all addresses and shipping details
- Return ONLY the JSON object with these exact field names`;

    const schema = {
      type: 'object',
      properties: {
        description: { type: ['string', 'null'] },
        paper: { type: ['string', 'null'] },
        flatSize: { type: ['string', 'null'] },
        foldedSize: { type: ['string', 'null'] },
        colors: { type: ['string', 'null'] },
        finishing: { type: ['string', 'null'] },
        total: { type: ['number', 'null'] },
        poNumber: { type: ['string', 'null'] },
        quantity: { type: ['number', 'null'] },
        deliveryDate: { type: ['string', 'null'] },
        samples: { type: ['string', 'null'] },
        requiredArtworkCount: { type: ['number', 'null'] },
        requiredDataFileCount: { type: ['number', 'null'] },
        orderDate: { type: ['string', 'null'] },
        pickupDate: { type: ['string', 'null'] },
        poolDate: { type: ['string', 'null'] },
        sampleInstructions: { type: ['string', 'null'] },
        sampleRecipients: {
          type: ['array', 'null'],
          items: {
            type: 'object',
            properties: {
              quantity: { type: 'number' },
              recipientName: { type: 'string' },
              address: { type: 'string' },
              city: { type: ['string', 'null'] },
              state: { type: ['string', 'null'] },
              zip: { type: ['string', 'null'] },
            },
            required: ['quantity', 'recipientName', 'address', 'city', 'state', 'zip'],
            additionalProperties: false,
          },
        },
      },
      required: ['description', 'paper', 'flatSize', 'foldedSize', 'colors', 'finishing', 'total', 'poNumber', 'quantity', 'deliveryDate', 'samples', 'requiredArtworkCount', 'requiredDataFileCount', 'orderDate', 'pickupDate', 'poolDate', 'sampleInstructions', 'sampleRecipients'],
      additionalProperties: false,
    };

    const parsed = await parseTextWithAI<{
      description: string | null;
      paper: string | null;
      flatSize: string | null;
      foldedSize: string | null;
      colors: string | null;
      finishing: string | null;
      total: number | null;
      poNumber: string | null;
      quantity: number | null;
      deliveryDate: string | null;
      samples: string | null;
      requiredArtworkCount: number | null;
      requiredDataFileCount: number | null;
      orderDate: string | null;
      pickupDate: string | null;
      poolDate: string | null;
      sampleInstructions: string | null;
      sampleRecipients: SampleRecipient[] | null;
    }>(text, prompt, schema);

    console.log('🤖 OpenAI returned:', JSON.stringify(parsed, null, 2));
    console.log('💰 Extracted price/total:', parsed.total, '(type:', typeof parsed.total, ')');
    if (parsed.total) {
      console.log('💵 Total formatted as currency:', `$${parsed.total.toFixed(2)}`);
    } else {
      console.warn('⚠️ WARNING: No total/price was extracted from the PO!');
    }

    // Auto-populate folded size for flat pieces (postcards, flyers, etc.)
    // If foldedSize is null but we have a flatSize, assume it's a flat piece
    if (!parsed.foldedSize && parsed.flatSize) {
      console.log('📏 Auto-setting foldedSize = flatSize (flat piece detected)');
      parsed.foldedSize = parsed.flatSize;
    }

    // Merge filename data with PDF data (PDF takes priority)
    // Build description using filename data if PDF didn't extract one
    let description = parsed.description || undefined;
    if (!description && filenameData.projectName) {
      // Build description from filename parts
      const parts: string[] = [];
      if (filenameData.projectName) parts.push(filenameData.projectName);
      if (filenameData.productType) parts.push(filenameData.productType);
      if (filenameData.year) parts.push(filenameData.year);
      description = parts.join(' ');
    }

    const result = {
      description: description,
      paper: parsed.paper || undefined,
      flatSize: parsed.flatSize || filenameData.size || undefined,
      foldedSize: parsed.foldedSize || undefined,
      colors: parsed.colors || undefined,
      finishing: parsed.finishing || undefined,
      total: parsed.total || undefined,
      poNumber: parsed.poNumber || undefined,
      quantity: parsed.quantity || filenameData.quantity || undefined,
      deliveryDate: parsed.deliveryDate || filenameData.date || undefined,
      samples: parsed.samples || undefined,
      requiredArtworkCount: parsed.requiredArtworkCount ?? 1, // Default to 1 if not specified
      requiredDataFileCount: parsed.requiredDataFileCount ?? 0, // Default to 0 if not specified
      orderDate: parsed.orderDate || undefined,
      pickupDate: parsed.pickupDate || undefined,
      poolDate: parsed.poolDate || undefined,
      sampleInstructions: parsed.sampleInstructions || undefined,
      sampleRecipients: parsed.sampleRecipients || undefined,
      rawText: text,
    };

    console.log('✅ Final parsed result (merged with filename data):', JSON.stringify(result, null, 2));

    return result;
  } catch (error: any) {
    console.error('❌ OpenAI parsing failed:', error.message);
    console.error('❌ Error stack:', error.stack);

    // If we have filename data, use it as a fallback
    if (Object.keys(filenameData).length > 0) {
      console.log('🔄 Falling back to filename-only parsing...');

      // Build description from filename
      const parts: string[] = [];
      if (filenameData.projectName) parts.push(filenameData.projectName);
      if (filenameData.productType) parts.push(filenameData.productType);
      if (filenameData.year) parts.push(filenameData.year);
      const description = parts.length > 0 ? parts.join(' ') : 'Job from parsed filename';

      const fallbackResult = {
        description,
        paper: undefined,
        flatSize: filenameData.size || undefined,
        foldedSize: undefined,
        colors: undefined,
        finishing: undefined,
        total: undefined,
        poNumber: undefined,  // No PO number from filename alone
        quantity: filenameData.quantity || undefined,
        deliveryDate: filenameData.date || undefined,
        samples: undefined,
        requiredArtworkCount: 1,
        requiredDataFileCount: 0,
        rawText: text || '',
      };

      console.log('⚠️  Using fallback data from filename:', JSON.stringify(fallbackResult, null, 2));
      return fallbackResult;
    }

    // No filename data to fall back on - throw detailed error
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      hasFilename: !!filename,
      textLength: text?.length || 0,
      textPreview: text?.substring(0, 200) || '(no text)',
    };

    console.error('❌ No fallback data available. Error details:', JSON.stringify(errorDetails, null, 2));
    throw new Error(`Failed to parse customer PO (OpenAI error: ${error.message}). ${!filename ? 'No filename provided for fallback.' : 'Filename parsing also failed.'}`);
  }
}
