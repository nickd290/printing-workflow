import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { prisma } from '@printing-workflow/db';
import { createFile } from './file.service.js';

// ============================================================================
// PROFESSIONAL DESIGN SYSTEM - Stripe/Linear Inspired
// ============================================================================

// Color Palette - Impact Direct Branding (JD Graphic-inspired)
const COLORS = {
  NAVY_HEADER: rgb(0.169, 0.294, 0.486),  // #2B4B7C - Header background (JD Graphic style)
  NAVY: rgb(0.169, 0.239, 0.310),         // #2B3D4F - Primary text
  LIGHT_BLUE: rgb(0.847, 0.906, 0.945),   // #D8E7F1 - Job details box border/background
  GRAY_TEXT: rgb(0.420, 0.447, 0.502),    // #6B7280 - Secondary text
  GRAY_BG: rgb(0.976, 0.976, 0.976),      // #F9F9F9 - Alternating rows
  GRAY_BORDER: rgb(0.898, 0.906, 0.922),  // #E5E7EB - Table borders
  GRAY_LIGHT: rgb(0.941, 0.941, 0.941),   // #F0F0F0 - Subtle backgrounds
  WHITE: rgb(1, 1, 1),                    // #FFFFFF
};

// Spacing System - 8pt Grid
const SPACING = {
  UNIT: 8,    // Base unit (8px)
  XS: 8,      // 8px
  S: 16,      // 16px
  M: 24,      // 24px
  L: 32,      // 32px
  XL: 40,     // 40px
  XXL: 48,    // 48px
};

// Typography Scale - Major Second (1.125)
const FONTS = {
  TINY: 9,     // Footer, fine print
  SMALL: 11,   // Body text, table content
  BASE: 14,    // Headers, labels
  MEDIUM: 16,  // Section labels
  LARGE: 18,   // Emphasis
  XLARGE: 24,  // Page title
};

// Page Layout Constants
const LAYOUT = {
  PAGE_WIDTH: 612,
  PAGE_HEIGHT: 792,
  MARGIN: 40,
  CONTENT_WIDTH: 532, // 612 - 80 (40px margins on each side)
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format job type for display
 */
function formatJobType(jobType: string): string {
  const typeMap: Record<string, string> = {
    'FLAT': 'Flat Piece',
    'FOLDED': 'Folded Piece',
    'BOOKLET_SELF_COVER': 'Booklet (Self Cover)',
    'BOOKLET_PLUS_COVER': 'Booklet (Plus Cover)',
  };
  return typeMap[jobType] || jobType;
}

// Logo function removed - using text-based header matching JD Graphic invoice style

/**
 * Table Row Interface
 */
interface TableRow {
  label: string;
  value: string;
  highlighted?: boolean; // For emphasis rows
}

/**
 * Draw a professional table with alternating row backgrounds
 * Returns the final Y position after the table
 */
function drawTable(
  page: any,
  x: number,
  y: number,
  width: number,
  rows: TableRow[],
  font: any,
  boldFont: any
): number {
  const ROW_HEIGHT = 32;
  const PADDING = 8;
  const LABEL_WIDTH = width * 0.35; // 35% for labels
  const VALUE_WIDTH = width * 0.65; // 65% for values

  let currentY = y;

  // Draw each row
  rows.forEach((row, index) => {
    const isAlternate = index % 2 === 1;

    // Draw row background (alternating)
    if (isAlternate) {
      page.drawRectangle({
        x,
        y: currentY - ROW_HEIGHT,
        width,
        height: ROW_HEIGHT,
        color: COLORS.GRAY_BG,
      });
    }

    // Draw bottom border
    page.drawLine({
      start: { x, y: currentY - ROW_HEIGHT },
      end: { x: x + width, y: currentY - ROW_HEIGHT },
      thickness: 1,
      color: COLORS.GRAY_BORDER,
    });

    // Draw label (bold, gray)
    page.drawText(row.label, {
      x: x + PADDING,
      y: currentY - ROW_HEIGHT / 2 - FONTS.SMALL / 2,
      size: FONTS.SMALL,
      font: boldFont,
      color: COLORS.GRAY_TEXT,
    });

    // Draw value (navy or highlighted)
    page.drawText(row.value, {
      x: x + LABEL_WIDTH + PADDING,
      y: currentY - ROW_HEIGHT / 2 - FONTS.SMALL / 2,
      size: FONTS.SMALL,
      font: row.highlighted ? boldFont : font,
      color: row.highlighted ? COLORS.ORANGE : COLORS.NAVY,
    });

    currentY -= ROW_HEIGHT;
  });

  // Draw table border (top)
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 1,
    color: COLORS.GRAY_BORDER,
  });

  // Draw table border (left)
  page.drawLine({
    start: { x, y },
    end: { x, y: currentY },
    thickness: 1,
    color: COLORS.GRAY_BORDER,
  });

  // Draw table border (right)
  page.drawLine({
    start: { x: x + width, y },
    end: { x: x + width, y: currentY },
    thickness: 1,
    color: COLORS.GRAY_BORDER,
  });

  return currentY;
}

// ============================================================================
// PDF GENERATION
// ============================================================================

/**
 * Generate Third-Party Vendor Purchase Order PDF
 * Professional PO document for third-party vendors with Impact Direct branding
 * Design inspired by Stripe/Linear invoices - clean, modern, minimal
 */
export async function generateVendorPOPdf(purchaseOrderId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      originCompany: true,
      targetCompany: true,
      targetVendor: true,
      job: {
        include: {
          customer: true,
          quote: true,
        },
      },
    },
  });

  if (!po) {
    throw new Error('Purchase Order not found');
  }

  if (!po.job) {
    throw new Error('Purchase Order must be associated with a job');
  }

  if (!po.targetCompany && !po.targetVendor) {
    throw new Error('Purchase Order must have either a target company or target vendor');
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([LAYOUT.PAGE_WIDTH, LAYOUT.PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Extract specs early (needed for header)
  const specs = po.job.specs as any;

  let y = LAYOUT.PAGE_HEIGHT - LAYOUT.MARGIN;

  // ============================================================================
  // HEADER - Navy blue bar with white text (JD Graphic style)
  // ============================================================================

  const HEADER_HEIGHT = 90;
  const HEADER_Y = LAYOUT.PAGE_HEIGHT - HEADER_HEIGHT;

  // Navy blue header background
  page.drawRectangle({
    x: 0,
    y: HEADER_Y,
    width: LAYOUT.PAGE_WIDTH,
    height: HEADER_HEIGHT,
    color: COLORS.NAVY_HEADER,
  });

  // "PURCHASE ORDER" title (large, white, left-aligned)
  page.drawText('PURCHASE ORDER', {
    x: LAYOUT.MARGIN,
    y: HEADER_Y + HEADER_HEIGHT - 32,
    size: 28,
    font: boldFont,
    color: COLORS.WHITE,
  });

  // "Impact Direct" company name (smaller, white, below title)
  page.drawText('Impact Direct', {
    x: LAYOUT.MARGIN,
    y: HEADER_Y + 18,
    size: FONTS.BASE,
    font,
    color: COLORS.WHITE,
  });

  // Right-aligned metadata (PO #, Date, Job #)
  const metadataX = LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN - 180;
  let metadataY = HEADER_Y + HEADER_HEIGHT - 20;

  // PO Number
  page.drawText(`PO #: ${po.poNumber || `PO-${po.id.slice(0, 8)}`}`, {
    x: metadataX,
    y: metadataY,
    size: FONTS.SMALL,
    font,
    color: COLORS.WHITE,
  });
  metadataY -= SPACING.S + 4;

  // Date
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
  page.drawText(`Date: ${dateStr}`, {
    x: metadataX,
    y: metadataY,
    size: FONTS.SMALL,
    font,
    color: COLORS.WHITE,
  });
  metadataY -= SPACING.S + 4;

  // Due date (using delivery date if available)
  const dueDate = specs?.deliveryDate
    ? new Date(specs.deliveryDate).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      })
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
  page.drawText(`Due: ${dueDate}`, {
    x: metadataX,
    y: metadataY,
    size: FONTS.SMALL,
    font,
    color: COLORS.WHITE,
  });

  y = HEADER_Y - SPACING.XL;

  // ============================================================================
  // FROM / TO SECTION (Two columns matching JD Graphic invoice layout)
  // ============================================================================

  const COL1_X = LAYOUT.MARGIN;
  const COL2_X = LAYOUT.PAGE_WIDTH / 2 + SPACING.M;
  const saveY = y; // Save Y for right column

  // LEFT COLUMN - FROM: Impact Direct
  page.drawText('FROM:', {
    x: COL1_X,
    y,
    size: FONTS.BASE,
    font: boldFont,
    color: COLORS.NAVY,
  });
  y -= SPACING.S + 4;

  page.drawText('Impact Direct', {
    x: COL1_X,
    y,
    size: FONTS.SMALL,
    font: boldFont,
    color: COLORS.NAVY,
  });
  y -= SPACING.S + 2;

  page.drawText('1550 North Northwest Highway, Suite 108', {
    x: COL1_X,
    y,
    size: FONTS.TINY,
    font,
    color: COLORS.GRAY_TEXT,
  });
  y -= SPACING.S;

  page.drawText('Park Ridge, IL 60068', {
    x: COL1_X,
    y,
    size: FONTS.TINY,
    font,
    color: COLORS.GRAY_TEXT,
  });
  y -= SPACING.S;

  page.drawText('brandon@impactdirectprinting.com', {
    x: COL1_X,
    y,
    size: FONTS.TINY,
    font,
    color: COLORS.GRAY_TEXT,
  });
  y -= SPACING.S;

  page.drawText('555-0300', {
    x: COL1_X,
    y,
    size: FONTS.TINY,
    font,
    color: COLORS.GRAY_TEXT,
  });

  // RIGHT COLUMN - TO: Vendor
  y = saveY;
  const recipientName = po.targetVendor?.name || po.targetCompany?.name || 'Unknown Recipient';

  page.drawText('TO:', {
    x: COL2_X,
    y,
    size: FONTS.BASE,
    font: boldFont,
    color: COLORS.NAVY,
  });
  y -= SPACING.S + 4;

  page.drawText(recipientName, {
    x: COL2_X,
    y,
    size: FONTS.SMALL,
    font: boldFont,
    color: COLORS.NAVY,
  });
  y -= SPACING.S + 2;

  // Vendor contact info (if available)
  const vendor = po.targetVendor || po.targetCompany;
  if (vendor) {
    if (vendor.address) {
      page.drawText(vendor.address.substring(0, 45), {
        x: COL2_X,
        y,
        size: FONTS.TINY,
        font,
        color: COLORS.GRAY_TEXT,
      });
      y -= SPACING.S;
    }

    const cityStateZip = [vendor.city, vendor.state, vendor.zip].filter(Boolean).join(', ');
    if (cityStateZip) {
      page.drawText(cityStateZip, {
        x: COL2_X,
        y,
        size: FONTS.TINY,
        font,
        color: COLORS.GRAY_TEXT,
      });
      y -= SPACING.S;
    }

    if (vendor.email) {
      page.drawText(vendor.email, {
        x: COL2_X,
        y,
        size: FONTS.TINY,
        font,
        color: COLORS.GRAY_TEXT,
      });
      y -= SPACING.S;
    }

    if (vendor.phone) {
      page.drawText(vendor.phone, {
        x: COL2_X,
        y,
        size: FONTS.TINY,
        font,
        color: COLORS.GRAY_TEXT,
      });
    }
  }

  // Reset Y to bottom of the tallest column
  y = saveY - 90;

  y -= SPACING.XL;

  // ============================================================================
  // JOB DETAILS - Light blue bordered box (matching JD Graphic invoice style)
  // ============================================================================

  page.drawText('JOB DETAILS', {
    x: LAYOUT.MARGIN,
    y,
    size: FONTS.BASE,
    font: boldFont,
    color: COLORS.NAVY,
  });

  y -= SPACING.M;

  // Calculate box height dynamically based on content
  const boxStartY = y;
  const BOX_PADDING = 12;
  const LINE_HEIGHT = 14;

  // Draw light blue bordered box
  const boxHeight = 140;
  page.drawRectangle({
    x: LAYOUT.MARGIN,
    y: y - boxHeight,
    width: LAYOUT.CONTENT_WIDTH,
    height: boxHeight,
    borderColor: COLORS.LIGHT_BLUE,
    borderWidth: 2,
  });

  y -= BOX_PADDING + 4;

  // Job # line
  const jobNoLabel = `Job #: `;
  page.drawText(jobNoLabel, {
    x: LAYOUT.MARGIN + BOX_PADDING,
    y,
    size: FONTS.SMALL,
    font: boldFont,
    color: COLORS.NAVY,
  });
  page.drawText(po.job.jobNo, {
    x: LAYOUT.MARGIN + BOX_PADDING + 45,
    y,
    size: FONTS.SMALL,
    font,
    color: COLORS.NAVY,
  });
  y -= LINE_HEIGHT;

  // Bradford PO # (if available)
  if (po.referencePONumber) {
    page.drawText('Bradford PO: ', {
      x: LAYOUT.MARGIN + BOX_PADDING,
      y,
      size: FONTS.SMALL,
      font: boldFont,
      color: COLORS.NAVY,
    });
    page.drawText(po.referencePONumber, {
      x: LAYOUT.MARGIN + BOX_PADDING + 85,
      y,
      size: FONTS.SMALL,
      font,
      color: COLORS.NAVY,
    });
    y -= LINE_HEIGHT;
  }

  // Customer PO (if available)
  if (specs?.customerPONumber || po.job.customerPONumber) {
    const customerPO = specs?.customerPONumber || po.job.customerPONumber;
    page.drawText('Customer PO: ', {
      x: LAYOUT.MARGIN + BOX_PADDING,
      y,
      size: FONTS.SMALL,
      font: boldFont,
      color: COLORS.NAVY,
    });
    page.drawText(customerPO, {
      x: LAYOUT.MARGIN + BOX_PADDING + 95,
      y,
      size: FONTS.SMALL,
      font,
      color: COLORS.NAVY,
    });
    y -= LINE_HEIGHT;
  }

  // Description
  y -= 2;
  page.drawText('Description:', {
    x: LAYOUT.MARGIN + BOX_PADDING,
    y,
    size: FONTS.SMALL,
    font: boldFont,
    color: COLORS.NAVY,
  });
  y -= LINE_HEIGHT;
  const jobDesc = specs?.description || po.job.title || 'Print Job';
  page.drawText(jobDesc.substring(0, 70), {
    x: LAYOUT.MARGIN + BOX_PADDING,
    y,
    size: FONTS.SMALL,
    font,
    color: COLORS.NAVY,
  });
  y -= LINE_HEIGHT + 2;

  // Size, Paper, Quantity on same line
  const sizeText = specs?.flatSize || specs?.pageSize || '';
  const paperText = specs?.paper || specs?.textStock || specs?.coverStock || '';
  const quantityText = specs?.quantity ? `${specs.quantity.toLocaleString()} pcs` : '';
  const noUndersText = specs?.noUnders ? ' **NO UNDERS**' : '';

  const detailsLine = [
    sizeText ? `Size: ${sizeText}` : '',
    paperText ? `Paper: ${paperText.substring(0, 20)}` : '',
    quantityText ? `Quantity: ${quantityText}${noUndersText}` : ''
  ].filter(Boolean).join(' | ');

  page.drawText(detailsLine.substring(0, 75), {
    x: LAYOUT.MARGIN + BOX_PADDING,
    y,
    size: FONTS.SMALL,
    font,
    color: COLORS.NAVY,
  });

  // Reset Y to bottom of box
  y = boxStartY - boxHeight - SPACING.M;

  y -= SPACING.XL;

  // ============================================================================
  // SHIPPING ADDRESS (where vendor should ship completed job)
  // ============================================================================

  if (po.job.vendorShipToAddress || po.job.vendorShipToName) {
    page.drawText('SHIP COMPLETED JOB TO', {
      x: LAYOUT.MARGIN,
      y,
      size: FONTS.BASE,
      font: boldFont,
      color: COLORS.ORANGE,
      letterSpacing: 1,
    });

    y -= SPACING.M;

    // Ship to name
    if (po.job.vendorShipToName) {
      page.drawText(po.job.vendorShipToName, {
        x: LAYOUT.MARGIN,
        y,
        size: FONTS.SMALL,
        font: boldFont,
        color: COLORS.NAVY,
      });
      y -= SPACING.S + 2;
    }

    // Ship to address
    if (po.job.vendorShipToAddress) {
      page.drawText(po.job.vendorShipToAddress, {
        x: LAYOUT.MARGIN,
        y,
        size: FONTS.SMALL,
        font,
        color: COLORS.NAVY,
      });
      y -= SPACING.S + 2;
    }

    // Ship to city, state, zip
    if (po.job.vendorShipToCity || po.job.vendorShipToState) {
      const cityStateZip = [
        po.job.vendorShipToCity,
        po.job.vendorShipToState,
        po.job.vendorShipToZip,
      ].filter(Boolean).join(', ');

      page.drawText(cityStateZip, {
        x: LAYOUT.MARGIN,
        y,
        size: FONTS.SMALL,
        font,
        color: COLORS.NAVY,
      });
      y -= SPACING.S + 2;
    }

    // Ship to phone
    if (po.job.vendorShipToPhone) {
      page.drawText(`Phone: ${po.job.vendorShipToPhone}`, {
        x: LAYOUT.MARGIN,
        y,
        size: FONTS.SMALL,
        font,
        color: COLORS.GRAY_TEXT,
      });
      y -= SPACING.S;
    }

    y -= SPACING.XL;
  }

  // ============================================================================
  // SPECIFICATIONS - Conditional based on job type
  // ============================================================================

  page.drawText('SPECIFICATIONS', {
    x: LAYOUT.MARGIN,
    y,
    size: FONTS.BASE,
    font: boldFont,
    color: COLORS.ORANGE,
    letterSpacing: 1,
  });

  y -= SPACING.M;

  // Build specifications rows based on job type
  const specRows: TableRow[] = [];
  const jobType = po.job.jobType;

  // Common fields for all types
  if (specs?.colors) {
    specRows.push({ label: 'Colors', value: specs.colors });
  }

  if (specs?.coverage) {
    specRows.push({ label: 'Ink Coverage', value: specs.coverage });
  }

  if (specs?.bleeds) {
    specRows.push({ label: 'Bleeds', value: specs.bleeds });
  }

  if (specs?.coating) {
    specRows.push({ label: 'Coating', value: specs.coating });
  }

  // Conditional fields based on job type
  if (jobType === 'BOOKLET_PLUS_COVER') {
    // Plus Cover Booklet: Separate cover and text specs
    if (specs?.pageSize) {
      specRows.push({ label: 'Page Size', value: specs.pageSize });
    }

    if (specs?.pageOrientation) {
      specRows.push({ label: 'Page Orientation', value: specs.pageOrientation });
    }

    if (specs?.coverPages !== undefined) {
      specRows.push({ label: 'Cover Pages', value: String(specs.coverPages || 4) });
    }

    if (specs?.interiorPages) {
      specRows.push({ label: 'Interior Pages', value: String(specs.interiorPages) });
    }

    if (specs?.coverStock) {
      specRows.push({ label: 'Cover Stock', value: specs.coverStock });
    }

    if (specs?.textStock) {
      specRows.push({ label: 'Text Stock', value: specs.textStock });
    }

    if (specs?.coverCoverage) {
      specRows.push({ label: 'Cover Printing', value: specs.coverCoverage });
    }

    if (specs?.textCoverage) {
      specRows.push({ label: 'Text Printing', value: specs.textCoverage });
    }

    if (specs?.coverBleeds) {
      specRows.push({ label: 'Cover Bleeds', value: specs.coverBleeds });
    }

    if (specs?.textBleeds) {
      specRows.push({ label: 'Text Bleeds', value: specs.textBleeds });
    }

    if (specs?.coverCoating) {
      specRows.push({ label: 'Cover Coating', value: specs.coverCoating });
    }

    if (specs?.textCoating) {
      specRows.push({ label: 'Text Coating', value: specs.textCoating });
    }

    if (specs?.bindingType) {
      specRows.push({ label: 'Binding', value: specs.bindingType });
    }

  } else if (jobType === 'BOOKLET_SELF_COVER') {
    // Self Cover Booklet: Single stock throughout
    if (specs?.pageSize) {
      specRows.push({ label: 'Page Size', value: specs.pageSize });
    }

    if (specs?.pageOrientation) {
      specRows.push({ label: 'Page Orientation', value: specs.pageOrientation });
    }

    if (specs?.totalPages) {
      specRows.push({ label: 'Total Pages', value: String(specs.totalPages) });
    }

    if (specs?.textStock || specs?.paper) {
      const stock = specs?.textStock || specs?.paper;
      specRows.push({ label: 'Paper Stock', value: stock });
    }

    if (specs?.bindingType) {
      specRows.push({ label: 'Binding', value: specs.bindingType });
    }

  } else if (jobType === 'FOLDED') {
    // Folded Piece: Show flat, folded, and fold type
    if (specs?.flatSize) {
      specRows.push({ label: 'Flat Size', value: specs.flatSize });
    }

    if (specs?.foldedSize) {
      specRows.push({ label: 'Folded Size', value: specs.foldedSize });
    }

    if (specs?.foldType) {
      specRows.push({ label: 'Fold Type', value: specs.foldType });
    }

    if (specs?.stock || specs?.paper) {
      const stock = specs?.stock || specs?.paper;
      specRows.push({ label: 'Paper Stock', value: stock });
    }

  } else {
    // FLAT or unknown: Show basic specs
    if (specs?.paper) {
      specRows.push({ label: 'Paper', value: specs.paper });
    }

    if (specs?.flatSize) {
      specRows.push({ label: 'Flat Size', value: specs.flatSize });
    }

    if (specs?.foldedSize && specs.foldedSize !== specs.flatSize) {
      specRows.push({ label: 'Folded Size', value: specs.foldedSize });
    }

    if (specs?.stock) {
      specRows.push({ label: 'Stock', value: specs.stock });
    }
  }

  // Finishing (applies to all types)
  if (specs?.finishing) {
    specRows.push({ label: 'Finishing', value: specs.finishing });
  }

  // Draw specifications table
  if (specRows.length > 0) {
    y = drawTable(page, LAYOUT.MARGIN, y, LAYOUT.CONTENT_WIDTH, specRows, font, boldFont);
  }

  y -= SPACING.XL;

  // ============================================================================
  // PRODUCTION SCHEDULE (conditional - only if dates exist)
  // ============================================================================

  const hasProductionSchedule = specs?.artworkDueDate || specs?.proofsDueDate || specs?.stockDueDate;
  if (hasProductionSchedule && y > 300) {
    page.drawText('PRODUCTION SCHEDULE', {
      x: LAYOUT.MARGIN,
      y,
      size: FONTS.BASE,
      font: boldFont,
      color: COLORS.ORANGE,
      letterSpacing: 1,
    });

    y -= SPACING.M;

    const scheduleRows: TableRow[] = [];

    if (specs?.artworkDueDate) {
      const formattedDate = new Date(specs.artworkDueDate).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      scheduleRows.push({ label: 'Artwork Due', value: formattedDate });
    }

    if (specs?.proofsDueDate) {
      const formattedDate = new Date(specs.proofsDueDate).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      scheduleRows.push({ label: 'Proofs Due', value: formattedDate });
    }

    if (specs?.stockDueDate) {
      const formattedDate = new Date(specs.stockDueDate).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      scheduleRows.push({ label: 'Stock/Paper Due', value: formattedDate });
    }

    if (scheduleRows.length > 0) {
      y = drawTable(page, LAYOUT.MARGIN, y, LAYOUT.CONTENT_WIDTH, scheduleRows, font, boldFont);
    }

    y -= SPACING.XL;
  }

  // ============================================================================
  // ARTWORK & PROOFS DETAILS (conditional)
  // ============================================================================

  const hasArtworkDetails = specs?.artworkMethod || specs?.proofsMethod || specs?.previousJobNumber;
  if (hasArtworkDetails && y > 300) {
    page.drawText('ARTWORK & PROOFS', {
      x: LAYOUT.MARGIN,
      y,
      size: FONTS.BASE,
      font: boldFont,
      color: COLORS.ORANGE,
      letterSpacing: 1,
    });

    y -= SPACING.M;

    const artworkRows: TableRow[] = [];

    if (specs?.artworkMethod) {
      artworkRows.push({ label: 'Artwork Delivery', value: specs.artworkMethod });
    }

    if (specs?.proofsMethod) {
      artworkRows.push({ label: 'Proofs Method', value: specs.proofsMethod });
    }

    if (specs?.previousJobNumber) {
      artworkRows.push({ label: 'Previous Job #', value: specs.previousJobNumber });
    }

    if (artworkRows.length > 0) {
      y = drawTable(page, LAYOUT.MARGIN, y, LAYOUT.CONTENT_WIDTH, artworkRows, font, boldFont);
    }

    y -= SPACING.XL;
  }

  // ============================================================================
  // PACKING INSTRUCTIONS (conditional)
  // ============================================================================

  if (specs?.packingInstructions && y > 250) {
    page.drawText('PACKING INSTRUCTIONS', {
      x: LAYOUT.MARGIN,
      y,
      size: FONTS.BASE,
      font: boldFont,
      color: COLORS.ORANGE,
      letterSpacing: 1,
    });

    y -= SPACING.M;

    // Draw packing instructions with text wrapping
    const packingLines = specs.packingInstructions.match(/.{1,90}/g) || [specs.packingInstructions];
    const maxLines = Math.min(packingLines.length, 5);

    for (let i = 0; i < maxLines; i++) {
      const line = packingLines[i];
      page.drawText(line, {
        x: LAYOUT.MARGIN,
        y,
        size: FONTS.SMALL,
        font,
        color: COLORS.NAVY,
      });
      y -= SPACING.S;

      if (y < 200) break;
    }

    y -= SPACING.L;
  }

  // ============================================================================
  // SHIPPING COMMENTS (conditional)
  // ============================================================================

  if (specs?.shippingComments && y > 250) {
    page.drawText('SHIPPING DETAILS', {
      x: LAYOUT.MARGIN,
      y,
      size: FONTS.BASE,
      font: boldFont,
      color: COLORS.ORANGE,
      letterSpacing: 1,
    });

    y -= SPACING.M;

    // Draw shipping comments with text wrapping
    const shippingLines = specs.shippingComments.match(/.{1,90}/g) || [specs.shippingComments];
    const maxLines = Math.min(shippingLines.length, 5);

    for (let i = 0; i < maxLines; i++) {
      const line = shippingLines[i];
      page.drawText(line, {
        x: LAYOUT.MARGIN,
        y,
        size: FONTS.SMALL,
        font,
        color: COLORS.NAVY,
      });
      y -= SPACING.S;

      if (y < 200) break;
    }

    y -= SPACING.L;
  }

  // ============================================================================
  // PROOF DELIVERY COMMENTS (conditional)
  // ============================================================================

  if (specs?.proofComments && y > 250) {
    page.drawText('PROOF DELIVERY', {
      x: LAYOUT.MARGIN,
      y,
      size: FONTS.BASE,
      font: boldFont,
      color: COLORS.ORANGE,
      letterSpacing: 1,
    });

    y -= SPACING.M;

    // Draw proof comments with text wrapping
    const proofLines = specs.proofComments.match(/.{1,90}/g) || [specs.proofComments];
    const maxLines = Math.min(proofLines.length, 5);

    for (let i = 0; i < maxLines; i++) {
      const line = proofLines[i];
      page.drawText(line, {
        x: LAYOUT.MARGIN,
        y,
        size: FONTS.SMALL,
        font,
        color: COLORS.NAVY,
      });
      y -= SPACING.S;

      if (y < 200) break;
    }

    y -= SPACING.L;
  }

  // ============================================================================
  // SPECIAL INSTRUCTIONS FOR VENDOR
  // ============================================================================

  const vendorInstructions = po.job.vendorSpecialInstructions || specs?.notes;
  if (vendorInstructions) {
    page.drawText('SPECIAL INSTRUCTIONS', {
      x: LAYOUT.MARGIN,
      y,
      size: FONTS.BASE,
      font: boldFont,
      color: COLORS.ORANGE,
      letterSpacing: 1,
    });

    y -= SPACING.M;

    // Draw vendor instructions with text wrapping
    const instructionLines = vendorInstructions.match(/.{1,90}/g) || [vendorInstructions];
    const maxLines = Math.min(instructionLines.length, 10);

    for (let i = 0; i < maxLines; i++) {
      const line = instructionLines[i];
      page.drawText(line, {
        x: LAYOUT.MARGIN,
        y,
        size: FONTS.SMALL,
        font,
        color: COLORS.NAVY,
      });
      y -= SPACING.S;

      if (y < 150) break; // Leave room for footer
    }

    y -= SPACING.L;
  }

  // ============================================================================
  // SAMPLE DISTRIBUTION - Full addresses
  // ============================================================================

  if (specs?.sampleInstructions || specs?.sampleRecipients) {
    page.drawText('SAMPLE DISTRIBUTION', {
      x: LAYOUT.MARGIN,
      y,
      size: FONTS.BASE,
      font: boldFont,
      color: COLORS.ORANGE,
      letterSpacing: 1,
    });

    y -= SPACING.M;

    // Show structured sample recipients if available
    if (specs?.sampleRecipients && Array.isArray(specs.sampleRecipients)) {
      for (let index = 0; index < specs.sampleRecipients.length; index++) {
        const recipient = specs.sampleRecipients[index];

        // Quantity + recipient name (bold)
        const header = `${recipient.quantity} samples to ${recipient.recipientName}`;
        page.drawText(header, {
          x: LAYOUT.MARGIN,
          y,
          size: FONTS.SMALL,
          font: boldFont,
          color: COLORS.NAVY,
        });
        y -= SPACING.S + 2;

        // Address line
        if (recipient.address) {
          page.drawText(recipient.address, {
            x: LAYOUT.MARGIN + SPACING.S,
            y,
            size: FONTS.SMALL,
            font,
            color: COLORS.NAVY,
          });
          y -= SPACING.S + 2;
        }

        // City, State ZIP line
        const cityStateZip = [
          recipient.city,
          recipient.state,
          recipient.zip,
        ].filter(Boolean).join(', ');

        if (cityStateZip) {
          page.drawText(cityStateZip, {
            x: LAYOUT.MARGIN + SPACING.S,
            y,
            size: FONTS.SMALL,
            font,
            color: COLORS.NAVY,
          });
          y -= SPACING.S + 4;
        }

        // Add space between recipients
        if (index < specs.sampleRecipients.length - 1) {
          y -= SPACING.XS;
        }

        // Leave room for footer
        if (y < 200) break;
      }
    } else if (specs?.sampleInstructions) {
      // Fallback: Show unstructured sample instructions
      const instructionLines = specs.sampleInstructions.match(/.{1,90}/g) || [specs.sampleInstructions];
      const maxLines = Math.min(instructionLines.length, 6);

      for (let i = 0; i < maxLines; i++) {
        const line = instructionLines[i];
        page.drawText(line, {
          x: LAYOUT.MARGIN,
          y,
          size: FONTS.SMALL,
          font,
          color: COLORS.NAVY,
        });
        y -= SPACING.S;

        if (y < 200) break;
      }
    }

    y -= SPACING.L;
  }

  // ============================================================================
  // TOTAL AMOUNT BOX - Right-aligned (matching JD Graphic invoice style)
  // ============================================================================

  const AMOUNT_BOX_WIDTH = 260;
  const AMOUNT_BOX_HEIGHT = 70;
  const AMOUNT_BOX_X = LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN - AMOUNT_BOX_WIDTH;

  // Main box with light blue border
  page.drawRectangle({
    x: AMOUNT_BOX_X,
    y: y - AMOUNT_BOX_HEIGHT,
    width: AMOUNT_BOX_WIDTH,
    height: AMOUNT_BOX_HEIGHT,
    borderColor: COLORS.LIGHT_BLUE,
    borderWidth: 2,
  });

  // "TOTAL AMOUNT DUE" label
  page.drawText('TOTAL AMOUNT DUE', {
    x: AMOUNT_BOX_X + SPACING.S + 4,
    y: y - SPACING.M - 4,
    size: FONTS.SMALL,
    font: boldFont,
    color: COLORS.NAVY,
  });

  // Amount value (large, bold, navy)
  const amountText = `$${parseFloat(po.vendorAmount.toString()).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  page.drawText(amountText, {
    x: AMOUNT_BOX_X + SPACING.S + 4,
    y: y - SPACING.M - SPACING.L - 4,
    size: 24,
    font: boldFont,
    color: COLORS.NAVY,
  });

  // ============================================================================
  // FOOTER - Progressive text sizing
  // ============================================================================

  const FOOTER_Y = LAYOUT.MARGIN + SPACING.XL;

  // Thin separator line
  page.drawLine({
    start: { x: LAYOUT.MARGIN, y: FOOTER_Y + SPACING.M },
    end: { x: LAYOUT.PAGE_WIDTH - LAYOUT.MARGIN, y: FOOTER_Y + SPACING.M },
    thickness: 1,
    color: COLORS.GRAY_BORDER,
  });

  // Footer text (progressive sizing)
  page.drawText('Please confirm receipt of this purchase order.', {
    x: LAYOUT.MARGIN,
    y: FOOTER_Y,
    size: FONTS.SMALL,
    font,
    color: COLORS.GRAY_TEXT,
  });

  page.drawText('For questions, contact: Brandon Ferris | brandon@impactdirectprinting.com', {
    x: LAYOUT.MARGIN,
    y: FOOTER_Y - SPACING.S - 2,
    size: FONTS.SMALL,
    font,
    color: COLORS.GRAY_TEXT,
  });

  page.drawText('Impact Direct | 1550 North Northwest Highway, Suite 108, 60068', {
    x: LAYOUT.MARGIN,
    y: FOOTER_Y - SPACING.S - 2 - SPACING.S - 2,
    size: FONTS.TINY,
    font,
    color: COLORS.GRAY_TEXT,
  });

  // Generate PDF bytes
  const pdfBytes = await pdfDoc.save();

  // Use targetVendor name for third-party vendors, otherwise targetCompany name
  const recipientNameForFile = (po.targetVendor?.name || po.targetCompany?.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '-');
  const fileName = `PO-${po.poNumber || po.id.slice(0, 8)}-${recipientNameForFile}.pdf`;

  return { pdfBytes: Buffer.from(pdfBytes), fileName };
}

/**
 * Generate vendor PO PDF and save to File model
 * Returns updated PO with pdfFile reference (consistent with traditional POs)
 */
export async function generateAndSaveVendorPOPdf(purchaseOrderId: string) {
  // Generate the PDF
  const { pdfBytes, fileName } = await generateVendorPOPdf(purchaseOrderId);

  // Get PO data for jobId and poNumber
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: { jobId: true, poNumber: true, id: true },
  });

  if (!po) {
    throw new Error('Purchase Order not found');
  }

  // Save PDF to File model
  const file = await createFile({
    jobId: po.jobId || undefined,
    kind: 'PO_PDF',
    file: pdfBytes,
    fileName,
    mimeType: 'application/pdf',
  });

  // Update PO with PDF reference
  const updatedPO = await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      pdfFileId: file.id,
    },
    include: {
      originCompany: true,
      targetCompany: true,
      targetVendor: true,
      job: {
        include: {
          customer: true,
        },
      },
      pdfFile: true,
    },
  });

  return updatedPO;
}
