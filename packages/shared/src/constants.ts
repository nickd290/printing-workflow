// Job number format: J-YYYY-NNNNNN
export const JOB_NUMBER_PREFIX = 'J-';

// Invoice number format: INV-YYYY-NNNNNN
export const INVOICE_NUMBER_PREFIX = 'INV-';

// Auto PO margin percentages
export const IMPACT_TO_BRADFORD_VENDOR_RATE = 0.8; // 80% to Bradford
export const IMPACT_TO_BRADFORD_MARGIN_RATE = 0.2; // 20% margin for Impact

// Company IDs (from seed)
export const COMPANY_IDS = {
  IMPACT_DIRECT: 'impact-direct',
  BRADFORD: 'bradford',
  JD_GRAPHIC: 'jd-graphic',
  JJSA: 'jjsa',
  BALLANTINE: 'ballantine',
} as const;

// Customer codes (used in Bradford emails)
export const CUSTOMER_CODES = {
  JJSA: 'JJSG',
  BALLANTINE: 'BALSG',
} as const;

// Map customer codes to company IDs
export const CUSTOMER_CODE_TO_ID: Record<string, string> = {
  'JJSG': COMPANY_IDS.JJSA,
  'BALSG': COMPANY_IDS.BALLANTINE,
};

// Email templates
export const EMAIL_TEMPLATES = {
  QUOTE_READY: 'quote-ready',
  PROOF_READY: 'proof-ready',
  PROOF_APPROVED: 'proof-approved',
  SHIPMENT_NOTICE: 'shipment-notice',
  INVOICE_SENT: 'invoice-sent',
} as const;

// Queue names
export const QUEUE_NAMES = {
  EMAIL: 'email',
  PDF_GENERATION: 'pdf-generation',
  PURCHASE_ORDERS: 'purchase-orders',
} as const;
