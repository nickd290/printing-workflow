import { CUSTOMER_CODE_TO_ID, COMPANY_IDS } from '@printing-workflow/shared';
import { parseTextWithAI } from '../lib/openai.js';

// Import pdf-parse at the top level using a workaround for CommonJS compatibility
let pdfParseFunction: any = null;

async function getPdfParseFunction() {
  if (pdfParseFunction) {
    return pdfParseFunction;
  }

  try {
    // Dynamic import with detailed debugging
    console.log('🔍 Attempting to import pdf-parse...');
    const pdfParseModule = await import('pdf-parse');

    console.log('📦 Module imported, keys:', Object.keys(pdfParseModule));
    console.log('📦 Module.default type:', typeof pdfParseModule.default);
    console.log('📦 Module type:', typeof pdfParseModule);

    // Try different export patterns
    if (typeof pdfParseModule.default === 'function') {
      console.log('✅ Found function at module.default');
      pdfParseFunction = pdfParseModule.default;
    } else if (typeof (pdfParseModule as any) === 'function') {
      console.log('✅ Module itself is a function');
      pdfParseFunction = pdfParseModule as any;
    } else {
      // Check if it's a namespace with default
      const anyModule = pdfParseModule as any;
      for (const key of Object.keys(anyModule)) {
        console.log(`  - ${key}: ${typeof anyModule[key]}`);
        if (typeof anyModule[key] === 'function' && key !== 'default') {
          console.log(`✅ Found function at module.${key}`);
          pdfParseFunction = anyModule[key];
          break;
        }
      }

      if (!pdfParseFunction && anyModule.default?.default) {
        console.log('✅ Found nested function at module.default.default');
        pdfParseFunction = anyModule.default.default;
      }
    }

    if (!pdfParseFunction) {
      throw new Error('Could not find pdf-parse function in module exports');
    }

    return pdfParseFunction;
  } catch (error: any) {
    console.error('❌ Failed to import pdf-parse:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

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
  // Parse PDF to text
  const PDFParser = await getPdfParseFunction();
  // Handle both class constructors and direct functions
  let parseFunc: any;
  if (typeof PDFParser === 'function' && PDFParser.prototype && PDFParser.prototype.constructor === PDFParser) {
    // It's a class constructor
    const parser = new PDFParser();
    parseFunc = parser.parse ? parser.parse.bind(parser) : parser;
  } else {
    // It's a regular function
    parseFunc = PDFParser;
  }
  const data = await parseFunc(buffer);
  const text = data.text;

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
    const PDFParser = await getPdfParseFunction();
    // Handle both class constructors and direct functions
    let parseFunc: any;
    if (typeof PDFParser === 'function' && PDFParser.prototype && PDFParser.prototype.constructor === PDFParser) {
      // It's a class constructor
      const parser = new PDFParser();
      parseFunc = parser.parse ? parser.parse.bind(parser) : parser;
    } else {
      // It's a regular function
      parseFunc = PDFParser;
    }
    const data = await parseFunc(buffer);
    text = data.text;
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

- description: Description of the printing job (e.g., "Tri-fold Brochures", "Business Cards", "Marketing Flyers")
- paper: Paper type specification (e.g., "100lb Gloss Text", "80lb Cover", "14pt C2S", "93# Coated Matte")
- flatSize: Flat/unfolded dimensions (e.g., "8.5 x 11", "17 x 11", "4 x 9")
- foldedSize: Final/folded size (e.g., "8.5 x 3.67", "4 x 9", leave null if not folded)
- colors: Color specification using standard notation (e.g., "4/4" = full color both sides, "4/2" = full color front / 2 color back, "4/0" = full color one side, "1/1" = black both sides)
- finishing: Finishing processes like cut, fold, glue, UV coating, lamination, die cut, perforation, etc.
- total: Total price in dollars as a number (e.g., 1234.56)
- poNumber: Purchase order number
- quantity: Quantity of items to be printed (e.g., 50000, 10000)
- deliveryDate: Delivery date in YYYY-MM-DD format
- samples: Sample information or quantity
- requiredArtworkCount: Number of artwork files needed (e.g., 1 for simple jobs, 2+ for front/back or multi-piece jobs). Default to 1 if not specified.
- requiredDataFileCount: Number of data/mailing list files needed (e.g., 1 for direct mail, 0 for non-personalized). Default to 0 if not specified or not a data-driven job.

Important:
- If any field cannot be found, set it to null
- For colors, use the standard X/Y notation (front/back)
- For finishing, list all processes (e.g., "Cut, Fold, Glue")
- For dates, convert to YYYY-MM-DD format
- For quantity, extract the number of items to be printed
- For file counts, analyze the job complexity: simple jobs need 1 artwork, complex/multi-piece need more
- Data files are only needed for personalized/variable data jobs (direct mail, etc.)
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
      },
      required: ['description', 'paper', 'flatSize', 'foldedSize', 'colors', 'finishing', 'total', 'poNumber', 'quantity', 'deliveryDate', 'samples', 'requiredArtworkCount', 'requiredDataFileCount'],
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
    }>(text, prompt, schema);

    console.log('🤖 OpenAI returned:', JSON.stringify(parsed, null, 2));

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
