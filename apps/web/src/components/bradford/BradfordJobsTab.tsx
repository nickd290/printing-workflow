'use client';

import { useState } from 'react';
import { BradfordPOEntryModal } from './BradfordPOEntryModal';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BradfordJobsTabProps {
  jobs: any[];
  onJobClick: (jobId: string) => void;
  onRefresh: () => void;
}

export function BradfordJobsTab({ jobs, onJobClick, onRefresh }: BradfordJobsTabProps) {
  const [showNeedsPOOnly, setShowNeedsPOOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [selectedJobForPO, setSelectedJobForPO] = useState<string | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const handleCreatePO = (jobId: string) => {
    setSelectedJobForPO(jobId);
    setShowCreatePO(true);
  };

  const toggleCustomer = (customerName: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerName)) {
      newExpanded.delete(customerName);
    } else {
      newExpanded.add(customerName);
    }
    setExpandedCustomers(newExpanded);
  };

  // Apply filters
  const filteredJobs = jobs.filter((job) => {
    // Filter out jobs with $0 Bradford total (broken/incomplete jobs)
    if (!job.bradfordTotal || parseFloat(job.bradfordTotal) <= 0) {
      return false;
    }

    // Find incoming PO from Impact → Bradford
    const impactPO = job.purchaseOrders?.find((po: any) =>
      po.originCompanyId === 'impact-direct' && po.targetCompanyId === 'bradford'
    );

    // Find outgoing PO from Bradford → JD
    const bradfordPO = job.purchaseOrders?.find((po: any) =>
      po.originCompanyId === 'bradford' && po.targetCompanyId === 'jd-graphic'
    );

    // "Needs PO Only" filter: show jobs that HAVE incoming PO but DON'T have outgoing PO
    if (showNeedsPOOnly) {
      const hasIncomingPO = !!impactPO;
      const hasOutgoingPO = !!bradfordPO;

      // Only show jobs that have incoming PO AND don't have outgoing PO
      if (!(hasIncomingPO && !hasOutgoingPO)) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'ALL' && job.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const jobNo = job.jobNo?.toLowerCase() || '';
      const customerName = typeof job.customer === 'string'
        ? job.customer.toLowerCase()
        : (job.customer?.name || '').toLowerCase();
      const customerPO = job.customerPONumber?.toLowerCase() || '';

      if (!jobNo.includes(query) && !customerName.includes(query) && !customerPO.includes(query)) {
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

  // Group jobs by customer
  const jobsByCustomer = filteredJobs.reduce((acc, job) => {
    const customerName = getCustomerName(job);
    if (!acc[customerName]) {
      acc[customerName] = [];
    }
    acc[customerName].push(job);
    return acc;
  }, {} as Record<string, any[]>);

  // Sort customers alphabetically
  const sortedCustomers = Object.keys(jobsByCustomer).sort();

  return (
    <div className="space-y-4">
      {/* Header with Filters */}
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
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Needs PO Only Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showNeedsPOOnly}
              onChange={(e) => setShowNeedsPOOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Needs PO Only</span>
          </label>
        </div>

        <div className="text-sm text-gray-500">
          Showing {filteredJobs.length} of {jobs.length} jobs
        </div>
      </div>

      {/* Jobs List (Grouped by Customer, Expandable) */}
      <div className="space-y-2">
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-gray-500">No jobs found matching your filters</p>
          </div>
        ) : (
          sortedCustomers.map((customerName) => {
            const customerJobs = jobsByCustomer[customerName];
            const isExpanded = expandedCustomers.has(customerName);
            const jobsNeedingPO = customerJobs.filter(job =>
              !job.purchaseOrders?.some((po: any) =>
                po.originCompanyId === 'bradford' && po.targetCompanyId === 'jd-graphic'
              )
            ).length;

            return (
              <div key={customerName} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Customer Header Row */}
                <button
                  onClick={() => toggleCustomer(customerName)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-base font-bold text-gray-900">{customerName}</span>
                    <span className="text-sm text-gray-600">({customerJobs.length} jobs)</span>
                    {jobsNeedingPO > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                        {jobsNeedingPO} need PO
                      </span>
                    )}
                  </div>
                </button>

                {/* Expandable Jobs Table */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bradford PO to JD
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Job Info
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Production
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Financial
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {customerJobs.map((job) => {
                          // Find Bradford PO
                          const bradfordPO = job.purchaseOrders?.find((po: any) =>
                            po.originCompanyId === 'bradford' && po.targetCompanyId === 'jd-graphic'
                          );

                          // Parse specs JSON for additional production details
                          let specs: any = {};
                          try {
                            specs = typeof job.specs === 'string' ? JSON.parse(job.specs) : (job.specs || {});
                          } catch (e) {
                            specs = {};
                          }

                          // Calculate margin percentage
                          const marginPercent = job.bradfordTotal && job.bradfordTotalMargin
                            ? (parseFloat(job.bradfordTotalMargin) / parseFloat(job.bradfordTotal)) * 100
                            : 0;

                          return (
                            <tr key={job.id} className="hover:bg-gray-50">
                              {/* Bradford PO Number - KEY COLUMN */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {bradfordPO ? (
                                  <div className="text-sm font-bold text-green-700">
                                    {bradfordPO.poNumber || bradfordPO.externalRef || 'Created'}
                                  </div>
                                ) : (
                                  <div className="text-sm font-bold text-red-600">
                                    ⚠️ NEEDS PO
                                  </div>
                                )}
                              </td>

                              {/* Job Info */}
                              <td className="px-4 py-3">
                                <div className="text-sm font-semibold text-gray-900">{job.jobNo}</div>
                                {job.customerPONumber && (
                                  <div className="text-xs text-gray-500">Customer PO: {job.customerPONumber}</div>
                                )}
                                {(job.title || job.description) && (
                                  <div className="text-xs text-gray-700 mt-1">{job.title || job.description}</div>
                                )}
                              </td>

                              {/* Production Specs */}
                              <td className="px-4 py-3">
                                <div className="text-xs space-y-0.5">
                                  <div><span className="font-medium">Qty:</span> {job.quantity ? formatNumber(job.quantity, 0) : 'N/A'}</div>
                                  <div><span className="font-medium">Paper:</span> {job.paperType || 'N/A'}</div>
                                  {job.paperWeightTotal && (
                                    <div><span className="font-medium">Weight:</span> {formatNumber(job.paperWeightTotal, 1)} lbs</div>
                                  )}
                                  {(job.sizeName || specs.flatSize) && (
                                    <div><span className="font-medium">Size:</span> {job.sizeName || specs.flatSize}</div>
                                  )}
                                  {specs.colors && (
                                    <div><span className="font-medium">Colors:</span> {specs.colors}</div>
                                  )}
                                </div>
                              </td>

                              {/* Financial */}
                              <td className="px-4 py-3">
                                <div className="text-xs space-y-0.5">
                                  <div><span className="font-medium">Receives:</span> ${job.bradfordTotal ? formatNumber(job.bradfordTotal) : '0.00'}</div>
                                  <div><span className="font-medium">Pays JD:</span> ${job.jdTotal ? formatNumber(job.jdTotal) : '0.00'}</div>
                                  <div className="text-green-700 font-semibold">
                                    <span className="font-medium">Profit:</span> ${job.bradfordTotalMargin ? formatNumber(job.bradfordTotalMargin) : '0.00'} ({marginPercent.toFixed(1)}%)
                                  </div>
                                </div>
                              </td>

                              {/* Action */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {!bradfordPO && (
                                  <button
                                    onClick={() => handleCreatePO(job.id)}
                                    className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-red-700"
                                  >
                                    Create PO
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
