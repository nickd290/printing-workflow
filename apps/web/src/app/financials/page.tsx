'use client';

import { Navigation } from '@/components/navigation';
import { Tabs } from '@/components/Tabs';
import { BatchPaymentModal } from '@/components/BatchPaymentModal';
import { FinancialActionModal } from '@/components/FinancialActionModal';
import { EditInvoiceModal } from '@/components/EditInvoiceModal';
import toast, { Toaster } from 'react-hot-toast';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { revenueAPI, jobsAPI, purchaseOrdersAPI, invoicesAPI } from '@/lib/api-client';
import { useUser } from '@/contexts/UserContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function FinancialsPage() {
  const { user, isCustomer, isBrokerAdmin, isBradfordAdmin } = useUser();
  const [metrics, setMetrics] = useState<any>(null);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [allPurchaseOrders, setAllPurchaseOrders] = useState<any[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'jobs' | 'pos' | 'invoices'>('jobs');

  // Invoice sub-tabs and batch payment state
  const [activeInvoiceTab, setActiveInvoiceTab] = useState<string>('impact-customer');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [batchPaymentData, setBatchPaymentData] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  // Action modal state
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{type: 'job' | 'purchaseOrder' | 'invoice'; data: any} | null>(null);

  // Edit invoice modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter data based on user role
  const filteredJobs = useMemo(() => {
    if (!user) return allJobs; // Show all jobs if no user (dev mode)
    if (isBrokerAdmin) return allJobs;
    if (isCustomer) {
      return allJobs.filter((job) => {
        const customerId = typeof job.customer === 'string' ? job.customer : job.customer?.id;
        return customerId === user.companyId;
      });
    }
    if (isBradfordAdmin) {
      return allJobs.filter((job) =>
        job.purchaseOrders?.some((po: any) =>
          po.targetCompany?.id === 'bradford' || po.originCompany?.id === 'bradford'
        )
      );
    }
    return allJobs;
  }, [allJobs, user, isCustomer, isBrokerAdmin, isBradfordAdmin]);

  const filteredPurchaseOrders = useMemo(() => {
    if (!user) return allPurchaseOrders; // Show all POs if no user (dev mode)
    if (isBrokerAdmin) return allPurchaseOrders;
    if (isCustomer) {
      // Customers don't see POs
      return [];
    }
    if (isBradfordAdmin) {
      return allPurchaseOrders.filter((po) =>
        po.targetCompany?.id === 'bradford' || po.originCompany?.id === 'bradford'
      );
    }
    return allPurchaseOrders;
  }, [allPurchaseOrders, user, isCustomer, isBrokerAdmin, isBradfordAdmin]);

  const filteredInvoices = useMemo(() => {
    if (!user) return allInvoices; // Show all invoices if no user (dev mode)
    if (isBrokerAdmin) return allInvoices;
    if (isCustomer) {
      // Customers see only invoices to them
      return allInvoices.filter((inv) => inv.toCompany?.id === user.companyId);
    }
    if (isBradfordAdmin) {
      // Bradford sees invoices from/to Bradford
      return allInvoices.filter((inv) =>
        inv.fromCompany?.id === 'bradford' || inv.toCompany?.id === 'bradford'
      );
    }
    return allInvoices;
  }, [allInvoices, user, isCustomer, isBrokerAdmin, isBradfordAdmin]);

  // Helper function to get customer name from different data structures
  const getCustomerName = (customer: any): string => {
    if (typeof customer === 'string') return customer;
    return customer?.name || 'Unknown';
  };

  // Group items by customer for easier viewing
  const groupByCustomer = (items: any[], getCustomerFn: (item: any) => string) => {
    const groups: Record<string, any[]> = {};
    items.forEach(item => {
      const customerName = getCustomerFn(item) || 'Unassigned';
      if (!groups[customerName]) {
        groups[customerName] = [];
      }
      groups[customerName].push(item);
    });
    // Sort groups alphabetically, but keep "Unassigned" last
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });
  };

  // Group filtered data by customer
  const groupedJobs = useMemo(() => {
    return groupByCustomer(filteredJobs, (job) => getCustomerName(job.customer));
  }, [filteredJobs]);

  const groupedPurchaseOrders = useMemo(() => {
    return groupByCustomer(filteredPurchaseOrders, (po) => {
      if (po.job && po.job.customer) {
        return getCustomerName(po.job.customer);
      }
      return 'Unassigned';
    });
  }, [filteredPurchaseOrders]);

  const groupedInvoices = useMemo(() => {
    return groupByCustomer(filteredInvoices, (inv) => {
      // For impact-to-customer invoices, group by recipient
      if (inv.fromCompanyId === 'impact-direct' && inv.toCompany) {
        return inv.toCompany.name;
      }
      // For other invoices, try to get customer from related job
      if (inv.job && inv.job.customer) {
        return getCustomerName(inv.job.customer);
      }
      return 'Unassigned';
    });
  }, [filteredInvoices]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [metricsData, jobsData, posData, invoicesData] = await Promise.all([
        revenueAPI.getMetrics(),
        jobsAPI.list(),
        purchaseOrdersAPI.list(),
        invoicesAPI.list(),
      ]);
      setMetrics(metricsData);
      setAllJobs(jobsData.jobs);
      setAllPurchaseOrders(posData.purchaseOrders);
      setAllInvoices(invoicesData.invoices);
      setError(null);
    } catch (err) {
      console.error('Failed to load financials:', err);
      setError('Failed to load financial data. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    // Simple CSV export - you can enhance this as needed
    const headers = Object.keys(data[0] || {});
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h])).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleRowClick = (type: 'job' | 'purchaseOrder' | 'invoice', data: any) => {
    setSelectedItem({ type, data });
    setShowActionModal(true);
  };

  const handleAction = async (actionType: string, data?: any) => {
    console.log('Action:', actionType, data);

    // Handle edit-invoice action
    if (actionType === 'edit-invoice') {
      try {
        setSelectedInvoice(data);

        // Fetch job data if jobId exists
        if (data.jobId) {
          const response = await fetch(`${API_URL}/api/jobs/${data.jobId}`);
          if (response.ok) {
            const jobData = await response.json();
            setSelectedJob(jobData);
          } else {
            setSelectedJob(null);
          }
        } else {
          setSelectedJob(null);
        }

        setShowActionModal(false);
        setEditModalOpen(true);
      } catch (error) {
        console.error('Failed to fetch job data:', error);
        toast.error('Failed to load job data');
        setShowActionModal(false);
      }
      return;
    }

    // Handle other actions
    toast.success(`Action "${actionType}" triggered`);
    setShowActionModal(false);
  };

  // Batch payment handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const customerInvoiceIds = filteredInvoices
        .filter(inv => inv.fromCompanyId === 'impact-direct')
        .map(inv => inv.id);
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

  const handleBatchMarkPaid = async () => {
    if (selectedInvoices.size === 0) {
      toast.error('Please select at least one invoice');
      return;
    }

    try {
      setProcessing(true);
      toast.loading('Loading payment preview...', { id: 'batch-payment' });

      // Call preview endpoint to get payment data without marking as paid
      const invoiceIdsString = Array.from(selectedInvoices).join(',');
      const response = await fetch(`${API_URL}/api/invoices/batch-preview?invoiceIds=${encodeURIComponent(invoiceIdsString)}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load payment preview');
      }

      const data = await response.json();
      setBatchPaymentData(data);
      setShowModal(true);

      toast.dismiss('batch-payment');
    } catch (error: any) {
      console.error('Failed to load payment preview:', error);
      toast.error(error.message || 'Failed to load payment preview', { id: 'batch-payment' });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmPayment = async (transferNumber: string, bradfordCosts: Array<{ invoiceId: string; amount: number }>) => {
    try {
      toast.loading('Confirming payment...', { id: 'confirm-payment' });

      const response = await fetch(`${API_URL}/api/invoices/batch-confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: Array.from(selectedInvoices),
          bradfordCosts,
          transferNumber,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to confirm payment');
      }

      const data = await response.json();

      // Close modal and clear selection
      setShowModal(false);
      setSelectedInvoices(new Set());
      setBatchPaymentData(null);

      // Refresh invoices
      await loadAllData();

      toast.success(`${data.markedPaid.length} invoices marked as paid! Email sent to Bradford.`, { id: 'confirm-payment' });
    } catch (error: any) {
      console.error('Failed to confirm payment:', error);
      toast.error(error.message || 'Failed to confirm payment', { id: 'confirm-payment' });
      throw error; // Re-throw to let modal handle the error
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading financial data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isCustomer ? 'My Invoices' : 'Financials'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isCustomer
              ? 'View and track your invoices from Impact Direct'
              : 'Complete financial overview with revenue, costs, and margins'}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Error:</span> {error}
            </div>
          </div>
        )}

        {metrics && !isCustomer && (
          <>
            {/* Summary Cards - Hidden for customers */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Total Revenue</div>
                <div className="text-3xl font-bold text-green-600">
                  ${metrics.profitMargins.totalRevenue.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Customer payments</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Total Costs</div>
                <div className="text-3xl font-bold text-red-600">
                  ${metrics.profitMargins.totalCosts.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Vendor payments</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Gross Margin</div>
                <div className="text-3xl font-bold text-blue-600">
                  ${metrics.profitMargins.grossProfit.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Total profit</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Margin %</div>
                <div className="text-3xl font-bold text-purple-600">
                  {metrics.profitMargins.profitMargin.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Average margin</div>
              </div>
            </div>

            {/* View Tabs - Simplified for customers */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              {!isCustomer && (
                <div className="border-b border-gray-200">
                  <div className="flex">
                    <button
                      onClick={() => setActiveView('jobs')}
                      className={`px-6 py-3 font-medium text-sm border-b-2 ${
                        activeView === 'jobs'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Jobs Financial Breakdown
                    </button>
                    <button
                      onClick={() => setActiveView('pos')}
                      className={`px-6 py-3 font-medium text-sm border-b-2 ${
                        activeView === 'pos'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Purchase Orders
                    </button>
                    <button
                      onClick={() => setActiveView('invoices')}
                      className={`px-6 py-3 font-medium text-sm border-b-2 ${
                        activeView === 'invoices'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Invoices
                    </button>
                  </div>
                </div>
              )}

              {/* Jobs Table - Hidden for customers */}
              {!isCustomer && activeView === 'jobs' && (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Complete Job Financials</h2>
                    <button
                      onClick={() => exportToCSV(filteredJobs.map(job => {
                        const customerTotal = Number(job.customerTotal);
                        const bradfordCost = Number(job.bradfordTotal || 0);
                        const margin = Number(job.impactMargin || 0);
                        const marginPercent = customerTotal > 0
                          ? ((margin / customerTotal) * 100).toFixed(1) + '%'
                          : '0.0%';
                        return {
                          jobNo: job.jobNo,
                          customerPO: job.customerPONumber || '',
                          customer: getCustomerName(job.customer),
                          size: job.sizeName || '',
                          quantityK: job.quantity ? (job.quantity / 1000).toFixed(1) : '',
                          customerTotal,
                          customerCPM: job.customerCPM ? Number(job.customerCPM).toFixed(2) : '',
                          bradfordCost,
                          margin,
                          marginCPM: job.impactMarginCPM ? Number(job.impactMarginCPM).toFixed(2) : '',
                          printCPM: job.printCPM ? Number(job.printCPM).toFixed(2) : '',
                          marginPercent,
                          customPricing: job.requiresApproval ? 'Yes' : 'No',
                          status: job.status,
                          date: new Date(job.createdAt).toLocaleDateString(),
                        };
                      }), 'job-financials.csv')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Export to CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer PO#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size (Rule)</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty (K)</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Total</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cust CPM</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bradford Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margin CPM</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Print CPM</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin %</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Custom</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {groupedJobs.map(([customerName, jobs]) => {
                          // Calculate customer subtotals
                          const customerSubtotals = jobs.reduce((acc, job) => {
                            const customerTotal = Number(job.customerTotal);
                            const bradfordCost = Number(job.bradfordTotal || 0);
                            const margin = Number(job.impactMargin || 0);
                            return {
                              customerTotal: acc.customerTotal + customerTotal,
                              bradfordCost: acc.bradfordCost + bradfordCost,
                              margin: acc.margin + margin
                            };
                          }, { customerTotal: 0, bradfordCost: 0, margin: 0 });

                          return (
                            <Fragment key={customerName}>
                              {/* Customer Header Row */}
                              <tr className="bg-gray-100 border-t-2 border-gray-300">
                                <td colSpan={15} className="px-4 py-3 text-sm font-bold text-gray-900">
                                  {customerName} ({jobs.length} {jobs.length === 1 ? 'job' : 'jobs'})
                                </td>
                              </tr>

                              {/* Customer's Jobs */}
                              {jobs.map((job) => {
                                const customerTotal = Number(job.customerTotal);
                                const bradfordCost = Number(job.bradfordTotal || 0);
                                const margin = Number(job.impactMargin || 0);
                                const marginPercent = customerTotal > 0
                                  ? ((margin / customerTotal) * 100).toFixed(1)
                                  : '0.0';

                                // CPM data
                                const quantityInK = job.quantity ? (job.quantity / 1000).toFixed(1) : '-';
                                const customerCPM = job.customerCPM ? Number(job.customerCPM).toFixed(2) : '-';
                                const marginCPM = job.impactMarginCPM ? Number(job.impactMarginCPM).toFixed(2) : '-';
                                const printCPM = job.printCPM ? Number(job.printCPM).toFixed(2) : '-';

                                return (
                                  <tr
                                    key={job.id}
                                    onClick={() => handleRowClick('job', job)}
                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                  >
                                    <td className="px-4 py-4 text-sm font-medium text-blue-600">{job.jobNo}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900 font-medium">{job.customerPONumber || '-'}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900">{getCustomerName(job.customer)}</td>
                                    <td className="px-4 py-4 text-xs text-gray-600">{job.sizeName || '-'}</td>
                                    <td className="px-4 py-4 text-xs text-right text-gray-600">{quantityInK}</td>
                                    <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                                      ${customerTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-4 text-xs text-right text-gray-700">${customerCPM}</td>
                                    <td className="px-4 py-4 text-sm text-red-600">
                                      ${bradfordCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-4 text-sm font-medium text-green-600">
                                      ${margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-4 text-xs text-right text-gray-700">${marginCPM}</td>
                                    <td className="px-4 py-4 text-xs text-right text-gray-700">${printCPM}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900">{marginPercent}%</td>
                                    <td className="px-4 py-4 text-center">
                                      {job.requiresApproval && (
                                        <span className="inline-flex items-center justify-center w-6 h-6 text-yellow-600" title="Custom pricing - requires approval">
                                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                          </svg>
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-4">
                                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {job.status.replace(/_/g, ' ')}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-500">
                                      {new Date(job.createdAt).toLocaleDateString()}
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Customer Subtotal Row */}
                              <tr className="bg-gray-50 font-semibold">
                                <td colSpan={5} className="px-4 py-3 text-sm text-gray-900">Subtotal - {customerName}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  ${customerSubtotals.customerTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td></td>
                                <td className="px-4 py-3 text-sm text-red-600">
                                  ${customerSubtotals.bradfordCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-sm text-green-600">
                                  ${customerSubtotals.margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td colSpan={6}></td>
                              </tr>
                            </Fragment>
                          );
                        })}

                        {/* Grand Total Row */}
                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                          <td colSpan={5} className="px-4 py-4 text-sm text-gray-900">GRAND TOTAL</td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            ${filteredJobs.reduce((sum, job) => sum + Number(job.customerTotal), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td></td>
                          <td className="px-4 py-4 text-sm text-red-600">
                            ${filteredJobs.reduce((sum, job) => sum + Number(job.bradfordTotal || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-4 text-sm text-green-600">
                            ${filteredJobs.reduce((sum, job) => sum + Number(job.impactMargin || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td colSpan={6}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Purchase Orders Table - Hidden for customers */}
              {!isCustomer && activeView === 'pos' && (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">All Purchase Orders</h2>
                    <button
                      onClick={() => exportToCSV(filteredPurchaseOrders.map(po => ({
                        poNumber: po.id,
                        from: po.originCompany.name,
                        to: po.targetCompany.name,
                        originalAmount: po.originalAmount,
                        vendorAmount: po.vendorAmount,
                        margin: (po.originalAmount || 0) - po.vendorAmount,
                        status: po.status,
                        date: new Date(po.createdAt).toLocaleDateString(),
                      })), 'purchase-orders.csv')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Export to CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer PO#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {groupedPurchaseOrders.map(([customerName, pos]) => {
                          // Calculate customer subtotals
                          const customerSubtotals = pos.reduce((acc, po) => {
                            const originalAmount = Number(po.originalAmount || 0);
                            const vendorAmount = Number(po.vendorAmount);
                            const margin = originalAmount - vendorAmount;
                            return {
                              originalAmount: acc.originalAmount + originalAmount,
                              vendorAmount: acc.vendorAmount + vendorAmount,
                              margin: acc.margin + margin
                            };
                          }, { originalAmount: 0, vendorAmount: 0, margin: 0 });

                          return (
                            <Fragment key={customerName}>
                              {/* Customer Header Row */}
                              <tr className="bg-gray-100 border-t-2 border-gray-300">
                                <td colSpan={10} className="px-4 py-3 text-sm font-bold text-gray-900">
                                  {customerName} ({pos.length} {pos.length === 1 ? 'PO' : 'POs'})
                                </td>
                              </tr>

                              {/* Customer's POs */}
                              {pos.map((po) => {
                                const originalAmount = Number(po.originalAmount || 0);
                                const vendorAmount = Number(po.vendorAmount);
                                const margin = originalAmount - vendorAmount;

                                return (
                                  <tr
                                    key={po.id}
                                    onClick={() => handleRowClick('purchaseOrder', po)}
                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                  >
                                    <td className="px-4 py-4 text-sm font-medium text-gray-900">PO-{po.id.slice(0, 8)}</td>
                                    <td className="px-4 py-4 text-sm text-blue-600 font-medium">{po.job?.jobNo || '-'}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900 font-medium">{po.job?.customerPONumber || '-'}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900">{po.originCompany.name}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900">{po.targetCompany.name}</td>
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                      ${originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                                      ${vendorAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-4 text-sm font-medium text-green-600">
                                      ${margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-4">
                                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {po.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-500">
                                      {new Date(po.createdAt).toLocaleDateString()}
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Customer Subtotal Row */}
                              <tr className="bg-gray-50 font-semibold">
                                <td colSpan={5} className="px-4 py-3 text-sm text-gray-900">Subtotal - {customerName}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  ${customerSubtotals.originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  ${customerSubtotals.vendorAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-sm text-green-600">
                                  ${customerSubtotals.margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td colSpan={2}></td>
                              </tr>
                            </Fragment>
                          );
                        })}

                        {/* Grand Total Row */}
                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                          <td colSpan={5} className="px-4 py-4 text-sm text-gray-900">GRAND TOTAL</td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            ${filteredPurchaseOrders.reduce((sum, po) => sum + Number(po.originalAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            ${filteredPurchaseOrders.reduce((sum, po) => sum + Number(po.vendorAmount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-4 text-sm text-green-600">
                            ${filteredPurchaseOrders.reduce((sum, po) => sum + (Number(po.originalAmount || 0) - Number(po.vendorAmount)), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Invoices Section with Sub-Tabs */}
              {(isCustomer || activeView === 'invoices') && (
                <div className="p-6">
                  {!isCustomer ? (
                    <>
                      {/* Invoice Flow Sub-Tabs for admin/broker */}
                      {(() => {
                        // Filter invoices by flow
                        const bradfordToImpactInvoices = filteredInvoices.filter(
                          inv => inv.fromCompany?.id === 'bradford' && inv.toCompany?.id === 'impact-direct'
                        );
                        const impactToCustomerInvoices = filteredInvoices.filter(
                          inv => inv.fromCompany?.id === 'impact-direct' && (inv.toCompany?.id === 'jjsa' || inv.toCompany?.id === 'ballantine')
                        );
                        const jdToBradfordInvoices = filteredInvoices.filter(
                          inv => inv.fromCompany?.id === 'jd-graphic' && inv.toCompany?.id === 'bradford'
                        );

                        // Determine which invoices to display
                        let displayedInvoices = filteredInvoices;
                        if (activeInvoiceTab === 'bradford-impact') {
                          displayedInvoices = bradfordToImpactInvoices;
                        } else if (activeInvoiceTab === 'impact-customer') {
                          displayedInvoices = impactToCustomerInvoices;
                        } else if (activeInvoiceTab === 'jd-bradford') {
                          displayedInvoices = jdToBradfordInvoices;
                        }

                        // Calculate stats for displayed invoices
                        const totalInvoiced = displayedInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
                        const totalPaid = displayedInvoices.filter(inv => inv.paidAt != null).reduce((sum, inv) => sum + Number(inv.amount), 0);
                        const totalOutstanding = totalInvoiced - totalPaid;
                        const customerInvoices = displayedInvoices.filter(inv => inv.fromCompanyId === 'impact-direct');
                        const allCustomerInvoicesSelected = customerInvoices.length > 0 && customerInvoices.every(inv => selectedInvoices.has(inv.id));

                        return (
                          <>
                            {/* Invoice Sub-Tabs */}
                            <div className="mb-4">
                              <Tabs
                                activeTab={activeInvoiceTab}
                                onChange={setActiveInvoiceTab}
                                tabs={[
                                  { id: 'bradford-impact', label: 'Bradford → Impact', count: bradfordToImpactInvoices.length },
                                  { id: 'impact-customer', label: 'Impact → Customer', count: impactToCustomerInvoices.length },
                                  { id: 'jd-bradford', label: 'JD → Bradford', count: jdToBradfordInvoices.length }
                                ]}
                              />
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
                              <div className="bg-blue-50 rounded-lg p-4">
                                <div className="text-sm font-medium text-gray-500">Total Invoiced</div>
                                <div className="text-2xl font-bold text-blue-600 mt-1">
                                  ${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div className="bg-green-50 rounded-lg p-4">
                                <div className="text-sm font-medium text-gray-500">Paid</div>
                                <div className="text-2xl font-bold text-green-600 mt-1">
                                  ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div className="bg-yellow-50 rounded-lg p-4">
                                <div className="text-sm font-medium text-gray-500">Outstanding</div>
                                <div className="text-2xl font-bold text-yellow-600 mt-1">
                                  ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>

                            {/* Batch Action Bar - Only for Impact→Customer */}
                            {activeInvoiceTab === 'impact-customer' && selectedInvoices.size > 0 && (() => {
                              // Calculate total amount of selected invoices
                              const selectedTotal = impactToCustomerInvoices
                                .filter(inv => selectedInvoices.has(inv.id))
                                .reduce((sum, inv) => sum + parseFloat(inv.amount.toString()), 0);

                              return (
                                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
                                  <div className="flex items-center gap-4">
                                    <span className="text-blue-900 font-medium">
                                      {selectedInvoices.size} invoice{selectedInvoices.size !== 1 ? 's' : ''} selected
                                    </span>
                                    <div className="h-4 w-px bg-blue-300"></div>
                                    <span className="text-blue-900 font-bold text-lg">
                                      ${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} total
                                    </span>
                                  </div>
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
                              );
                            })()}

                            {/* Export Button */}
                            <div className="flex justify-between items-center mb-4">
                              <h2 className="text-lg font-semibold text-gray-900">
                                {activeInvoiceTab === 'bradford-impact' ? 'Bradford → Impact Direct' :
                                 activeInvoiceTab === 'impact-customer' ? 'Impact Direct → Customer' :
                                 'JD Graphic → Bradford'}
                              </h2>
                              <button
                                onClick={() => exportToCSV(displayedInvoices.map(inv => ({
                                  invoiceNo: inv.invoiceNo,
                                  jobNo: inv.job?.jobNo || 'N/A',
                                  from: inv.fromCompany.name,
                                  to: inv.toCompany?.name || 'Customer',
                                  amount: inv.amount,
                                  issuedAt: inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : '',
                                  paidAt: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '',
                                })), 'invoices.csv')}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                Export to CSV
                              </button>
                            </div>

                            {/* Invoices Table */}
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    {activeInvoiceTab === 'impact-customer' && (
                                      <th className="px-4 py-3 text-left">
                                        <input
                                          type="checkbox"
                                          checked={allCustomerInvoicesSelected}
                                          onChange={(e) => handleSelectAll(e.target.checked)}
                                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                      </th>
                                    )}
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer PO#</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                      {activeInvoiceTab === 'bradford-impact' ? 'From Bradford' :
                                       activeInvoiceTab === 'impact-customer' ? 'Customer' :
                                       'From JD'}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {(() => {
                                    // Group displayed invoices by customer
                                    const groupedDisplayedInvoices = groupByCustomer(displayedInvoices, (inv) => {
                                      if (inv.fromCompanyId === 'impact-direct' && inv.toCompany) {
                                        return inv.toCompany.name;
                                      }
                                      if (inv.job && inv.job.customer) {
                                        return getCustomerName(inv.job.customer);
                                      }
                                      return 'Unassigned';
                                    });

                                    return (
                                      <>
                                        {groupedDisplayedInvoices.map(([customerName, invoices]) => {
                                          // Calculate customer subtotals
                                          const customerSubtotal = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
                                          const numCols = activeInvoiceTab === 'impact-customer' ? 9 : 8;

                                          return (
                                            <Fragment key={customerName}>
                                              {/* Customer Header Row */}
                                              <tr className="bg-gray-100 border-t-2 border-gray-300">
                                                <td colSpan={numCols} className="px-4 py-3 text-sm font-bold text-gray-900">
                                                  {customerName} ({invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'})
                                                </td>
                                              </tr>

                                              {/* Customer's Invoices */}
                                              {invoices.map((invoice) => {
                                                const amount = Number(invoice.amount);

                                                return (
                                                  <tr
                                                    key={invoice.id}
                                                    onClick={() => handleRowClick('invoice', invoice)}
                                                    className={`${selectedInvoices.has(invoice.id) ? 'bg-blue-50' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}
                                                  >
                                                    {activeInvoiceTab === 'impact-customer' && (
                                                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                          type="checkbox"
                                                          checked={selectedInvoices.has(invoice.id)}
                                                          onChange={(e) => handleSelectInvoice(invoice.id, e.target.checked)}
                                                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                        />
                                                      </td>
                                                    )}
                                                    <td className="px-4 py-4 text-sm font-medium text-blue-600">{invoice.invoiceNo}</td>
                                                    <td className="px-4 py-4 text-sm text-blue-600 font-medium">{invoice.job?.jobNo || '-'}</td>
                                                    <td className="px-4 py-4 text-sm text-gray-900 font-medium">{invoice.job?.customerPONumber || '-'}</td>
                                                    <td className="px-4 py-4 text-sm text-gray-900">
                                                      {activeInvoiceTab === 'impact-customer' ? invoice.toCompany?.name : invoice.fromCompany.name}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                                                      ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-gray-500">
                                                      {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-gray-500">
                                                      {invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-gray-500">
                                                      {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : '-'}
                                                    </td>
                                                  </tr>
                                                );
                                              })}

                                              {/* Customer Subtotal Row */}
                                              <tr className="bg-gray-50 font-semibold">
                                                <td colSpan={activeInvoiceTab === 'impact-customer' ? 5 : 4} className="px-4 py-3 text-sm text-gray-900">
                                                  Subtotal - {customerName}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                  ${customerSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td colSpan={3}></td>
                                              </tr>
                                            </Fragment>
                                          );
                                        })}

                                        {/* Grand Total Row */}
                                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                                          <td colSpan={activeInvoiceTab === 'impact-customer' ? 5 : 4} className="px-4 py-4 text-sm text-gray-900">
                                            GRAND TOTAL
                                          </td>
                                          <td className="px-4 py-4 text-sm text-gray-900">
                                            ${displayedInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                          </td>
                                          <td colSpan={3}></td>
                                        </tr>
                                      </>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    /* Customer View - Simple table without sub-tabs */
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Your Invoices</h2>
                        <button
                          onClick={() => exportToCSV(filteredInvoices.map(inv => ({
                            invoiceNo: inv.invoiceNo,
                            jobNo: inv.job?.jobNo || 'N/A',
                            amount: inv.amount,
                            date: new Date(inv.createdAt).toLocaleDateString(),
                            paidAt: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '',
                          })), 'invoices.csv')}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Export to CSV
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PDF</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredInvoices.map((invoice) => {
                              const amount = Number(invoice.amount);

                              return (
                                <tr key={invoice.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-4 text-sm font-medium text-blue-600">{invoice.invoiceNo}</td>
                                  <td className="px-4 py-4 text-sm text-gray-900">{invoice.job?.jobNo || 'N/A'}</td>
                                  <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                                    ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-4 py-4 text-sm text-gray-500">
                                    {new Date(invoice.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-4 text-sm text-gray-500">
                                    {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : '-'}
                                  </td>
                                  <td className="px-4 py-4 text-sm">
                                    {invoice.pdfUrl ? (
                                      <button className="text-blue-600 hover:text-blue-800 font-medium">
                                        Download
                                      </button>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Batch Payment Modal */}
        <BatchPaymentModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onConfirm={handleConfirmPayment}
          data={batchPaymentData}
        />

        {/* Financial Action Modal */}
        <FinancialActionModal
          type={selectedItem?.type || 'job'}
          data={selectedItem?.data || null}
          isOpen={showActionModal}
          onClose={() => setShowActionModal(false)}
          onAction={handleAction}
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
              loadAllData();
            }}
          />
        )}
      </div>
    </div>
  );
}
