'use client';

import { useState, useMemo, Fragment } from 'react';

interface Job {
  id: string;
  jobNo: string;
  customerPONumber?: string;
  status: string;
  customerTotal: string;
  deliveryDate?: string;
  mailDate?: string;
  inHomesDate?: string;
  quantity?: number;
  sizeName?: string;
  paperType?: string;
  specs?: {
    description?: string;
    paper?: string;
    flatSize?: string;
    foldedSize?: string;
  };
  requiredArtworkCount?: number;
  requiredDataFileCount?: number;
  sampleShipments?: Array<{
    id: string;
    recipientName: string;
    recipientAddress?: string;
    carrier: string;
    trackingNo?: string;
  }>;
}

interface JobsTableProps {
  jobs: Job[];
  onUploadFilesClick: (job: Job) => void;
  onReviewProofClick: (job: Job) => void;
  onViewBOLClick: (job: Job) => void;
  onRowClick?: (job: Job) => void;
}

type SortField = 'jobNo' | 'customerPONumber' | 'status' | 'deliveryDate' | 'customerTotal';
type SortDirection = 'asc' | 'desc';

export function JobsTable({
  jobs,
  onUploadFilesClick,
  onReviewProofClick,
  onViewBOLClick,
  onRowClick,
}: JobsTableProps) {
  const [expandedTracking, setExpandedTracking] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('deliveryDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedJobs = useMemo(() => {
    console.log('📊 JobsTable Debug - Sorting jobs:', {
      totalJobs: jobs.length,
      sortField,
      sortDirection,
      firstThreeJobs: jobs.slice(0, 3).map(j => ({
        jobNo: j.jobNo,
        customerPONumber: j.customerPONumber,
        status: j.status,
        description: j.description || j.specs?.description
      }))
    });

    const sorted = [...jobs].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'jobNo':
          aValue = a.jobNo;
          bValue = b.jobNo;
          break;
        case 'customerPONumber':
          aValue = a.customerPONumber || '';
          bValue = b.customerPONumber || '';
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'deliveryDate':
          aValue = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
          bValue = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
          break;
        case 'customerTotal':
          aValue = parseFloat(a.customerTotal);
          bValue = parseFloat(b.customerTotal);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [jobs, sortField, sortDirection]);

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING: 'bg-gray-100 text-gray-800',
      IN_PRODUCTION: 'bg-blue-100 text-blue-800',
      READY_FOR_PROOF: 'bg-yellow-100 text-yellow-800',
      PROOF_APPROVED: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-purple-100 text-purple-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getDueDateStatus = (deliveryDate?: string) => {
    if (!deliveryDate) return { color: '', urgent: false };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(deliveryDate);
    dueDate.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return { color: 'text-red-700 font-bold', urgent: true, label: 'OVERDUE' };
    } else if (daysUntilDue <= 3) {
      return { color: 'text-orange-700 font-semibold', urgent: true, label: `${daysUntilDue}d` };
    } else if (daysUntilDue <= 7) {
      return { color: 'text-yellow-700', urgent: false, label: `${daysUntilDue}d` };
    } else {
      return { color: 'text-gray-700', urgent: false, label: '' };
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const toggleTracking = (jobId: string) => {
    setExpandedTracking(expandedTracking === jobId ? null : jobId);
  };

  const getCarrierTrackingUrl = (carrier: string, trackingNo: string) => {
    const carriers: Record<string, string> = {
      UPS: `https://www.ups.com/track?tracknum=${trackingNo}`,
      FEDEX: `https://www.fedex.com/fedextrack/?trknbr=${trackingNo}`,
      USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNo}`,
    };
    return carriers[carrier.toUpperCase()] || '#';
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-blue-600">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12">
        <div className="max-w-2xl mx-auto text-center">
          <svg className="mx-auto h-16 w-16 text-blue-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>

          <h3 className="text-2xl font-semibold text-gray-900 mb-3">Welcome to Your Portal!</h3>
          <p className="text-gray-600 mb-8">Get started by submitting your first purchase order. Here's how it works:</p>

          <div className="text-left space-y-6 mb-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">1</div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Upload Your Purchase Order</h4>
                <p className="text-sm text-gray-600">Use the form above to upload your PO (PDF format). We'll automatically extract the details.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">2</div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Track Your Order</h4>
                <p className="text-sm text-gray-600">Once submitted, your order will appear here. You can track its progress through production.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">3</div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Review & Approve Proofs</h4>
                <p className="text-sm text-gray-600">When your proof is ready, you'll be notified to review and approve before we go to print.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">4</div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Receive & Track Shipment</h4>
                <p className="text-sm text-gray-600">Get tracking information for your order and samples right from your dashboard.</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Tip:</span> Have questions? Use the navigation menu above to explore quotes, invoices, and other features.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="customerPONumber">
                Customer PO# / Job#
              </SortableHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paper
              </th>
              <SortableHeader field="status">
                Status
              </SortableHeader>
              <SortableHeader field="deliveryDate">
                Due Date
              </SortableHeader>
              <SortableHeader field="customerTotal">
                Total
              </SortableHeader>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedJobs.map((job) => {
              const dueDateStatus = getDueDateStatus(job.deliveryDate);
              const hasTracking = job.sampleShipments && job.sampleShipments.length > 0;
              const isTrackingExpanded = expandedTracking === job.id;

              return (
                <Fragment key={job.id}>
                  <tr
                    onClick={() => onRowClick?.(job)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {/* Customer PO# */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {job.customerPONumber || job.jobNo}
                      </div>
                      <div className="text-xs text-gray-500">{job.jobNo}</div>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {job.description || job.specs?.description || 'No description'}
                      </div>
                    </td>

                    {/* Size */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {job.sizeName || job.specs?.flatSize || job.specs?.foldedSize || '-'}
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {job.quantity ? job.quantity.toLocaleString() : '-'}
                      </div>
                    </td>

                    {/* Paper */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {job.paperType || job.specs?.paper || '-'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(job.status)}`}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Due Date */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className={`text-sm ${dueDateStatus.color}`}>
                        {formatDate(job.deliveryDate)}
                        {dueDateStatus.urgent && (
                          <span className="ml-2 text-xs">
                            {dueDateStatus.label === 'OVERDUE' ? '⚠️ OVERDUE' : `⏰ ${dueDateStatus.label}`}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">
                        ${Number(job.customerTotal).toFixed(2)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {/* Upload Files Button */}
                        {job.status === 'PENDING' && (job.requiredArtworkCount > 0 || job.requiredDataFileCount > 0) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUploadFilesClick(job);
                            }}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
                          >
                            Upload Files
                          </button>
                        )}

                        {/* Review Proof Button */}
                        {job.status === 'READY_FOR_PROOF' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReviewProofClick(job);
                            }}
                            className="px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs font-medium"
                          >
                            Review Proof
                          </button>
                        )}

                        {/* View BOL Button */}
                        {job.status === 'COMPLETED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewBOLClick(job);
                            }}
                            className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs font-medium flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            View BOL
                          </button>
                        )}

                        {/* Tracking Info Button */}
                        {hasTracking && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTracking(job.id);
                            }}
                            className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs font-medium flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            Tracking
                            {isTrackingExpanded ? ' ▼' : ' ▶'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Tracking Info Row */}
                  {isTrackingExpanded && hasTracking && (
                    <tr className="bg-gray-50">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-900">Sample Shipments</h4>
                          {job.sampleShipments!.map((shipment) => (
                            <div key={shipment.id} className="bg-white p-3 rounded border border-gray-200">
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Recipient</p>
                                  <p className="font-medium text-gray-900">{shipment.recipientName}</p>
                                  {shipment.recipientAddress && (
                                    <p className="text-xs text-gray-600 mt-1">{shipment.recipientAddress}</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Carrier</p>
                                  <p className="text-gray-900">{shipment.carrier}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-xs text-gray-500 mb-1">Tracking Number</p>
                                  {shipment.trackingNo ? (
                                    <a
                                      href={getCarrierTrackingUrl(shipment.carrier, shipment.trackingNo)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                    >
                                      {shipment.trackingNo}
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  ) : (
                                    <p className="text-gray-400">Not available</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
