'use client';

import { Tabs } from '@/components/Tabs';
import { BatchPaymentModal } from '@/components/BatchPaymentModal';
import { EditInvoiceModal } from '@/components/EditInvoiceModal';
import { Navigation } from '@/components/Navigation';
import { useUser } from '@/contexts/UserContext';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Invoice {
  id: string;
  invoiceNo: string;
  jobNo: string;
  jobId: string | null;
  toCompany: string;
  fromCompany: string;
  toCompanyId: string;
  fromCompanyId: string;
  amount: number;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
}

export default function InvoicesPage() {
  const { user, isCustomer } = useUser();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [batchPaymentData, setBatchPaymentData] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('impact-customer');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  // Fetch invoices
  useEffect(() => {
    fetchInvoices();
  }, [user, isCustomer]);

  const fetchInvoices = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // For customers, filter by their company ID
      const queryParams = isCustomer && user.companyId
        ? `?toCompanyId=${user.companyId}`
        : '';

      const response = await fetch(`${API_URL}/api/invoices${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch invoices');

      const data = await response.json();

      // Transform the data to match our interface (no filtering, we'll filter by tab)
      const transformedInvoices = data.invoices.map((inv: any) => ({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          jobNo: inv.job?.jobNo || 'N/A',
          jobId: inv.jobId || null,
          toCompany: inv.toCompany?.name || 'Unknown',
          fromCompany: inv.fromCompany?.name || 'Unknown',
          toCompanyId: inv.toCompanyId,
          fromCompanyId: inv.fromCompanyId,
          amount: parseFloat(inv.amount.toString()),
          issuedAt: inv.issuedAt,
          dueAt: inv.dueAt,
          paidAt: inv.paidAt,
        }));

      setInvoices(transformedInvoices);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      toast.loading('Exporting invoices to CSV...', { id: 'export-invoices' });
      const response = await fetch(`${API_URL}/api/exports/invoices`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Invoices exported successfully!', { id: 'export-invoices' });
    } catch (error) {
      console.error('Failed to export invoices:', error);
      toast.error('Failed to export invoices', { id: 'export-invoices' });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const customerInvoiceIds = displayedInvoices.map(inv => inv.id);
      setSelectedInvoices(new Set(customerInvoiceIds));
    } else {
      setSelectedInvoices(new Set());
    }
  };

  const handleSelectInvoice = (invoiceId: string, checked: boolean) => {
    const newSelected = new Set(selectedInvoices);
    if (checked) {
      newSelected.add(invoiceId);
    } else {
      newSelected.delete(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const handleEditInvoice = async (invoice: Invoice) => {
    try {
      setSelectedInvoice(invoice);

      // Fetch job data if jobId exists
      if (invoice.jobId) {
        const response = await fetch(`${API_URL}/api/jobs/${invoice.jobId}`);
        if (response.ok) {
          const jobData = await response.json();
          setSelectedJob(jobData);
        } else {
          setSelectedJob(null);
        }
      } else {
        setSelectedJob(null);
      }

      setEditModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch job data:', error);
      toast.error('Failed to load job data');
    }
  };

  const handleBatchMarkPaid = async () => {
    if (selectedInvoices.size === 0) {
      toast.error('Please select at least one invoice');
      return;
    }

    try {
      setProcessing(true);
      toast.loading('Processing payments...', { id: 'batch-payment' });

      const response = await fetch(`${API_URL}/api/invoices/batch-mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: Array.from(selectedInvoices) }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark invoices as paid');
      }

      const data = await response.json();
      setBatchPaymentData(data);
      setShowModal(true);
      setSelectedInvoices(new Set());

      // Refresh invoices
      await fetchInvoices();

      toast.success('Invoices marked as paid!', { id: 'batch-payment' });
    } catch (error: any) {
      console.error('Failed to batch mark paid:', error);
      toast.error(error.message || 'Failed to process payments', { id: 'batch-payment' });
    } finally {
      setProcessing(false);
    }
  };

  // Calculate stats for customers
  const customerInvoices = isCustomer ? invoices : [];
  const custTotalInvoiced = customerInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const custTotalPaid = customerInvoices.filter(inv => inv.paidAt != null).reduce((sum, inv) => sum + inv.amount, 0);
  const custTotalOutstanding = custTotalInvoiced - custTotalPaid;

  // Filter invoices by flow (for admin view)
  const bradfordToImpactInvoices = invoices.filter(
    inv => inv.fromCompanyId === 'bradford' && inv.toCompanyId === 'impact-direct'
  );
  const impactToCustomerInvoices = invoices.filter(
    inv => inv.fromCompanyId === 'impact-direct' && (inv.toCompanyId === 'jjsa' || inv.toCompanyId === 'ballantine')
  );
  const jdToBradfordInvoices = invoices.filter(
    inv => inv.fromCompanyId === 'jd-graphic' && inv.toCompanyId === 'bradford'
  );

  // Determine which invoices to display based on active tab (admin view)
  let displayedInvoices = impactToCustomerInvoices; // Default to Impact→Customer for batch payment
  if (activeTab === 'bradford-impact') {
    displayedInvoices = bradfordToImpactInvoices;
  } else if (activeTab === 'jd-bradford') {
    displayedInvoices = jdToBradfordInvoices;
  }

  // Calculate summary stats for displayed invoices (admin view)
  const totalInvoiced = displayedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = displayedInvoices.filter(inv => inv.paidAt != null).reduce((sum, inv) => sum + inv.amount, 0);
  const totalOutstanding = totalInvoiced - totalPaid;
  const allDisplayedSelected = displayedInvoices.length > 0 && displayedInvoices.every(inv => selectedInvoices.has(inv.id));

  // Helper function to determine invoice status
  const getInvoiceStatus = (invoice: Invoice) => {
    if (invoice.paidAt) return 'paid';
    if (invoice.dueAt && new Date(invoice.dueAt) < new Date()) return 'overdue';
    return 'unpaid';
  };

  // Helper function to download PDF
  const handleDownloadPDF = async (invoice: Invoice) => {
    if (!invoice.id) return;

    try {
      toast.loading('Downloading invoice PDF...', { id: 'download-pdf' });
      const response = await fetch(`${API_URL}/api/invoices/${invoice.id}/pdf`);

      if (!response.ok) throw new Error('Failed to download PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoiceNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF downloaded successfully!', { id: 'download-pdf' });
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error('Failed to download PDF', { id: 'download-pdf' });
    }
  };

  // CUSTOMER VIEW
  if (isCustomer) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <Navigation />
        <Toaster position="top-right" />

        <div className="mx-auto px-6 sm:px-8 lg:px-12 py-12 max-w-[1800px]">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent mb-2">
              My Invoices
            </h1>
            <p className="text-slate-400 text-sm">
              View and download your invoices
            </p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Total Invoiced */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-blue-950/40 to-blue-900/20 border border-blue-800/30 rounded-xl p-6 shadow-lg hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  ${custTotalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-blue-300/80 font-medium">Total Invoiced</div>
              </div>
            </div>

            {/* Total Paid */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-green-950/40 to-green-900/20 border border-green-800/30 rounded-xl p-6 shadow-lg hover:shadow-xl hover:shadow-green-500/10 transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl group-hover:bg-green-500/10 transition-all duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  ${custTotalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-green-300/80 font-medium">Paid</div>
              </div>
            </div>

            {/* Outstanding Balance */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-orange-950/40 to-orange-900/20 border border-orange-800/30 rounded-xl p-6 shadow-lg hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-all duration-300"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  ${custTotalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-orange-300/80 font-medium">Outstanding</div>
              </div>
            </div>
          </div>

          {/* Invoices Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : customerInvoices.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700">
              <svg className="mx-auto h-16 w-16 text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium text-slate-300 mb-2">No invoices yet</p>
              <p className="text-sm text-slate-500">Your invoices will appear here once jobs are completed</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {customerInvoices.map((invoice) => {
                const status = getInvoiceStatus(invoice);
                const statusConfig = {
                  paid: { label: 'Paid', color: 'green', bgColor: 'from-green-950/40 to-green-900/20', borderColor: 'border-green-800/30', glowColor: 'hover:shadow-green-500/10' },
                  overdue: { label: 'Overdue', color: 'red', bgColor: 'from-red-950/40 to-red-900/20', borderColor: 'border-red-800/30', glowColor: 'hover:shadow-red-500/10' },
                  unpaid: { label: 'Unpaid', color: 'yellow', bgColor: 'from-yellow-950/40 to-yellow-900/20', borderColor: 'border-yellow-800/30', glowColor: 'hover:shadow-yellow-500/10' }
                };
                const config = statusConfig[status];

                return (
                  <div
                    key={invoice.id}
                    className={`group relative overflow-hidden bg-gradient-to-br ${config.bgColor} border ${config.borderColor} rounded-xl p-6 shadow-lg hover:shadow-xl ${config.glowColor} transition-all duration-300 hover:-translate-y-1`}
                  >
                    {/* Background glow */}
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-${config.color}-500/10 rounded-full blur-3xl group-hover:bg-${config.color}-500/20 transition-all duration-300`}></div>

                    {/* Content */}
                    <div className="relative">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className={`w-5 h-5 text-${config.color}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h3 className="text-lg font-bold text-white tracking-tight">{invoice.invoiceNo}</h3>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">Job: {invoice.jobNo}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold bg-${config.color}-500/20 text-${config.color}-300 border border-${config.color}-500/30 rounded-full`}>
                          {config.label}
                        </span>
                      </div>

                      {/* Amount */}
                      <div className="mb-6">
                        <div className="text-3xl font-bold text-white tracking-tight">
                          ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-slate-400">Issued:</span>
                          <span className="text-slate-300 font-medium">
                            {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-slate-400">Due:</span>
                          <span className="text-slate-300 font-medium">
                            {invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : '-'}
                          </span>
                        </div>
                        {invoice.paidAt && (
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-slate-400">Paid:</span>
                            <span className="text-green-300 font-medium">
                              {new Date(invoice.paidAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/jobs/${invoice.jobNo}`)}
                          className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View Job
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(invoice)}
                          className={`flex-1 px-4 py-2 bg-${config.color}-600 hover:bg-${config.color}-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download PDF
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ADMIN VIEW (original functionality)
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Invoices</h1>
            <p className="mt-2 text-sm text-gray-600">
              Impact Direct invoices to customers
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export to CSV
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'bradford-impact', label: 'Bradford → Impact', count: bradfordToImpactInvoices.length },
              { id: 'impact-customer', label: 'Impact → Customer', count: impactToCustomerInvoices.length },
              { id: 'jd-bradford', label: 'JD → Bradford', count: jdToBradfordInvoices.length }
            ]}
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Invoiced</dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      ${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Paid</dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Outstanding</dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Batch Action Bar - Only show for Impact→Customer tab */}
        {activeTab === 'impact-customer' && selectedInvoices.size > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
            <span className="text-blue-900 font-medium">
              {selectedInvoices.size} invoice{selectedInvoices.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleBatchMarkPaid}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {processing ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mark Selected as Paid ({selectedInvoices.size})
                </>
              )}
            </button>
          </div>
        )}

        {/* Invoices Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              {activeTab === 'bradford-impact' ? 'Bradford → Impact Direct' :
               activeTab === 'impact-customer' ? 'Impact Direct → Customer' :
               'JD Graphic → Bradford'}
            </h2>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading invoices...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {activeTab === 'impact-customer' && (
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={allDisplayedSelected}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {activeTab === 'bradford-impact' ? 'From Bradford' :
                       activeTab === 'impact-customer' ? 'Customer' :
                       'From JD'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issued</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayedInvoices.map((invoice) => (
                    <tr key={invoice.id} className={selectedInvoices.has(invoice.id) ? 'bg-blue-50' : ''}>
                      {activeTab === 'impact-customer' && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.has(invoice.id)}
                            onChange={(e) => handleSelectInvoice(invoice.id, e.target.checked)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {invoice.invoiceNo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        {invoice.jobNo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.toCompany}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                        ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => handleEditInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Batch Payment Modal */}
      <BatchPaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        data={batchPaymentData}
      />

      {/* Edit Invoice Modal */}
      {selectedInvoice && (
        <EditInvoiceModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedInvoice(null);
            setSelectedJob(null);
          }}
          invoice={selectedInvoice}
          job={selectedJob}
          onSaved={() => {
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}
