import { z } from 'zod';

// ============================================================================
// Quote Request Schemas
// ============================================================================

export const quoteRequestSpecsSchema = z.object({
  paper: z.string(),
  size: z.string(),
  quantity: z.number().int().positive(),
  colors: z.string(),
  finishing: z.string().optional(),
  requestedDate: z.string().optional(),
  notes: z.string().optional(),
});

export const createQuoteRequestSchema = z.object({
  customerId: z.string(),
  specs: quoteRequestSpecsSchema,
});

export const parseTextRequestSchema = z.object({
  text: z.string().min(1),
});

// ============================================================================
// Quote Schemas
// ============================================================================

export const quoteLineSchema = z.object({
  description: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

export const createQuoteSchema = z.object({
  quoteRequestId: z.string(),
  lines: z.array(quoteLineSchema),
  subtotal: z.number().positive(),
  tax: z.number().nonnegative().default(0),
  total: z.number().positive(),
  validUntil: z.string().datetime(),
  notes: z.string().optional(),
});

export const approveQuoteSchema = z.object({
  quoteId: z.string(),
});

// ============================================================================
// Job Schemas
// ============================================================================

export const createJobSchema = z.object({
  quoteId: z.string().optional(),
  customerId: z.string(),
  sizeId: z.string(), // 'SM_7_25_16_375', 'SM_8_5_17_5', etc.
  quantity: z.number().int().positive(),
  customerPONumber: z.string(),
  description: z.string().optional(),
  specs: z.record(z.any()).optional(), // Optional flexible JSON object
  customPrice: z.number().positive().optional(), // Custom customer price (optional)
  customPaperCPM: z.number().positive().optional(), // Custom Bradford paper CPM (optional)
});

// ============================================================================
// Proof Schemas
// ============================================================================

export const uploadProofSchema = z.object({
  jobId: z.string(),
  fileId: z.string(),
});

export const approveProofSchema = z.object({
  proofId: z.string(),
  comments: z.string().optional(),
  approvedBy: z.string().optional(),
});

export const requestProofChangesSchema = z.object({
  proofId: z.string(),
  comments: z.string().min(1),
  approvedBy: z.string().optional(),
});

// ============================================================================
// Shipment Schemas
// ============================================================================

export const shipmentRecipientSchema = z.object({
  companyId: z.string().optional(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  phone: z.string().optional(),
});

export const scheduleShipmentSchema = z.object({
  jobId: z.string(),
  carrier: z.string(),
  trackingNo: z.string().optional(),
  weight: z.number().positive().optional(),
  boxes: z.number().int().positive().optional(),
  scheduledAt: z.string().datetime().optional(),
  recipients: z.array(shipmentRecipientSchema),
});

// ============================================================================
// Invoice Schemas
// ============================================================================

export const generateInvoiceSchema = z.object({
  jobId: z.string(),
});

// ============================================================================
// File Schemas
// ============================================================================

export const uploadFileSchema = z.object({
  jobId: z.string().optional(),
  kind: z.enum(['ARTWORK', 'DATA_FILE', 'PROOF', 'INVOICE', 'PO_PDF']),
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  checksum: z.string(),
});

// ============================================================================
// Webhook Schemas
// ============================================================================

export const bradfordWebhookSchema = z.object({
  componentId: z.string(),
  estimateNumber: z.string(),
  amount: z.number().positive(),
  pdfUrl: z.string().url().optional(),
  // Additional fields as needed
});

// ============================================================================
// Purchase Order Schemas
// ============================================================================

export const createPurchaseOrderSchema = z.object({
  originCompanyId: z.string(),
  targetCompanyId: z.string(),
  jobId: z.string().optional(),
  originalAmount: z.number().positive(),
  vendorAmount: z.number().positive(),
  marginAmount: z.number().nonnegative(),
  externalRef: z.string().optional(),
});
