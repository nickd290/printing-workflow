import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { prisma } from '@printing-workflow/db';

/**
 * Generate Third-Party Vendor Purchase Order PDF
 * Professional PO document for third-party vendors
 */
export async function generateVendorPOPdf(purchaseOrderId: string) {
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

  if (!po.targetCompany) {
    throw new Error('Purchase Order must have a target company');
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let yPosition = height - 60;

  // Header
  page.drawText('PURCHASE ORDER', {
    x: 50,
    y: yPosition,
    size: 24,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.6),
  });

  yPosition -= 10;
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 2,
    color: rgb(0.2, 0.2, 0.6),
  });

  yPosition -= 30;

  // PO Details Section
  page.drawText('PO Number:', {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont,
  });
  page.drawText(po.poNumber || `PO-${po.id.slice(0, 8)}`, {
    x: 150,
    y: yPosition,
    size: 12,
    font,
  });

  yPosition -= 20;
  page.drawText('Date:', {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont,
  });
  page.drawText(new Date().toLocaleDateString(), {
    x: 150,
    y: yPosition,
    size: 12,
    font,
  });

  yPosition -= 20;
  page.drawText('Job Number:', {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont,
  });
  page.drawText(po.job.jobNo, {
    x: 150,
    y: yPosition,
    size: 12,
    font,
  });

  yPosition -= 40;

  // From/To Section
  const midX = width / 2;

  // From (Bradford)
  page.drawText('FROM:', {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont,
  });
  yPosition -= 20;
  page.drawText(po.originCompany.name || 'Bradford Graphics', {
    x: 50,
    y: yPosition,
    size: 11,
    font,
  });
  yPosition -= 15;
  page.drawText('steve.gustafson@bgeltd.com', {
    x: 50,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Reset Y for TO section
  yPosition = height - 60 - 10 - 30 - 20 - 20 - 20 - 40;

  // To (Vendor)
  page.drawText('TO:', {
    x: midX + 20,
    y: yPosition,
    size: 12,
    font: boldFont,
  });
  yPosition -= 20;
  page.drawText(po.targetCompany.name, {
    x: midX + 20,
    y: yPosition,
    size: 11,
    font,
  });

  yPosition = height - 60 - 10 - 30 - 20 - 20 - 20 - 40 - 20 - 15 - 30;

  // Divider
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });

  yPosition -= 30;

  // Customer & Order Information
  page.drawText('CUSTOMER INFORMATION', {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.6),
  });

  yPosition -= 25;

  const specs = po.job.specs as any;

  // Customer Name
  page.drawText('Customer:', {
    x: 50,
    y: yPosition,
    size: 11,
    font: boldFont,
  });
  page.drawText(po.job.customer?.name || 'N/A', {
    x: 150,
    y: yPosition,
    size: 11,
    font,
  });

  yPosition -= 20;

  // Description
  if (specs?.description) {
    page.drawText('Description:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
    });
    page.drawText(specs.description.substring(0, 60), {
      x: 150,
      y: yPosition,
      size: 11,
      font,
    });
    yPosition -= 20;
  }

  // Quantity
  if (specs?.quantity) {
    page.drawText('Quantity:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
    });
    page.drawText(`${specs.quantity.toLocaleString()} pieces`, {
      x: 150,
      y: yPosition,
      size: 11,
      font,
    });
    yPosition -= 20;
  }

  // Delivery Date
  if (specs?.deliveryDate) {
    page.drawText('Required Delivery:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
    });
    page.drawText(new Date(specs.deliveryDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }), {
      x: 150,
      y: yPosition,
      size: 11,
      font,
      color: rgb(0.8, 0, 0), // Red for emphasis
    });
    yPosition -= 25;
  }

  // Divider
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });

  yPosition -= 30;

  // SPECIFICATIONS
  page.drawText('SPECIFICATIONS', {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.6),
  });

  yPosition -= 25;

  // Paper
  if (specs?.paper) {
    page.drawText('Paper:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
    });
    page.drawText(specs.paper, {
      x: 150,
      y: yPosition,
      size: 11,
      font,
    });
    yPosition -= 20;
  }

  // Flat Size
  if (specs?.flatSize) {
    page.drawText('Flat Size:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
    });
    page.drawText(specs.flatSize, {
      x: 150,
      y: yPosition,
      size: 11,
      font,
    });
    yPosition -= 20;
  }

  // Folded Size
  if (specs?.foldedSize) {
    page.drawText('Folded Size:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
    });
    page.drawText(specs.foldedSize, {
      x: 150,
      y: yPosition,
      size: 11,
      font,
    });
    yPosition -= 20;
  }

  // Colors
  if (specs?.colors) {
    page.drawText('Colors:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
    });
    page.drawText(specs.colors, {
      x: 150,
      y: yPosition,
      size: 11,
      font,
    });
    yPosition -= 20;
  }

  // Finishing
  if (specs?.finishing) {
    page.drawText('Finishing:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
    });
    page.drawText(specs.finishing, {
      x: 150,
      y: yPosition,
      size: 11,
      font,
    });
    yPosition -= 25;
  }

  // Special Notes
  if (specs?.notes) {
    // Divider
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: width - 50, y: yPosition },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });

    yPosition -= 30;

    page.drawText('SPECIAL NOTES', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.6),
    });

    yPosition -= 25;

    // Draw notes (wrap if too long)
    const notesLines = specs.notes.match(/.{1,70}/g) || [specs.notes];
    for (const line of notesLines.slice(0, 5)) { // Max 5 lines
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 15;
    }

    yPosition -= 10;
  }

  // Divider before amount
  yPosition -= 20;
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });

  yPosition -= 35;

  // PO Amount (highlighted)
  page.drawRectangle({
    x: width - 250,
    y: yPosition - 10,
    width: 200,
    height: 40,
    color: rgb(0.95, 0.95, 1),
    borderColor: rgb(0.2, 0.2, 0.6),
    borderWidth: 2,
  });

  page.drawText('PO AMOUNT:', {
    x: width - 240,
    y: yPosition + 10,
    size: 12,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.6),
  });

  page.drawText(`$${parseFloat(po.vendorAmount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, {
    x: width - 240,
    y: yPosition - 5,
    size: 18,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.6),
  });

  // Footer
  yPosition = 80;
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: width - 50, y: yPosition },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });

  yPosition -= 20;

  page.drawText('Please confirm receipt of this purchase order.', {
    x: 50,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  yPosition -= 15;

  page.drawText('For questions, contact: steve.gustafson@bgeltd.com', {
    x: 50,
    y: yPosition,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Generate PDF bytes
  const pdfBytes = await pdfDoc.save();

  const fileName = `PO-${po.poNumber || po.id.slice(0, 8)}-${po.targetCompany.name.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

  return { pdfBytes: Buffer.from(pdfBytes), fileName };
}
