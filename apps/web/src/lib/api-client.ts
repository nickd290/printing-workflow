/**
 * API Client for frontend
 * Handles all HTTP requests to the Fastify backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new APIError(
      error.error || `HTTP ${response.status}`,
      response.status,
      error
    );
  }

  return response.json();
}

// ============================================================================
// Quotes API
// ============================================================================

export interface ParseTextRequest {
  text: string;
}

export interface ParsedSpecs {
  paper?: string;
  size?: string;
  quantity?: number;
  colors?: string;
  finishing?: string;
  requestedDate?: string;
  notes?: string;
}

export interface CreateQuoteRequestBody {
  customerId: string;
  specs: Record<string, any>;
}

export interface CreateQuoteBody {
  quoteRequestId: string;
  lines: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  tax: number;
  total: number;
  validUntil: string;
  notes?: string;
}

export const quotesAPI = {
  parseText: async (text: string): Promise<{ specs: ParsedSpecs }> => {
    const response = await fetch(`${API_URL}/api/quotes/parse-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return handleResponse(response);
  },

  createRequest: async (data: CreateQuoteRequestBody) => {
    const response = await fetch(`${API_URL}/api/quotes/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  create: async (data: CreateQuoteBody) => {
    const response = await fetch(`${API_URL}/api/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  approve: async (quoteId: string) => {
    const response = await fetch(`${API_URL}/api/quotes/${quoteId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  getById: async (quoteId: string) => {
    const response = await fetch(`${API_URL}/api/quotes/${quoteId}`);
    return handleResponse(response);
  },

  list: async (params?: { customerId?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/api/quotes?${query}`);
    return handleResponse<{ quotes: any[] }>(response);
  },
};

// ============================================================================
// Jobs API
// ============================================================================

export interface CreateDirectJobBody {
  customerId: string;
  sizeId: string;
  quantity: number;
  description?: string;
  specs?: Record<string, any>;
  customPrice?: number; // Custom customer price (if different from standard pricing)
}

export const jobsAPI = {
  createFromQuote: async (quoteId: string) => {
    const response = await fetch(`${API_URL}/api/jobs/from-quote/${quoteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  createDirect: async (data: CreateDirectJobBody) => {
    const response = await fetch(`${API_URL}/api/jobs/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateStatus: async (jobId: string, status: string) => {
    const response = await fetch(`${API_URL}/api/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return handleResponse(response);
  },

  getById: async (jobId: string) => {
    const response = await fetch(`${API_URL}/api/jobs/${jobId}`);
    return handleResponse(response);
  },

  getByJobNo: async (jobNo: string) => {
    const response = await fetch(`${API_URL}/api/jobs/by-number/${jobNo}`);
    return handleResponse(response);
  },

  list: async (params?: { customerId?: string; status?: string; companyId?: string; userRole?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/api/jobs?${query}`);
    return handleResponse<{ jobs: any[] }>(response);
  },
};

// ============================================================================
// Proofs API
// ============================================================================

export interface UploadProofBody {
  jobId: string;
  fileId: string;
}

export interface ApproveProofBody {
  proofId: string;
  approvedBy: string;
  comments?: string;
}

export interface RequestProofChangesBody {
  proofId: string;
  comments: string;
  requestedBy: string;
}

export const proofsAPI = {
  upload: async (jobId: string, fileId: string) => {
    const response = await fetch(`${API_URL}/api/proofs/${jobId}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    });
    return handleResponse(response);
  },

  approve: async (proofId: string, approvedBy: string, comments?: string) => {
    const response = await fetch(`${API_URL}/api/proofs/${proofId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy, comments }),
    });
    return handleResponse(response);
  },

  requestChanges: async (proofId: string, requestedBy: string, comments: string) => {
    const response = await fetch(`${API_URL}/api/proofs/${proofId}/request-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedBy, comments }),
    });
    return handleResponse(response);
  },

  getById: async (proofId: string) => {
    const response = await fetch(`${API_URL}/api/proofs/${proofId}`);
    return handleResponse(response);
  },

  listByJob: async (jobId: string) => {
    const response = await fetch(`${API_URL}/api/proofs/by-job/${jobId}`);
    return handleResponse<{ proofs: any[] }>(response);
  },
};

// ============================================================================
// Purchase Orders API
// ============================================================================

export interface CreatePurchaseOrderBody {
  originCompanyId: string;
  targetCompanyId: string;
  jobId?: string;
  originalAmount: number;
  vendorAmount: number;
  marginAmount: number;
  externalRef?: string;
}

export interface UpdatePurchaseOrderBody {
  originalAmount?: number;
  vendorAmount?: number;
  marginAmount?: number;
  status?: string;
  externalRef?: string;
}

export const purchaseOrdersAPI = {
  create: async (data: CreatePurchaseOrderBody) => {
    const response = await fetch(`${API_URL}/api/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (poId: string, data: UpdatePurchaseOrderBody) => {
    const response = await fetch(`${API_URL}/api/purchase-orders/${poId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  uploadPdf: async (poId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/purchase-orders/${poId}/upload-pdf`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  generatePdf: async (poId: string) => {
    const response = await fetch(`${API_URL}/api/purchase-orders/${poId}/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  uploadBradfordPDF: async (file: File, jobId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (jobId) formData.append('jobId', jobId);

    const response = await fetch(`${API_URL}/api/purchase-orders/upload-bradford-pdf`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<{
      success: boolean;
      purchaseOrder: any;
      parsed: {
        customerCode: string;
        customerId: string;
        amount: number;
        poNumber?: string;
        description?: string;
      };
    }>(response);
  },

  updateStatus: async (poId: string, status: string) => {
    const response = await fetch(`${API_URL}/api/purchase-orders/${poId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return handleResponse(response);
  },

  getById: async (poId: string) => {
    const response = await fetch(`${API_URL}/api/purchase-orders/${poId}`);
    return handleResponse(response);
  },

  list: async (params?: {
    jobId?: string;
    originCompanyId?: string;
    targetCompanyId?: string;
    status?: string;
  }) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/api/purchase-orders?${query}`);
    return handleResponse<{ purchaseOrders: any[] }>(response);
  },
};

// ============================================================================
// Files API
// ============================================================================

export const filesAPI = {
  upload: async (file: File, kind: string, jobId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);
    if (jobId) formData.append('jobId', jobId);

    const response = await fetch(`${API_URL}/api/files/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  getById: async (fileId: string) => {
    const response = await fetch(`${API_URL}/api/files/${fileId}`);
    return handleResponse(response);
  },

  getDownloadUrl: async (fileId: string) => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/download-url`);
    return handleResponse<{ url: string }>(response);
  },

  list: async (params?: { jobId?: string; kind?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/api/files?${query}`);
    return handleResponse<{ files: any[] }>(response);
  },

  delete: async (fileId: string) => {
    const response = await fetch(`${API_URL}/api/files/${fileId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Invoices API
// ============================================================================

export interface CreateInvoiceBody {
  jobId?: string;
  fromCompanyId: string;
  toCompanyId: string;
  amount: number;
  status?: string;
  dueAt?: string;
  issuedAt?: string;
}

export interface UpdateInvoiceBody {
  amount?: number;
  status?: string;
  dueAt?: string;
  issuedAt?: string;
  paidAt?: string;
}

export const invoicesAPI = {
  create: async (data: CreateInvoiceBody) => {
    const response = await fetch(`${API_URL}/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (invoiceId: string, data: UpdateInvoiceBody) => {
    const response = await fetch(`${API_URL}/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  uploadPdf: async (invoiceId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/invoices/${invoiceId}/upload-pdf`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  generatePdf: async (invoiceId: string) => {
    const response = await fetch(`${API_URL}/api/invoices/${invoiceId}/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  generate: async (jobId: string) => {
    const response = await fetch(`${API_URL}/api/invoices/${jobId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  getById: async (invoiceId: string) => {
    const response = await fetch(`${API_URL}/api/invoices/${invoiceId}`);
    return handleResponse(response);
  },

  list: async (params?: { jobId?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/api/invoices?${query}`);
    return handleResponse<{ invoices: any[] }>(response);
  },
};

// ============================================================================
// Shipments API
// ============================================================================

export const shipmentsAPI = {
  schedule: async (jobId: string, data: any) => {
    const response = await fetch(`${API_URL}/api/shipments/${jobId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getById: async (shipmentId: string) => {
    const response = await fetch(`${API_URL}/api/shipments/${shipmentId}`);
    return handleResponse(response);
  },

  list: async (params?: { jobId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/api/shipments?${query}`);
    return handleResponse<{ shipments: any[] }>(response);
  },
};

// ============================================================================
// Revenue API
// ============================================================================

export interface POFlowMetrics {
  stages: {
    customerToImpact: {
      count: number;
      totalAmount: number;
      byStatus: Record<string, number>;
    };
    impactToBradford: {
      count: number;
      totalAmount: number;
      marginAmount: number;
      byStatus: Record<string, number>;
    };
    bradfordToJD: {
      count: number;
      totalAmount: number;
      marginAmount: number;
      byStatus: Record<string, number>;
    };
  };
  summary: {
    totalPOs: number;
    totalRevenue: number;
    totalCosts: number;
    impactMargin: number;
    bradfordMargin: number;
  };
}

export const revenueAPI = {
  getMetrics: async () => {
    const response = await fetch(`${API_URL}/api/revenue/metrics`);
    return handleResponse<any>(response);
  },

  getBradfordMetrics: async () => {
    const response = await fetch(`${API_URL}/api/revenue/bradford`);
    return handleResponse<any>(response);
  },

  getPOFlowMetrics: async () => {
    const response = await fetch(`${API_URL}/api/revenue/po-flow`);
    return handleResponse<POFlowMetrics>(response);
  },
};

// ============================================================================
// Paper Inventory API
// ============================================================================

export type PaperRollType = '20_7pt_matte' | '18_7pt_matte' | '15_7pt_matte' | '20_9pt';
export type TransactionType = 'ADD' | 'REMOVE' | 'ADJUST' | 'JOB_USAGE';

export interface PaperInventory {
  id: string;
  rollType: PaperRollType;
  rollWidth: number;
  paperPoint: number;
  paperType: string;
  quantity: number;
  weightPerRoll?: number;
  reorderPoint?: number;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  transactions?: PaperTransaction[];
}

export interface PaperTransaction {
  id: string;
  inventoryId: string;
  type: TransactionType;
  quantity: number;
  jobId?: string;
  notes?: string;
  userId?: string;
  createdAt: string;
}

export interface AdjustInventoryBody {
  rollType: PaperRollType;
  quantity: number;
  type: TransactionType;
  companyId?: string;
  jobId?: string;
  notes?: string;
  userId?: string;
}

export interface DeductForJobBody {
  jobId: string;
  rollType: PaperRollType;
  quantity: number;
  userId?: string;
  notes?: string;
}

export interface UpdateInventorySettingsBody {
  reorderPoint?: number;
  weightPerRoll?: number;
  companyId?: string;
}

export const paperInventoryAPI = {
  getAll: async (companyId?: string) => {
    const query = companyId ? `?companyId=${companyId}` : '';
    const response = await fetch(`${API_URL}/api/paper-inventory${query}`);
    return handleResponse<{ inventory: PaperInventory[] }>(response);
  },

  getSummary: async (companyId?: string) => {
    const query = companyId ? `?companyId=${companyId}` : '';
    const response = await fetch(`${API_URL}/api/paper-inventory/summary${query}`);
    return handleResponse<{
      inventory: PaperInventory[];
      lowStockItems: PaperInventory[];
      totalRolls: number;
      totalWeight: number;
      lowStockCount: number;
    }>(response);
  },

  getLowStock: async (companyId?: string) => {
    const query = companyId ? `?companyId=${companyId}` : '';
    const response = await fetch(`${API_URL}/api/paper-inventory/low-stock${query}`);
    return handleResponse<{ lowStockItems: PaperInventory[] }>(response);
  },

  getByRollType: async (rollType: PaperRollType, companyId?: string) => {
    const query = companyId ? `?companyId=${companyId}` : '';
    const response = await fetch(`${API_URL}/api/paper-inventory/${rollType}${query}`);
    return handleResponse<PaperInventory>(response);
  },

  initialize: async (companyId?: string) => {
    const response = await fetch(`${API_URL}/api/paper-inventory/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    });
    return handleResponse<{ inventory: PaperInventory[]; message: string }>(response);
  },

  adjust: async (data: AdjustInventoryBody) => {
    const response = await fetch(`${API_URL}/api/paper-inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{
      success: boolean;
      inventory: PaperInventory;
      transaction: PaperTransaction;
    }>(response);
  },

  deductForJob: async (data: DeductForJobBody) => {
    const response = await fetch(`${API_URL}/api/paper-inventory/deduct-for-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{
      success: boolean;
      inventory: PaperInventory;
      transaction: PaperTransaction;
    }>(response);
  },

  getTransactions: async (filters?: {
    companyId?: string;
    rollType?: PaperRollType;
    jobId?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams(filters as any).toString();
    const response = await fetch(`${API_URL}/api/paper-inventory/transactions?${query}`);
    return handleResponse<{ transactions: PaperTransaction[] }>(response);
  },

  updateSettings: async (rollType: PaperRollType, settings: UpdateInventorySettingsBody) => {
    const response = await fetch(`${API_URL}/api/paper-inventory/${rollType}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return handleResponse<{ success: boolean; inventory: PaperInventory }>(response);
  },
};

// ============================================================================
// Admin API
// ============================================================================

export interface MissingPdfsResponse {
  invoices: Array<{
    id: string;
    invoiceNo: string;
    amount: number;
    status: string;
    jobNo?: string;
    toCompany: string;
    fromCompany: string;
    createdAt: Date;
  }>;
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    vendorAmount: number;
    status: string;
    jobNo?: string;
    originCompany: string;
    targetCompany: string;
    createdAt: Date;
  }>;
  summary: {
    totalInvoicesWithoutPdfs: number;
    totalPurchaseOrdersWithoutPdfs: number;
  };
}

export interface GenerateMissingPdfsResponse {
  success: boolean;
  message: string;
  results: {
    invoices: { success: number; failed: number; errors: string[] };
    purchaseOrders: { success: number; failed: number; errors: string[] };
  };
}

export const adminAPI = {
  getMissingPdfs: async () => {
    const response = await fetch(`${API_URL}/api/admin/pdfs/missing`);
    return handleResponse<MissingPdfsResponse>(response);
  },

  generateMissingPdfs: async (type?: 'invoices' | 'purchase-orders' | 'all') => {
    const response = await fetch(`${API_URL}/api/admin/pdfs/generate-missing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type || 'all' }),
    });
    return handleResponse<GenerateMissingPdfsResponse>(response);
  },
};

// ============================================================================
// Export error class for error handling
// ============================================================================

export { APIError };
