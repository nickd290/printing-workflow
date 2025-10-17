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

export const purchaseOrdersAPI = {
  create: async (data: CreatePurchaseOrderBody) => {
    const response = await fetch(`${API_URL}/api/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
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

export const invoicesAPI = {
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

export const revenueAPI = {
  getMetrics: async () => {
    const response = await fetch(`${API_URL}/api/revenue/metrics`);
    return handleResponse<any>(response);
  },
};

// ============================================================================
// Export error class for error handling
// ============================================================================

export { APIError };
