/**
 * API Client for frontend
 * Handles all HTTP requests to the Fastify backend
 */

// Initialize API URL with production validation
const API_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  const nodeEnv = process.env.NODE_ENV;

  // In production, NEXT_PUBLIC_API_URL MUST be set
  if (nodeEnv === 'production' && !url) {
    throw new Error(
      '❌ CRITICAL: NEXT_PUBLIC_API_URL is not configured for production deployment.\n\n' +
      'This environment variable must be set in your Railway web service settings.\n' +
      'Expected format: https://your-api-service.up.railway.app\n\n' +
      'To fix:\n' +
      '1. Go to Railway Dashboard → printing-workflow → web service\n' +
      '2. Navigate to Variables tab\n' +
      '3. Add: NEXT_PUBLIC_API_URL=https://api-production-100d.up.railway.app\n' +
      '4. Railway will automatically rebuild with the new variable'
    );
  }

  // In development, warn if using production-like URL
  if (nodeEnv === 'development' && url && !url.includes('localhost')) {
    console.warn(
      '⚠️  WARNING: NEXT_PUBLIC_API_URL is set to a production URL in development mode:',
      url,
      '\n   This may cause unexpected behavior. Consider using http://localhost:3001 for local dev.'
    );
  }

  // Default to localhost in development only
  const finalUrl = url || 'http://localhost:3001';

  // Log configuration for debugging
  console.log('🔗 API Client Configuration:', {
    environment: nodeEnv,
    apiUrl: finalUrl,
    isProduction: nodeEnv === 'production',
    isConfigured: !!url,
    usingDefault: !url,
  });

  return finalUrl;
})();

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
  customerPONumber: string;
  description?: string;
  specs?: Record<string, any>;
  customPrice?: number; // Custom customer price (if different from standard pricing)
  customPaperCPM?: number; // Custom Bradford paper CPM (per job override)
}

export interface CreateCustomerJobBody {
  customerId: string;
  description?: string;
  paper?: string;
  flatSize?: string;
  foldedSize?: string;
  colors?: string;
  finishing?: string;
  total?: string;
  poNumber?: string;
  deliveryDate?: string;
  samples?: string;
  requiredArtworkCount?: number;
  requiredDataFileCount?: number;
  notes?: string;
  quantity?: string;
  // Routing fields
  routingType?: 'BRADFORD_JD' | 'THIRD_PARTY_VENDOR';
  vendorId?: string;
  vendorAmount?: string;
  bradfordCut?: string;
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

  createCustomerJob: async (data: CreateCustomerJobBody) => {
    const response = await fetch(`${API_URL}/api/customer/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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

  approve: async (jobId: string, approvedBy: string, reason?: string) => {
    const response = await fetch(`${API_URL}/api/jobs/${jobId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy, reason }),
    });
    return handleResponse(response);
  },

  reject: async (jobId: string, rejectedBy: string, reason: string) => {
    const response = await fetch(`${API_URL}/api/jobs/${jobId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectedBy, reason }),
    });
    return handleResponse(response);
  },

  getPendingApproval: async () => {
    const response = await fetch(`${API_URL}/api/jobs/pending-approval`);
    return handleResponse<{ jobs: any[]; count: number }>(response);
  },

  delete: async (jobId: string, deletedBy?: string) => {
    const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletedBy }),
    });
    return handleResponse(response);
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
  parsePO: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/files/parse-po`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<{
      success: boolean;
      message?: string;
      parsed?: any;
    }>(response);
  },

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
// Reports API
// ============================================================================

export const reportsAPI = {
  /**
   * Download daily summary Excel report
   * @param date Optional date in YYYY-MM-DD format, defaults to today
   * @returns Promise that resolves when download starts
   */
  downloadDailySummary: async (date?: string) => {
    const url = date
      ? `${API_URL}/api/reports/daily-summary?date=${date}`
      : `${API_URL}/api/reports/daily-summary`;

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to download report' }));
      throw new APIError(
        error.error || `HTTP ${response.status}`,
        response.status,
        error
      );
    }

    // Get the blob from response
    const blob = await response.blob();

    // Create download link
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Daily_Summary_${date || new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },

  getBradfordDashboardMetrics: async () => {
    const response = await fetch(`${API_URL}/api/reports/bradford/dashboard-metrics`);
    return handleResponse<any>(response);
  },

  getBradfordPaperMargins: async () => {
    const response = await fetch(`${API_URL}/api/reports/bradford/paper-margins`);
    return handleResponse<any>(response);
  },

  exportBradfordReport: async () => {
    const response = await fetch(`${API_URL}/api/reports/bradford/export`);
    return handleResponse<{ success: boolean; error?: string }>(response);
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

export interface CreateCustomerBody {
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  userName: string;
  userEmail: string;
  password: string;
}

export interface CustomerResponse {
  success: boolean;
  message: string;
  customer: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
    company: {
      id: string;
      name: string;
      email?: string;
      phone?: string;
      address?: string;
    };
  };
  credentials: {
    email: string;
    password: string;
  };
}

export interface CustomerListResponse {
  customers: Array<{
    id: string;
    name: string;
    type: string;
    email?: string;
    phone?: string;
    address?: string;
    users: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      createdAt: Date;
    }>;
  }>;
  count: number;
}

export interface UpdateCustomerBody {
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
}

export interface UpdateUserBody {
  userName?: string;
  userEmail?: string;
  password?: string;
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

  createCustomer: async (data: CreateCustomerBody) => {
    const response = await fetch(`${API_URL}/api/admin/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<CustomerResponse>(response);
  },

  listCustomers: async () => {
    const response = await fetch(`${API_URL}/api/admin/customers`);
    return handleResponse<CustomerListResponse>(response);
  },

  getCustomer: async (id: string) => {
    const response = await fetch(`${API_URL}/api/admin/customers/${id}`);
    return handleResponse<{ customer: any }>(response);
  },

  updateCustomer: async (id: string, data: UpdateCustomerBody) => {
    const response = await fetch(`${API_URL}/api/admin/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean; message: string; customer: any }>(response);
  },

  updateCustomerUser: async (companyId: string, userId: string, data: UpdateUserBody) => {
    const response = await fetch(`${API_URL}/api/admin/customers/${companyId}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean; message: string; user: any }>(response);
  },
};

// ============================================================================
// Vendors API
// ============================================================================

export interface Vendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    jobs: number;
  };
}

export interface CreateVendorBody {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateVendorBody {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}

export const vendorsAPI = {
  list: async (filters?: { isActive?: boolean; search?: string }) => {
    const query = new URLSearchParams(filters as any).toString();
    const response = await fetch(`${API_URL}/api/vendors?${query}`, {
      credentials: 'include',
    });
    return handleResponse<Vendor[]>(response);
  },

  getById: async (id: string) => {
    const response = await fetch(`${API_URL}/api/vendors/${id}`, {
      credentials: 'include',
    });
    return handleResponse<Vendor>(response);
  },

  create: async (data: CreateVendorBody) => {
    const response = await fetch(`${API_URL}/api/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<Vendor>(response);
  },

  update: async (id: string, data: UpdateVendorBody) => {
    const response = await fetch(`${API_URL}/api/vendors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<Vendor>(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_URL}/api/vendors/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; vendor: Vendor }>(response);
  },
};

// ============================================================================
// Companies API
// ============================================================================

export interface Company {
  id: string;
  name: string;
  type: 'customer' | 'vendor' | 'internal';
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    jobs: number;
  };
}

export const companiesAPI = {
  list: async (filters?: { type?: 'customer' | 'vendor' | 'internal'; search?: string }) => {
    const query = new URLSearchParams(filters as any).toString();
    const response = await fetch(`${API_URL}/api/companies?${query}`, {
      credentials: 'include',
    });
    return handleResponse<Company[]>(response);
  },

  getById: async (id: string) => {
    const response = await fetch(`${API_URL}/api/companies/${id}`, {
      credentials: 'include',
    });
    return handleResponse<Company>(response);
  },
};

// ============================================================================
// Export error class for error handling
// ============================================================================

export { APIError };
