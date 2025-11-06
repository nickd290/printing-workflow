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
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: { fromImpact: boolean; toJD: boolean } }>({});

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

  // Apply filters
  const filteredJobs = jobs.filter((job) => {
    // Find Bradford POs (where Bradford is the origin/buyer)
    const bradfordPO = job.purchaseOrders?.find((po: any) => po.originCompanyId === 'bradford');

    // "Needs PO Only" filter: show jobs that DON'T have Bradford→JD PO yet
    if (showNeedsPOOnly && bradfordPO) {
      return false;
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

      {/* Jobs List (Accordion Style) */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-gray-500">No jobs found matching your filters</p>
          </div>
        ) : (
          filteredJobs.map((job) => {
            const isExpanded = expandedJobs.has(job.id);
            const sections = expandedSections[job.id] || { fromImpact: false, toJD: false };

            // Find POs
            const impactPO = job.purchaseOrders?.find((po: any) =>
              po.originCompanyId === 'impact-direct' && po.targetCompanyId === 'bradford'
            );
            const bradfordPO = job.purchaseOrders?.find((po: any) =>
              po.originCompanyId === 'bradford' && po.targetCompanyId === 'jd-graphic'
            );

            const customerName = getCustomerName(job);
            const hasBradfordPO = !!bradfordPO;

            return (
              <div key={job.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Job Header (Clickable to expand/collapse) */}
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
                      {hasBradfordPO ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          PO: {bradfordPO.poNumber || bradfordPO.externalRef || 'Created'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Needs PO
                        </span>
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

                {/* Expandable Content */}
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
                        {impactPO && (
                          <span className="text-xs font-medium text-blue-600">
                            {impactPO.poNumber || impactPO.externalRef || 'PO Exists'}
                          </span>
                        )}
                      </button>

                      {sections.fromImpact && (
                        <div className="px-4 py-3 border-t border-blue-100 bg-blue-50">
                          {impactPO ? (
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">PO Number:</span>
                                <span className="font-medium text-gray-900">{impactPO.poNumber || impactPO.externalRef || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Amount:</span>
                                <span className="font-medium text-gray-900">
                                  ${Number(impactPO.vendorAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Status:</span>
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {impactPO.status}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Date:</span>
                                <span className="text-gray-900">{new Date(impactPO.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
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
                        {bradfordPO && (
                          <span className="text-xs font-medium text-orange-600">
                            {bradfordPO.poNumber || bradfordPO.externalRef || 'PO Exists'}
                          </span>
                        )}
                      </button>

                      {sections.toJD && (
                        <div className="px-4 py-3 border-t border-orange-100 bg-orange-50">
                          {bradfordPO ? (
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Bradford PO#:</span>
                                <span className="font-medium text-gray-900">{bradfordPO.poNumber || bradfordPO.externalRef || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Vendor Amount:</span>
                                <span className="font-medium text-gray-900">
                                  ${Number(bradfordPO.vendorAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Original Amount:</span>
                                <span className="text-gray-900">
                                  ${Number(bradfordPO.originalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Margin:</span>
                                <span className="font-medium text-green-600">
                                  ${Number(bradfordPO.marginAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Status:</span>
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  {bradfordPO.status}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Date:</span>
                                <span className="text-gray-900">{new Date(bradfordPO.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
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

                    {/* View Full Details Button */}
                    <div className="pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onJobClick(job.id);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Full Job Details
                      </button>
                    </div>
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
