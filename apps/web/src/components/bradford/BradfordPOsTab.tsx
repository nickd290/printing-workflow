'use client';

import { useState } from 'react';
import { BradfordPOEntryModal } from './BradfordPOEntryModal';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BradfordPOsTabProps {
  purchaseOrders: any[];
  jobs: any[];
  onRefresh: () => void;
}

export function BradfordPOsTab({ purchaseOrders, jobs, onRefresh }: BradfordPOsTabProps) {
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [selectedJobForPO, setSelectedJobForPO] = useState<string | null>(null);
  const [editingPOId, setEditingPOId] = useState<string | null>(null);
  const [editPOData, setEditPOData] = useState({ vendorAmount: '', status: '', originalAmount: '' });
  const [saving, setSaving] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: { fromImpact: boolean; toJD: boolean } }>({});
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

  // Toggle section expansion
  const toggleSection = (jobId: string, section: 'fromImpact' | 'toJD') => {
    setExpandedSections(prev => ({
      ...prev,
      [jobId]: {
        fromImpact: section === 'fromImpact' ? !prev[jobId]?.fromImpact : prev[jobId]?.fromImpact || false,
        toJD: section === 'toJD' ? !prev[jobId]?.toJD : prev[jobId]?.toJD || false,
      }
    }));
  };

  const handleCreatePO = (jobId: string) => {
    setSelectedJobForPO(jobId);
    setShowCreatePO(true);
  };

  const handleEditPO = (po: any) => {
    setEditingPOId(po.id);
    setEditPOData({
      vendorAmount: po.vendorAmount.toString(),
      originalAmount: (po.originalAmount || 0).toString(),
      status: po.status,
    });
  };

  const handleSavePO = async (poId: string) => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/purchase-orders/${poId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorAmount: parseFloat(editPOData.vendorAmount),
          originalAmount: parseFloat(editPOData.originalAmount),
          status: editPOData.status,
        }),
      });
      toast.success('Purchase order updated!');
      setEditingPOId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to update PO:', err);
      toast.error('Failed to update purchase order');
    } finally {
      setSaving(false);
    }
  };

  // Group POs by job
  const jobsMap = new Map<string, any>();

  // First, add all jobs from the jobs array
  jobs.forEach((job) => {
    jobsMap.set(job.id, {
      ...job,
      impactPO: null,
      bradfordPO: null,
    });
  });

  // Then, populate POs for each job
  purchaseOrders.forEach((po) => {
    if (po.jobId && jobsMap.has(po.jobId)) {
      const job = jobsMap.get(po.jobId);

      // Check if this is an Impact → Bradford PO
      if (po.originCompanyId === 'impact-direct' && po.targetCompanyId === 'bradford') {
        job.impactPO = po;
      }
      // Check if this is a Bradford → JD PO
      else if (po.originCompanyId === 'bradford' && po.targetCompanyId === 'jd-graphic') {
        job.bradfordPO = po;
      }
    }
  });

  // Convert to array and filter out jobs without any POs
  const jobsWithPOs = Array.from(jobsMap.values()).filter(
    job => job.impactPO || job.bradfordPO
  );

  // Apply filters
  const filteredJobs = jobsWithPOs.filter((job) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const jobNo = job.jobNo?.toLowerCase() || '';
      const customerName = typeof job.customer === 'string'
        ? job.customer.toLowerCase()
        : (job.customer?.name || '').toLowerCase();

      const impactPONumber = job.impactPO?.poNumber?.toLowerCase() || job.impactPO?.externalRef?.toLowerCase() || '';
      const bradfordPONumber = job.bradfordPO?.poNumber?.toLowerCase() || job.bradfordPO?.externalRef?.toLowerCase() || '';

      if (!jobNo.includes(query) && !customerName.includes(query) &&
          !impactPONumber.includes(query) && !bradfordPONumber.includes(query)) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      const hasMatchingStatus =
        (job.impactPO && job.impactPO.status === statusFilter) ||
        (job.bradfordPO && job.bradfordPO.status === statusFilter);
      if (!hasMatchingStatus) {
        return false;
      }
    }

    return true;
  });

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
  const customerGroups = new Map<string, { customerName: string; jobs: any[]; totalPOs: number; totalAmount: number }>();
  filteredJobs.forEach((job) => {
    const customerName = getCustomerName(job);
    if (!customerGroups.has(customerName)) {
      customerGroups.set(customerName, {
        customerName,
        jobs: [],
        totalPOs: 0,
        totalAmount: 0,
      });
    }
    const group = customerGroups.get(customerName)!;
    group.jobs.push(job);
    group.totalPOs += (job.impactPO ? 1 : 0) + (job.bradfordPO ? 1 : 0);
    group.totalAmount += Number(job.impactPO?.vendorAmount || 0) + Number(job.bradfordPO?.vendorAmount || 0);
  });

  const customerGroupsArray = Array.from(customerGroups.values());

  return (
    <div className="space-y-4">
      {/* Header with Filters and Create Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by job#, customer, or PO#..."
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
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Showing {customerGroupsArray.length} customers, {filteredJobs.length} jobs with POs
          </div>

          <button
            onClick={() => setShowCreatePO(true)}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create PO to JD
          </button>
        </div>
      </div>

      {/* Customer Groups with Jobs and PO Sections (Accordion Style) */}
      <div className="space-y-4">
        {customerGroupsArray.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-gray-500">No purchase orders found matching your filters</p>
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
                          {customerGroup.jobs.length} {customerGroup.jobs.length === 1 ? 'Job' : 'Jobs'} • {customerGroup.totalPOs} POs
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-100">Total PO Amount</div>
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
            const sections = expandedSections[job.id] || { fromImpact: false, toJD: false };
            const customerName = getCustomerName(job);

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
                      <div className="text-xs font-medium text-purple-600">
                        {(job.impactPO ? 1 : 0) + (job.bradfordPO ? 1 : 0)} PO{((job.impactPO ? 1 : 0) + (job.bradfordPO ? 1 : 0)) !== 1 ? 's' : ''}
                      </div>
                      {job.bradfordPO && (
                        <div className="text-xs text-gray-500">
                          {job.bradfordPO.poNumber || job.bradfordPO.externalRef}
                        </div>
                      )}
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {job.status.replace(/_/g, ' ')}
                      </span>
                      <div className="text-xs text-gray-500">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable PO Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 space-y-3">
                    {/* PO FROM Impact Section */}
                    <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                      <button
                        onClick={() => toggleSection(job.id, 'fromImpact')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 text-blue-600 transition-transform ${sections.fromImpact ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm font-semibold text-blue-900">PO FROM Impact</span>
                          <span className="text-xs text-blue-600">(Impact Direct → Bradford)</span>
                        </div>
                        {job.impactPO && (
                          <span className="text-xs font-medium text-blue-600">
                            {job.impactPO.poNumber || job.impactPO.externalRef || 'PO Exists'}
                          </span>
                        )}
                      </button>

                      {sections.fromImpact && (
                        <div className="px-4 py-3 border-t border-blue-100 bg-blue-50">
                          {job.impactPO ? (
                            <>
                              {editingPOId === job.impactPO.id ? (
                                <div className="space-y-3 text-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">PO Number:</span>
                                    <span className="font-medium text-gray-900">
                                      {job.impactPO.poNumber || job.impactPO.externalRef || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Original Amount:</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editPOData.originalAmount}
                                      onChange={(e) => setEditPOData({ ...editPOData, originalAmount: e.target.value })}
                                      className="w-32 px-2 py-1 border border-blue-300 rounded text-sm"
                                    />
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Vendor Amount:</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editPOData.vendorAmount}
                                      onChange={(e) => setEditPOData({ ...editPOData, vendorAmount: e.target.value })}
                                      className="w-32 px-2 py-1 border border-blue-300 rounded text-sm"
                                    />
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Status:</span>
                                    <select
                                      value={editPOData.status}
                                      onChange={(e) => setEditPOData({ ...editPOData, status: e.target.value })}
                                      className="px-2 py-1 border border-blue-300 rounded text-xs"
                                    >
                                      <option value="PENDING">PENDING</option>
                                      <option value="CONFIRMED">CONFIRMED</option>
                                      <option value="RECEIVED">RECEIVED</option>
                                      <option value="CANCELLED">CANCELLED</option>
                                    </select>
                                  </div>
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSavePO(job.impactPO.id);
                                      }}
                                      disabled={saving}
                                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs"
                                    >
                                      {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingPOId(null);
                                      }}
                                      disabled={saving}
                                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-xs"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">PO Number:</span>
                                    <span className="font-medium text-gray-900">
                                      {job.impactPO.poNumber || job.impactPO.externalRef || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Original Amount:</span>
                                    <span className="text-gray-900">
                                      ${Number(job.impactPO.originalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Vendor Amount:</span>
                                    <span className="font-medium text-gray-900">
                                      ${Number(job.impactPO.vendorAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Status:</span>
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {job.impactPO.status}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Date:</span>
                                    <span className="text-gray-900">{new Date(job.impactPO.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditPO(job.impactPO);
                                    }}
                                    className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-gray-500 italic">
                              No incoming PO from Impact Direct yet
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* PO TO JD Section */}
                    <div className="bg-white rounded-lg border border-orange-200 overflow-hidden">
                      <button
                        onClick={() => toggleSection(job.id, 'toJD')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 text-orange-600 transition-transform ${sections.toJD ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm font-semibold text-orange-900">PO TO JD</span>
                          <span className="text-xs text-orange-600">(Bradford → JD Graphic)</span>
                        </div>
                        {job.bradfordPO && (
                          <span className="text-xs font-medium text-orange-600">
                            {job.bradfordPO.poNumber || job.bradfordPO.externalRef || 'PO Exists'}
                          </span>
                        )}
                      </button>

                      {sections.toJD && (
                        <div className="px-4 py-3 border-t border-orange-100 bg-orange-50">
                          {job.bradfordPO ? (
                            <>
                              {editingPOId === job.bradfordPO.id ? (
                                <div className="space-y-3 text-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Bradford PO#:</span>
                                    <span className="font-medium text-gray-900">
                                      {job.bradfordPO.poNumber || job.bradfordPO.externalRef || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Original Amount:</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editPOData.originalAmount}
                                      onChange={(e) => setEditPOData({ ...editPOData, originalAmount: e.target.value })}
                                      className="w-32 px-2 py-1 border border-orange-300 rounded text-sm"
                                    />
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Vendor Amount:</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editPOData.vendorAmount}
                                      onChange={(e) => setEditPOData({ ...editPOData, vendorAmount: e.target.value })}
                                      className="w-32 px-2 py-1 border border-orange-300 rounded text-sm"
                                    />
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Margin:</span>
                                    <span className="font-medium text-green-600">
                                      ${(parseFloat(editPOData.originalAmount || '0') - parseFloat(editPOData.vendorAmount || '0')).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Status:</span>
                                    <select
                                      value={editPOData.status}
                                      onChange={(e) => setEditPOData({ ...editPOData, status: e.target.value })}
                                      className="px-2 py-1 border border-orange-300 rounded text-xs"
                                    >
                                      <option value="PENDING">PENDING</option>
                                      <option value="CONFIRMED">CONFIRMED</option>
                                      <option value="RECEIVED">RECEIVED</option>
                                      <option value="CANCELLED">CANCELLED</option>
                                    </select>
                                  </div>
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSavePO(job.bradfordPO.id);
                                      }}
                                      disabled={saving}
                                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs"
                                    >
                                      {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingPOId(null);
                                      }}
                                      disabled={saving}
                                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-xs"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Bradford PO#:</span>
                                    <span className="font-medium text-gray-900">
                                      {job.bradfordPO.poNumber || job.bradfordPO.externalRef || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Original Amount:</span>
                                    <span className="text-gray-900">
                                      ${Number(job.bradfordPO.originalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Vendor Amount:</span>
                                    <span className="font-medium text-gray-900">
                                      ${Number(job.bradfordPO.vendorAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Margin:</span>
                                    <span className="font-medium text-green-600">
                                      ${(Number(job.bradfordPO.originalAmount || 0) - Number(job.bradfordPO.vendorAmount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Status:</span>
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                      {job.bradfordPO.status}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Date:</span>
                                    <span className="text-gray-900">{new Date(job.bradfordPO.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditPO(job.bradfordPO);
                                    }}
                                    className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="space-y-3">
                              <div className="text-sm text-red-600 font-medium">
                                ⚠️ Needs PO Entry
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreatePO(job.id);
                                }}
                                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create PO to JD Graphic
                              </button>
                            </div>
                          )}
                        </div>
                      )}
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

      {/* Create PO Modal */}
      {showCreatePO && (
        <BradfordPOEntryModal
          jobs={jobs}
          preselectedJobId={selectedJobForPO}
          onClose={() => {
            setShowCreatePO(false);
            setSelectedJobForPO(null);
          }}
          onSuccess={() => {
            setShowCreatePO(false);
            setSelectedJobForPO(null);
            onRefresh();
            toast.success('Purchase order created successfully!');
          }}
        />
      )}
    </div>
  );
}
