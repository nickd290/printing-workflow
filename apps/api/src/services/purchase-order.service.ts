import { prisma, POStatus } from '@printing-workflow/db';
import { calculatePOAmounts } from '../lib/utils.js';
import { generateBradfordPOPdf } from './bradford-po.service.js';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';
import { createFile } from './file.service.js';
import { extractPONumber, normalizePONumber, validatePONumber } from './pdf-extract.service.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function createPurchaseOrder(data: {
  originCompanyId: string;
  targetCompanyId: string;
  jobId?: string;
  originalAmount: number;
  vendorAmount: number;
  marginAmount: number;
  externalRef?: string;
  poNumber?: string;
  referencePONumber?: string;
}) {
  const po = await prisma.purchaseOrder.create({
    data: {
      originCompanyId: data.originCompanyId,
      targetCompanyId: data.targetCompanyId,
      jobId: data.jobId,
      originalAmount: data.originalAmount,
      vendorAmount: data.vendorAmount,
      marginAmount: data.marginAmount,
      externalRef: data.externalRef,
      poNumber: data.poNumber,
      referencePONumber: data.referencePONumber,
      status: POStatus.PENDING,
    },
    include: {
      originCompany: true,
      targetCompany: true,
      job: true,
    },
  });

  return po;
}

/**
 * Create auto PO with pricing from the pricing system
 * Called by the purchase order queue
 */
export async function createAutoPurchaseOrder(data: {
  jobId: string;
  originCompanyId: string;
  targetCompanyId: string;
  originalAmount: number;
  vendorAmount?: number; // If provided, use exact amount from pricing system
  customerPONumber?: string; // Customer's PO# for reference
}) {
  let vendorAmount: number;
  let marginAmount: number;

  if (data.vendorAmount !== undefined) {
    // Use exact amounts from pricing system
    vendorAmount = data.vendorAmount;
    marginAmount = data.originalAmount - data.vendorAmount;
  } else {
    // Fall back to old calculation (for backwards compatibility)
    const amounts = calculatePOAmounts(data.originalAmount);
    vendorAmount = amounts.vendorAmount;
    marginAmount = amounts.marginAmount;
  }

  // Get job details to fetch customer PO#
  const job = await prisma.job.findUnique({
    where: { id: data.jobId },
    select: { customerPONumber: true, jobNo: true },
  });

  const customerPONumber = data.customerPONumber || job?.customerPONumber || undefined;

  // Generate PO number: Use customer PO# as reference or generate based on job#
  const poNumber = customerPONumber ? `IMP-${customerPONumber}` : `IMP-${job?.jobNo}`;

  const po = await createPurchaseOrder({
    originCompanyId: data.originCompanyId,
    targetCompanyId: data.targetCompanyId,
    jobId: data.jobId,
    originalAmount: data.originalAmount,
    vendorAmount,
    marginAmount,
    poNumber,
    referencePONumber: customerPONumber,
  });

  console.log(
    `Auto PO created: ${data.originCompanyId} → ${data.targetCompanyId} | PO#: ${poNumber} | Ref: ${customerPONumber || 'N/A'} | Original: $${data.originalAmount}, Vendor: $${vendorAmount}, Margin: $${marginAmount}`
  );

  return po;
}

/**
 * Create PO from Bradford webhook (Bradford → JD Graphic)
 */
export async function createPOFromWebhook(data: {
  componentId: string;
  estimateNumber: string;
  amount: number;
  jobId?: string;
  originCompanyId: string;
  targetCompanyId: string;
}) {
  const po = await createPurchaseOrder({
    originCompanyId: data.originCompanyId,
    targetCompanyId: data.targetCompanyId,
    jobId: data.jobId,
    originalAmount: data.amount,
    vendorAmount: data.amount,
    marginAmount: 0, // Bradford keeps the margin
    externalRef: `${data.componentId}-${data.estimateNumber}`,
  });

  // Generate Bradford PO PDF and send to JD Graphic
  try {
    const { pdfBytes, fileName } = await generateBradfordPOPdf(po.id);

    const poWithDetails = await getPOById(po.id);

    if (poWithDetails && poWithDetails.job) {
      const poNumber = po.externalRef?.split('-')[0] || `PO-${po.id.slice(0, 7)}`;

      const template = emailTemplates.bradfordPOToJD(
        data.componentId,
        poWithDetails.job.jobNo,
        poNumber,
        parseFloat(po.vendorAmount.toString())
      );

      // Send email to both JD Graphic production and Nick
      const jdEmails = ['production@jdgraphic.com', 'nick@jdgraphic.com'];

      for (const email of jdEmails) {
        await queueEmail({
          to: email,
          subject: template.subject,
          html: template.html,
          attachments: [
            {
              filename: fileName,
              content: pdfBytes,
            },
          ],
        });

        // Create notification record
        await prisma.notification.create({
          data: {
            type: 'PO_CREATED',
            jobId: poWithDetails.job.id,
            recipient: email,
            subject: template.subject,
            body: template.html,
          },
        });
      }

      console.log(`✅ Bradford PO PDF generated and emailed to JD Graphic (${jdEmails.join(', ')}): ${fileName}`);
    }
  } catch (error) {
    console.error('Failed to generate/send Bradford PO PDF:', error);
    // Don't fail the entire PO creation if PDF generation fails
  }

  return po;
}

export async function updatePOStatus(id: string, status: POStatus) {
  return prisma.purchaseOrder.update({
    where: { id },
    data: { status },
  });
}

export async function getPOById(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      originCompany: true,
      targetCompany: true,
      job: {
        include: {
          customer: true,
        },
      },
    },
  });
}

export async function listPurchaseOrders(filters?: {
  jobId?: string;
  originCompanyId?: string;
  targetCompanyId?: string;
  status?: POStatus;
}) {
  return prisma.purchaseOrder.findMany({
    where: {
      jobId: filters?.jobId,
      originCompanyId: filters?.originCompanyId,
      targetCompanyId: filters?.targetCompanyId,
      status: filters?.status,
    },
    include: {
      originCompany: true,
      targetCompany: true,
      job: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function findPOByExternalRef(externalRef: string) {
  return prisma.purchaseOrder.findFirst({
    where: { externalRef },
    include: {
      originCompany: true,
      targetCompany: true,
      job: true,
    },
  });
}

/**
 * Update purchase order
 * Allows editing amounts, status, and other fields
 */
export async function updatePurchaseOrder(
  poId: string,
  data: {
    originalAmount?: number;
    vendorAmount?: number;
    marginAmount?: number;
    status?: POStatus;
    externalRef?: string;
  }
) {
  const po = await prisma.purchaseOrder.update({
    where: { id: poId },
    data,
    include: {
      originCompany: true,
      targetCompany: true,
      job: {
        include: {
          customer: true,
        },
      },
    },
  });

  return po;
}

/**
 * Upload PDF for purchase order
 * Stores PDF as a file attachment
 */
export async function uploadPOPdf(
  poId: string,
  pdfBuffer: Buffer,
  fileName: string
) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { job: true },
  });

  if (!po) {
    throw new Error('Purchase order not found');
  }

  // Create file record
  const file = await createFile({
    jobId: po.jobId || undefined,
    kind: 'PO_PDF',
    file: pdfBuffer,
    fileName,
    mimeType: 'application/pdf',
  });

  // Update PO with file reference
  const updatedPO = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { pdfFileId: file.id },
    include: {
      originCompany: true,
      targetCompany: true,
      job: true,
      pdfFile: true,
    },
  });

  return { po: updatedPO, file };
}

/**
 * Upload Bradford PO PDF and extract PO number
 * Creates Bradford → JD Graphic purchase order
 */
export async function uploadBradfordPOPdf(
  jobId: string,
  pdfBuffer: Buffer,
  fileName: string,
  manualPONumber?: string
): Promise<{
  po: any;
  file: any;
  extractedPONumber: string | null;
  poNumber: string;
}> {
  // Get job and validate
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      purchaseOrders: {
        include: {
          originCompany: true,
          targetCompany: true,
        },
      },
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  // Extract PO# from PDF
  const extractedPONumber = await extractPONumber(pdfBuffer);

  // Use manual PO# if provided and valid, otherwise use extracted
  let poNumber: string;
  if (manualPONumber && validatePONumber(manualPONumber)) {
    poNumber = normalizePONumber(manualPONumber);
    console.log(`✅ Using manual Bradford PO#: ${poNumber}`);
  } else if (extractedPONumber && validatePONumber(extractedPONumber)) {
    poNumber = normalizePONumber(extractedPONumber);
    console.log(`✅ Using extracted Bradford PO#: ${poNumber}`);
  } else {
    // Fallback: generate PO# based on job number
    poNumber = `BRA-${job.jobNo}`;
    console.log(`⚠️ No valid PO# found, using generated: ${poNumber}`);
  }

  // Create file record
  const file = await createFile({
    jobId: job.id,
    kind: 'PO_PDF',
    file: pdfBuffer,
    fileName,
    mimeType: 'application/pdf',
  });

  // Find Bradford and JD Graphic companies
  const bradfordCompany = await prisma.company.findFirst({
    where: { name: { contains: 'Bradford', mode: 'insensitive' } },
  });

  const jdCompany = await prisma.company.findFirst({
    where: { name: { contains: 'JD Graphic', mode: 'insensitive' } },
  });

  if (!bradfordCompany || !jdCompany) {
    throw new Error('Bradford or JD Graphic company not found');
  }

  // Get customer PO# from job for reference
  const customerPONumber = job.customerPONumber || undefined;

  // Create Bradford → JD Graphic PO
  const po = await createPurchaseOrder({
    originCompanyId: bradfordCompany.id,
    targetCompanyId: jdCompany.id,
    jobId: job.id,
    originalAmount: parseFloat(job.bradfordTotal?.toString() || '0'),
    vendorAmount: parseFloat(job.jdTotal?.toString() || '0'),
    marginAmount: parseFloat(job.bradfordTotalMargin?.toString() || '0'),
    poNumber,
    referencePONumber: customerPONumber,
  });

  // Update PO with PDF file reference
  const updatedPO = await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: { pdfFileId: file.id },
    include: {
      originCompany: true,
      targetCompany: true,
      job: {
        include: {
          customer: true,
        },
      },
      pdfFile: true,
    },
  });

  console.log(
    `✅ Bradford PO created: ${poNumber} (${bradfordCompany.name} → ${jdCompany.name}) | Ref: ${customerPONumber || 'N/A'} | Amount: $${job.jdTotal}`
  );

  // Send email to JD Graphic with PO PDF
  try {
    const template = emailTemplates.bradfordPOToJD(
      job.jobNo,
      job.jobNo,
      poNumber,
      parseFloat(job.jdTotal?.toString() || '0')
    );

    const jdEmails = ['production@jdgraphic.com', 'nick@jdgraphic.com'];

    for (const email of jdEmails) {
      await queueEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer,
          },
        ],
      });

      await prisma.notification.create({
        data: {
          type: 'PO_CREATED',
          jobId: job.id,
          recipient: email,
          subject: template.subject,
          body: template.html,
        },
      });
    }

    console.log(`✅ Bradford PO PDF emailed to JD Graphic: ${jdEmails.join(', ')}`);
  } catch (error) {
    console.error('Failed to send Bradford PO email:', error);
    // Don't fail the entire operation if email fails
  }

  return {
    po: updatedPO,
    file,
    extractedPONumber,
    poNumber,
  };
}

/**
 * Generate formal Purchase Order PDF
 * Creates a professional PO document with company letterhead and terms
 * Can be used for any PO (Customer→Impact, Impact→Bradford, etc.)
 */
export async function generatePurchaseOrderPdf(purchaseOrderId: string) {
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

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;

  // Header - Company Letterhead
  page.drawText(po.originCompany.name.toUpperCase(), {
    x: 50,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.8),
  });

  y -= 25;

  // Company Address (if available)
  if (po.originCompany.address) {
    page.drawText(po.originCompany.address, {
      x: 50,
      y,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 15;
  }

  // Company Contact Info
  if (po.originCompany.email || po.originCompany.phone) {
    const contact = [
      po.originCompany.email,
      po.originCompany.phone,
    ]
      .filter(Boolean)
      .join(' | ');
    page.drawText(contact, {
      x: 50,
      y,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 15;
  }

  y -= 20;

  // Document Title
  page.drawText('PURCHASE ORDER', {
    x: 50,
    y,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  y -= 35;

  // PO Number and Date (on same line)
  const poNumber = po.poNumber || `PO-${po.id.slice(0, 8).toUpperCase()}`;
  page.drawText(`PO #: ${poNumber}`, {
    x: 50,
    y,
    size: 12,
    font: boldFont,
  });

  page.drawText(`Date: ${po.createdAt.toLocaleDateString()}`, {
    x: width - 200,
    y,
    size: 12,
    font,
  });

  y -= 25;

  // Reference PO Number if available
  if (po.referencePONumber) {
    page.drawText(`Reference: Customer PO# ${po.referencePONumber}`, {
      x: 50,
      y,
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0.6),
    });
    y -= 20;
  }

  y -= 10;

  // Vendor (To) Information
  page.drawText('VENDOR:', { x: 50, y, size: 12, font: boldFont });
  y -= 20;

  page.drawText(po.targetCompany.name, { x: 50, y, size: 11, font: boldFont });
  y -= 15;

  if (po.targetCompany.address) {
    page.drawText(po.targetCompany.address, { x: 50, y, size: 10, font });
    y -= 15;
  }

  if (po.targetCompany.email) {
    page.drawText(po.targetCompany.email, { x: 50, y, size: 10, font });
    y -= 15;
  }

  if (po.targetCompany.phone) {
    page.drawText(po.targetCompany.phone, { x: 50, y, size: 10, font });
    y -= 15;
  }

  y -= 20;

  // Job Details Section (if job is linked)
  if (po.job) {
    page.drawText('JOB DETAILS:', { x: 50, y, size: 12, font: boldFont });
    y -= 20;

    // Draw a box around job details
    const boxY = y - 70;
    page.drawRectangle({
      x: 50,
      y: boxY,
      width: width - 100,
      height: 85,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    });

    page.drawText(`Job #: ${po.job.jobNo}`, { x: 60, y: y - 5, size: 10, font });
    y -= 18;

    if (po.job.customerPONumber) {
      page.drawText(`Customer PO: ${po.job.customerPONumber}`, {
        x: 60,
        y: y - 5,
        size: 10,
        font,
      });
      y -= 18;
    }

    if (po.job.title) {
      const title = po.job.title.length > 60 ? po.job.title.substring(0, 60) + '...' : po.job.title;
      page.drawText(`Description: ${title}`, { x: 60, y: y - 5, size: 10, font });
      y -= 18;
    }

    if (po.job.quote) {
      const quantity = po.job.quote.quantity ? `Quantity: ${po.job.quote.quantity.toLocaleString()}` : '';
      const size = po.job.quote.size ? `Size: ${po.job.quote.size}` : '';
      const specs = [quantity, size].filter(Boolean).join(' | ');
      if (specs) {
        page.drawText(specs, { x: 60, y: y - 5, size: 10, font });
      }
    }

    y -= 30;
  }

  y -= 20;

  // Financial Details Section
  page.drawText('AMOUNT:', { x: 50, y, size: 12, font: boldFont });
  y -= 25;

  // Draw table header
  page.drawRectangle({
    x: 50,
    y: y - 70,
    width: width - 100,
    height: 85,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
  });

  // Table rows
  const drawRow = (label: string, amount: number, yPos: number, isBold = false) => {
    page.drawText(label, {
      x: 60,
      y: yPos,
      size: 11,
      font: isBold ? boldFont : font,
    });
    page.drawText(`$${amount.toFixed(2)}`, {
      x: width - 160,
      y: yPos,
      size: 11,
      font: isBold ? boldFont : font,
    });
  };

  drawRow('Vendor Amount (Payment Due):', parseFloat(po.vendorAmount.toString()), y - 5, true);
  y -= 20;

  if (po.originalAmount && parseFloat(po.originalAmount.toString()) !== parseFloat(po.vendorAmount.toString())) {
    drawRow('Original Amount:', parseFloat(po.originalAmount.toString()), y - 5);
    y -= 20;
  }

  if (po.marginAmount && parseFloat(po.marginAmount.toString()) > 0) {
    drawRow('Margin Amount:', parseFloat(po.marginAmount.toString()), y - 5);
    y -= 20;
  }

  y -= 30;

  // Status
  const statusColor = po.status === POStatus.COMPLETED ? rgb(0, 0.6, 0) :
                      po.status === POStatus.CANCELLED ? rgb(0.8, 0, 0) :
                      rgb(0.8, 0.6, 0);

  page.drawText(`Status: ${po.status}`, {
    x: 50,
    y: y - 5,
    size: 11,
    font: boldFont,
    color: statusColor,
  });

  y -= 40;

  // Terms and Conditions
  page.drawText('TERMS & CONDITIONS:', { x: 50, y, size: 10, font: boldFont });
  y -= 15;

  const terms = [
    '• Payment due upon completion of work',
    '• Any changes to this order must be approved in writing',
    '• Vendor must notify buyer of any delays or issues immediately',
    '• Work must meet quality standards as per industry specifications',
  ];

  terms.forEach((term) => {
    page.drawText(term, { x: 50, y, size: 8, font });
    y -= 12;
  });

  // Footer
  page.drawText(
    'This is a computer-generated purchase order and is valid without signature.',
    {
      x: 50,
      y: 50,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    }
  );

  // Save PDF
  const pdfBytes = await pdfDoc.save();

  // Upload to S3
  const file = await createFile({
    jobId: po.jobId || undefined,
    kind: 'PO_PDF',
    file: Buffer.from(pdfBytes),
    fileName: `${poNumber}.pdf`,
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
