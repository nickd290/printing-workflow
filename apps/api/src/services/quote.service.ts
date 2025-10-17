import { prisma } from '@printing-workflow/db';
import { QuoteRequestStatus } from '@printing-workflow/db';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';

export async function createQuoteRequest(data: {
  customerId: string;
  specs: any;
}) {
  const quoteRequest = await prisma.quoteRequest.create({
    data: {
      customerId: data.customerId,
      specs: data.specs,
      status: QuoteRequestStatus.PENDING,
    },
    include: {
      customer: true,
    },
  });

  return quoteRequest;
}

export async function createQuote(data: {
  quoteRequestId: string;
  lines: any[];
  subtotal: number;
  tax: number;
  total: number;
  validUntil: Date;
  notes?: string;
}) {
  // Update quote request status
  const quoteRequest = await prisma.quoteRequest.update({
    where: { id: data.quoteRequestId },
    data: { status: QuoteRequestStatus.QUOTED },
    include: {
      customer: true,
    },
  });

  // Create quote
  const quote = await prisma.quote.create({
    data: {
      quoteRequestId: data.quoteRequestId,
      lines: data.lines,
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      validUntil: data.validUntil,
      notes: data.notes,
    },
  });

  // Queue email notification
  const template = emailTemplates.quoteReady(
    `Quote #${quote.id.substring(0, 8)}`,
    quote.id
  );

  await queueEmail({
    to: quoteRequest.customer.email || '',
    subject: template.subject,
    html: template.html,
  });

  // Create notification record
  await prisma.notification.create({
    data: {
      type: 'QUOTE_READY',
      recipient: quoteRequest.customer.email || '',
      subject: template.subject,
      body: template.html,
    },
  });

  return quote;
}

export async function approveQuote(quoteId: string) {
  const quote = await prisma.quote.update({
    where: { id: quoteId },
    data: { approvedAt: new Date() },
    include: {
      quoteRequest: {
        include: {
          customer: true,
        },
      },
    },
  });

  // Update quote request status
  await prisma.quoteRequest.update({
    where: { id: quote.quoteRequestId },
    data: { status: QuoteRequestStatus.APPROVED },
  });

  return quote;
}

export async function getQuoteById(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      quoteRequest: {
        include: {
          customer: true,
        },
      },
    },
  });
}

export async function listQuotes(filters?: {
  customerId?: string;
  status?: QuoteRequestStatus;
}) {
  return prisma.quote.findMany({
    where: {
      quoteRequest: {
        customerId: filters?.customerId,
        status: filters?.status,
      },
    },
    include: {
      quoteRequest: {
        include: {
          customer: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * AI-powered text parsing stub
 * TODO: Implement actual OpenAI integration
 */
export async function parseSpecsFromText(text: string) {
  // Stub implementation - returns basic parsing
  // In production, this would use OpenAI to extract specs

  const lines = text.toLowerCase().split('\n');

  // Simple keyword extraction
  const specs = {
    paper: 'Not specified',
    size: '8.5x11',
    quantity: 1000,
    colors: '4/4',
    finishing: 'none',
    notes: text,
  };

  // Try to extract quantity
  const qtyMatch = text.match(/(\d+)\s*(pcs|pieces|qty|quantity)?/i);
  if (qtyMatch) {
    specs.quantity = parseInt(qtyMatch[1], 10);
  }

  // Try to extract size
  const sizeMatch = text.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i);
  if (sizeMatch) {
    specs.size = `${sizeMatch[1]}x${sizeMatch[2]}`;
  }

  // Try to extract colors
  const colorMatch = text.match(/(\d+\/\d+)\s*(color|colors)?/i);
  if (colorMatch) {
    specs.colors = colorMatch[1];
  }

  return specs;
}
