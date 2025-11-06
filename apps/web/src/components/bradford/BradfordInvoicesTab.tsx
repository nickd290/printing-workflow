'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BradfordInvoicesTabProps {
  invoices: any[];
  onRefresh: () => void;
}

export function BradfordInvoicesTab({ invoices, onRefresh }: BradfordInvoicesTabProps) {
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editInvoiceData, setEditInvoiceData] = useState({ amount: '', status: '' });
  const [saving, setSaving] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Toggle customer expansion
  const toggleCustomer = (customerName: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerName)) {
      newExpanded.delete(customerName);
    } else {
      newExpanded.add(customerName);
    }
    setExpandedCustomers(newExpanded);
  };

  // Toggle job expansion
  const toggleJob = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  const handleEditInvoice = (invoice: any) => {
    setEditingInvoiceId(invoice.id);
    setEditInvoiceData({
      amount: invoice.amount.toString(),
      status: invoice.status,
    });
  };

  const handleSaveInvoice = async (invoiceId: string) => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editInvoiceData.amount),
          status: editInvoiceData.status,
        }),
      });
      toast.success('Invoice updated!');
      setEditingInvoiceId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to update invoice:', err);
      toast.error('Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  // Group invoices by job
  const jobsMap = new Map<string, any>();
  invoices.forEach((invoice) => {
    if (invoice.job) {
      const jobId = invoice.job.id;
      if (!jobsMap.has(jobId)) {
        jobsMap.set(jobId, {
          ...invoice.job,
          invoices: [],
        });
      }
      jobsMap.get(jobId).invoices.push(invoice);
    }
  });

  const jobsWithInvoices = Array.from(jobsMap.values());

  // Apply filters
  const filteredJobs = jobsWithInvoices.filter((job) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const jobNo = job.jobNo?.toLowerCase() || '';
      const customerName = typeof job.customer === 'string'
        ? job.customer.toLowerCase()
        : (job.customer?.name || '').toLowerCase();

      const hasMatchingInvoice = job.invoices.some((inv: any) =>
        inv.invoiceNo?.toLowerCase().includes(query)
      );

      if (!jobNo.includes(query) && !customerName.includes(query) && !hasMatchingInvoice) {
        return false;
      }
    }

    // Status filter for invoices
    if (statusFilter !== 'ALL') {
      const hasMatchingStatus = job.invoices.some((inv: any) => inv.status === statusFilter);
      if (!hasMatchingStatus) {
        return false;
      }
    }

    return true;
  });

  const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');
  const unpaidInvoices = invoices.filter((inv) => inv.status !== 'PAID');

  const getCustomerName = (job: any) => {
    return typeof job.customer === 'string' ? job.customer : job.customer?.name || 'Unknown Customer';
  };

  const getJobName = (job: any) => {
    return job.title || job.description || job.customerPONumber || 'Untitled';
  };

  const formatNumber = (num: any, decimals: number = 2) => {
    if (num === null || num === undefined) return 'N/A';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  // Group filtered jobs by customer
  const customerGroups = new Map<string, { customerName: string; jobs: any[]; totalInvoices: number; totalAmount: number; paidCount: number }>();
  filteredJobs.forEach((job) => {
    const customerName = getCustomerName(job);
    if (!customerGroups.has(customerName)) {
      customerGroups.set(customerName, {
        customerName,
        jobs: [],
        totalInvoices: 0,
        totalAmount: 0,
        paidCount: 0,
      });
    }
    const group = customerGroups.get(customerName)!;
    group.jobs.push(job);
    group.totalInvoices += job.invoices.length;
    group.totalAmount += job.invoices.reduce((sum: number, inv: any) => sum + Number(inv.amount || 0), 0);
    group.paidCount += job.invoices.filter((inv: any) => inv.status === 'PAID').length;
  });

  const customerGroupsArray = Array.from(customerGroups.values());

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Total Invoices</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Paid</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{paidInvoices.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Unpaid</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{unpaidInvoices.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by job#, customer, or invoice#..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="ALL">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <div className="text-sm text-gray-500">
          Showing {customerGroupsArray.length} customers, {filteredJobs.length} jobs with invoices
        </div>
      </div>

      {/* Customer Groups with Jobs and Invoice Sections (Accordion Style) */}
      <div className="space-y-4">
        {customerGroupsArray.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-gray-500">No invoices found matching your filters</p>
          </div>
        ) : (
          customerGroupsArray.map((customerGroup) => {
            const isCustomerExpanded = expandedCustomers.has(customerGroup.customerName);

            return (
              <div key={customerGroup.customerName} className="bg-white rounded-lg border border-gray-300 shadow-md overflow-hidden">
                {/* Customer Header (Clickable to expand/collapse) */}
                <div
                  onClick={() => toggleCustomer(customerGroup.customerName)}
                  className="px-6 py-4 cursor-pointer bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-5 h-5 text-white transition-transform ${isCustomerExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div>
                        <div className="text-lg font-bold text-white">{customerGroup.customerName}</div>
                        <div className="text-xs text-green-100">
                          {customerGroup.jobs.length} {customerGroup.jobs.length === 1 ? 'Job' : 'Jobs'} • {customerGroup.totalInvoices} Invoices • {customerGroup.paidCount} Paid
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-100">Total Invoice Amount</div>
                      <div className="text-xl font-bold text-white">
                        ${formatNumber(customerGroup.totalAmount)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable Customer Content (Jobs List) */}
                {isCustomerExpanded && (
                  <div className="bg-gray-50 p-4 space-y-3">
                    {customerGroup.jobs.map((job) => {
            const isExpanded = expandedJobs.has(job.id);
            const customerName = getCustomerName(job);
            const totalInvoiceAmount = job.invoices.reduce((sum: number, inv: any) => sum + Number(inv.amount || 0), 0);

            return (
              <div key={job.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Job Header (Clickable to expand/collapse) - Enhanced */}
                <div
                  onClick={() => toggleJob(job.id)}
                  className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="grid grid-cols-12 gap-4 items-start">
                    {/* Expand Icon + Job Info Section */}
                    <div className="col-span-3 flex items-start gap-3">
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 mt-0.5 ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-blue-600">{job.jobNo}</div>
                        {job.customerPONumber && (
                          <div className="text-xs text-gray-500">PO: {job.customerPONumber}</div>
                        )}
                        <div className="text-xs text-gray-700 mt-1 truncate" title={getJobName(job)}>
                          {getJobName(job)}
                        </div>
                        <div className="text-xs font-medium text-gray-900 mt-0.5">{customerName}</div>
                      </div>
                    </div>

                    {/* Production Info Section */}
                    <div className="col-span-2">
                      <div className="text-xs text-gray-500 mb-1">Production</div>
                      <div className="text-xs">
                        <span className="text-gray-600">Paper:</span>{' '}
                        <span className="font-medium text-gray-900">
                          {job.paperWeightTotal ? `${formatNumber(job.paperWeightTotal, 1)} lbs` : 'N/A'}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5">
                        <span className="text-gray-600">Qty:</span>{' '}
                        <span className="font-medium text-gray-900">
                          {job.quantity ? formatNumber(job.quantity, 0) : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Financial Info Section */}
                    <div className="col-span-4">
                      <div className="text-xs text-gray-500 mb-1">Financial</div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                        <div>
                          <span className="text-gray-600">JD Amt:</span>{' '}
                          <span className="font-medium text-gray-900">
                            ${job.jdTotal ? formatNumber(job.jdTotal) : '0.00'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Incoming:</span>{' '}
                          <span className="font-medium text-gray-900">
                            ${job.bradfordTotal ? formatNumber(job.bradfordTotal) : '0.00'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Margin:</span>{' '}
                          <span className="font-semibold text-green-600">
                            ${job.bradfordTotalMargin ? formatNumber(job.bradfordTotalMargin) : '0.00'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Print Split:</span>{' '}
                          <span className="font-semibold text-blue-600">
                            ${job.bradfordPrintMargin ? formatNumber(job.bradfordPrintMargin) : '0.00'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Section */}
                    <div className="col-span-3 flex flex-col items-end gap-1.5">
                      <div className="text-xs font-medium text-indigo-600">
                        {job.invoices.length} {job.invoices.length === 1 ? 'Invoice' : 'Invoices'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Total: ${formatNumber(totalInvoiceAmount)}
                      </div>
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {job.status.replace(/_/g, ' ')}
                      </span>
                      <div className="text-xs text-gray-500">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable Invoice Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                    <div className="bg-white rounded-lg border border-indigo-200 overflow-hidden">
                      <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200">
                        <span className="text-sm font-semibold text-indigo-900">Invoices</span>
                      </div>

                      <div className="divide-y divide-gray-200">
                        {job.invoices.map((invoice: any) => {
                          const statusColor =
                            invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                            invoice.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800';
                          const isEditing = editingInvoiceId === invoice.id;

                          return (
                            <div
                              key={invoice.id}
                              className={`p-4 ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-4">
                                    <div className="text-sm font-semibold text-indigo-600">
                                      {invoice.invoiceNo}
                                    </div>
                                    {isEditing ? (
                                      <select
                                        value={editInvoiceData.status}
                                        onChange={(e) => setEditInvoiceData({ ...editInvoiceData, status: e.target.value })}
                                        className="px-2 py-1 border border-blue-300 rounded text-xs"
                                      >
                                        <option value="DRAFT">DRAFT</option>
                                        <option value="SENT">SENT</option>
                                        <option value="PAID">PAID</option>
                                        <option value="OVERDUE">OVERDUE</option>
                                        <option value="CANCELLED">CANCELLED</option>
                                      </select>
                                    ) : (
                                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                        {invoice.status}
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">From:</span>
                                      <span className="font-medium text-gray-900">{invoice.fromCompany?.name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">To:</span>
                                      <span className="font-medium text-gray-900">{invoice.toCompany?.name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Amount:</span>
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={editInvoiceData.amount}
                                          onChange={(e) => setEditInvoiceData({ ...editInvoiceData, amount: e.target.value })}
                                          className="w-32 px-2 py-1 border border-blue-300 rounded text-sm"
                                        />
                                      ) : (
                                        <span className="font-semibold text-gray-900">
                                          ${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Date:</span>
                                      <span className="text-gray-900">{new Date(invoice.createdAt).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div>
                                  {isEditing ? (
                                    <div className="flex flex-col gap-2">
                                      <button
                                        onClick={() => handleSaveInvoice(invoice.id)}
                                        disabled={saving}
                                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs"
                                      >
                                        {saving ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        onClick={() => setEditingInvoiceId(null)}
                                        disabled={saving}
                                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleEditInvoice(invoice)}
                                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
