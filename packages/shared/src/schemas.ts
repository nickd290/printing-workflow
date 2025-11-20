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
// Job Type-Specific Spec Schemas (for third-party vendors)
// ============================================================================

// Common fields shared across all job types
const commonSpecFields = {
  description: z.string().optional(),
  paper: z.string().optional(),
  colors: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  deliveryDate: z.string().optional(),
  orderDate: z.string().optional(),
  pickupDate: z.string().optional(),
  poolDate: z.string().optional(),
  samples: z.string().optional(),
  sampleInstructions: z.string().optional(),
  notes: z.string().optional(),
  rawPOText: z.string().optional(),
};

// Flat Piece Specs (postcards, flyers, etc.)
export const flatPieceSpecsSchema = z.object({
  jobType: z.literal('FLAT'),
  flatSize: z.string().optional(),
  bleeds: z.string().optional(),
  coverage: z.string().optional(), // Ink coverage (4/4, 4/1, etc.)
  stock: z.string().optional(), // Paper stock
  coating: z.string().optional(), // UV coating, aqueous, etc.
  ...commonSpecFields,
});

// Folded Piece Specs (brochures, tri-folds, etc.)
export const foldedPieceSpecsSchema = z.object({
  jobType: z.literal('FOLDED'),
  flatSize: z.string().optional(), // Before folding
  foldedSize: z.string().optional(), // After folding
  foldType: z.string().optional(), // Half fold, tri-fold, gate fold, etc.
  bleeds: z.string().optional(),
  finishing: z.string().optional(), // score, fold, score+fold
  stock: z.string().optional(),
  coating: z.string().optional(),
  coverage: z.string().optional(),
  ...commonSpecFields,
});

// Booklet (Self Cover) Specs - same stock for cover and interior
export const bookletSelfCoverSpecsSchema = z.object({
  jobType: z.literal('BOOKLET_SELF_COVER'),
  totalPages: z.number().int().positive().optional(), // Total page count
  pageSize: z.string().optional(), // 8.5 x 11, etc.
  bindingType: z.enum(['saddle-stitch', 'perfect-bound']).optional(),
  textStock: z.string().optional(), // Stock for all pages
  bleeds: z.string().optional(),
  coverage: z.string().optional(),
  coating: z.string().optional(),
  ...commonSpecFields,
});

// Booklet (Plus Cover) Specs - separate cover and interior stocks
export const bookletPlusCoverSpecsSchema = z.object({
  jobType: z.literal('BOOKLET_PLUS_COVER'),
  interiorPages: z.number().int().positive().optional(), // Interior page count (excluding cover)
  coverPages: z.literal(4).optional(), // Always 4 (front, inside front, inside back, back)
  pageSize: z.string().optional(),
  textStock: z.string().optional(), // Stock for interior pages
  coverStock: z.string().optional(), // Stock for cover (heavier)
  bindingType: z.enum(['saddle-stitch', 'perfect-bound']).optional(),
  textBleeds: z.string().optional(), // Bleeds for text pages
  coverBleeds: z.string().optional(), // Bleeds for cover
  textCoverage: z.string().optional(), // Ink coverage for text
  coverCoverage: z.string().optional(), // Ink coverage for cover
  textCoating: z.string().optional(),
  coverCoating: z.string().optional(),
  ...commonSpecFields,
});

// Legacy specs for Bradford/JD workflow (no jobType)
export const legacyJobSpecsSchema = z.record(z.any());

// Discriminated union of all job specs types
export const jobSpecsSchema = z.discriminatedUnion('jobType', [
  flatPieceSpecsSchema,
  foldedPieceSpecsSchema,
  bookletSelfCoverSpecsSchema,
  bookletPlusCoverSpecsSchema,
]).or(legacyJobSpecsSchema); // Allow legacy specs for Bradford/JD flow

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
