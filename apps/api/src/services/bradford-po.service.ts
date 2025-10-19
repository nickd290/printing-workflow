import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { prisma } from '@printing-workflow/db';

/**
 * Generate Bradford Print Order Form PDF
 * This matches the BGE, LTD. Print Order Form format
 */
export async function generateBradfordPOPdf(purchaseOrderId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      originCompany: true,
      targetCompany: true,
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

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Helper function to draw form field
  const drawField = (label: string, value: string, x: number, y: number, fieldWidth: number = 320) => {
    // Draw label
    page.drawText(label, {
      x,
      y,
      size: 11,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Draw box
    const boxX = x + 130;
    const boxY = y - 5;
    const boxHeight = 20;

    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: fieldWidth,
      height: boxHeight,
      borderColor: rgb(0.4, 0.4, 0.8),
      borderWidth: 1.5,
    });

    // Draw value inside box
    if (value) {
      page.drawText(value, {
        x: boxX + 5,
        y: boxY + 6,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    }
  };

  const drawFieldRight = (label: string, value: string, x: number, y: number, fieldWidth: number = 140) => {
    // Draw label
    page.drawText(label, {
      x,
      y,
      size: 11,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Draw box
    const boxX = x + 75;
    const boxY = y - 5;
    const boxHeight = 20;

    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: fieldWidth,
      height: boxHeight,
      borderColor: rgb(0.4, 0.4, 0.8),
      borderWidth: 1.5,
    });

    // Draw value inside box
    if (value) {
      page.drawText(value, {
        x: boxX + 5,
        y: boxY + 6,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    }
  };

  let y = height - 80;

  // Header
  page.drawText('BGE, LTD.', {
    x: width / 2 - 60,
    y: height - 40,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  page.drawText('Print Order Form', {
    x: width / 2 - 75,
    y: height - 60,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Bradford address
  page.drawText('The Bradford Group    9333 Milwaukee Ave    Niles, IL 60714', {
    x: 100,
    y: height - 760,
    size: 9,
    font,
    color: rgb(0, 0, 0),
  });

  // Date fields on right
  const rightX = 370;
  drawFieldRight('Order Date', new Date().toLocaleDateString(), rightX, y);
  y -= 30;
  drawFieldRight('File Due', '', rightX, y);
  y -= 30;
  drawFieldRight('Ship Date', '', rightX, y);

  // Reset y for left column
  y = height - 80;
  const leftX = 50;

  // PO Number - extract from externalRef or generate
  const poNumber = po.externalRef?.split('-')[0] || `PO-${po.id.slice(0, 7)}`;
  drawField('PO Number', poNumber, leftX, y);
  y -= 30;

  // Component ID - customer code + job number
  const componentId = `${po.job.customer?.name?.substring(0, 4).toUpperCase() || 'CUST'} - ${po.job.jobNo}`;
  drawField('Component ID', componentId, leftX, y);
  y -= 30;

  // Division
  drawField('Division', '', leftX, y, 120);
  y -= 30;

  // Buyer
  drawField('Buyer', '', leftX, y);
  y -= 30;

  // Quantity Ordered
  drawField('Quantity Ordered', po.job.quote?.quantity?.toString() || '', leftX, y);
  y -= 30;

  // Ship To
  drawField('Ship To', 'FOB JD Graphic', leftX, y);
  y -= 30;

  // Envelope
  drawField('Envelope', '', leftX, y);
  y -= 30;

  // Vendor
  drawField('Vendor', po.targetCompany.name, leftX, y);
  y -= 30;

  // New/Reprint
  drawField('New/Reprint', 'New', leftX, y);
  y -= 30;

  // Reprint Invoice#
  drawField('Reprint Invoice#', '', leftX, y);
  y -= 30;

  // Overall Size
  const size = po.job.quote?.size || '';
  drawField('Overall Size', size, leftX, y);
  y -= 30;

  // Paper Type
  drawField('Paper Type', '', leftX, y);
  y -= 30;

  // Component CPM
  drawField('Component CPM', '', leftX, y);
  y -= 30;

  // Folded Size
  drawField('Folded Size', '', leftX, y);
  y -= 30;

  // Paper Lbs
  drawField('Paper Lbs', '', leftX, y);
  y -= 30;

  // Sample Distribution
  drawField('Sample Distribution', '', leftX, y, 180);
  y -= 40;

  // Vendor Notes - Large box
  page.drawText('Vendor Notes', {
    x: leftX,
    y,
    size: 11,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  const notesBoxX = leftX + 130;
  const notesBoxY = y - 100;
  const notesBoxWidth = 320;
  const notesBoxHeight = 100;

  page.drawRectangle({
    x: notesBoxX,
    y: notesBoxY,
    width: notesBoxWidth,
    height: notesBoxHeight,
    borderColor: rgb(0.4, 0.4, 0.8),
    borderWidth: 1.5,
  });

  // Add job number to vendor notes
  page.drawText(po.job.jobNo, {
    x: notesBoxX + 5,
    y: notesBoxY + notesBoxHeight - 15,
    size: 10,
    font,
    color: rgb(0, 0, 0),
  });

  // Save PDF
  const pdfBytes = await pdfDoc.save();

  return {
    pdfBytes: Buffer.from(pdfBytes),
    fileName: `${componentId.replace(/ /g, '_')}_PO${poNumber}.pdf`,
  };
}
