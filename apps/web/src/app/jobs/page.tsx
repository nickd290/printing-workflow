'use client';

import { Navigation } from '@/components/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { jobsAPI, APIError } from '@/lib/api-client';
import { useUser } from '@/contexts/UserContext';
import toast, { Toaster } from 'react-hot-toast';
import { GroupedJobsTable } from '@/components/GroupedJobsTable';
import { PricingCalculator } from '@/components/PricingCalculator';
import type { CustomJobPricing } from '@printing-workflow/shared';

interface Job {
  id: string;
  jobNo: string;
  customer: { name: string } | string;
  sizeName?: string;
  quantity?: number;
  customerTotal: number;
  bradfordPrintMargin?: number;
  bradfordPaperMargin?: number;
  bradfordTotalMargin?: number;
  status: string;
  createdAt: string;
}

const statusColumns = [
  { id: 'PENDING', name: 'Pending', color: 'bg-gray-100' },
  { id: 'IN_PRODUCTION', name: 'In Production', color: 'bg-blue-100' },
  { id: 'READY_FOR_PROOF', name: 'Ready for Proof', color: 'bg-purple-100' },
  { id: 'PROOF_APPROVED', name: 'Proof Approved', color: 'bg-green-100' },
  { id: 'COMPLETED', name: 'Completed', color: 'bg-gray-200' },
];

export default function JobsPage() {
  const { user, isCustomer, isBradfordAdmin } = useUser();

  // Internal team members see all margin data (Admin, Bradford/Steve, Impact Direct, JD)
  const isInternalTeam = user && ['BROKER_ADMIN', 'BRADFORD_ADMIN'].includes(user.role);

  // Bradford and Impact Direct users can see grouped view
  const canSeeGroupedView = user && (isBradfordAdmin || user.role === 'BROKER_ADMIN');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [draggedJob, setDraggedJob] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customPricing, setCustomPricing] = useState<CustomJobPricing | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'grouped'>('kanban');

  useEffect(() => {
    if (user) {
      loadJobs();
    }
  }, [user]);

  const loadJobs = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Build filter params based on user role
      const params: any = {};

      if (isCustomer) {
        // Customers see only their own jobs
        params.customerId = user.companyId;
      } else if (isBradfordAdmin) {
        // Bradford sees jobs where they have POs
        params.companyId = user.companyId;
        params.userRole = user.role;
      }
      // Impact Direct (BROKER_ADMIN/MANAGER) sees all jobs - no filters needed

      const result = await jobsAPI.list(params);
      setJobs(result.jobs);
      setError(null);
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setError('Failed to load jobs. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (jobId: string) => {
    setDraggedJob(jobId);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (draggedJob) {
      // Optimistically update UI
      setJobs(prevJobs =>
        prevJobs.map(job =>
          job.id === draggedJob ? { ...job, status: newStatus } : job
        )
      );

      // Update on server
      try {
        await jobsAPI.updateStatus(draggedJob, newStatus);
      } catch (err) {
        console.error('Failed to update job status:', err);
        // Reload to get the correct state
        await loadJobs();
      }
    }
    setDraggedJob(null);
    setDragOverColumn(null);
  };

  const getCustomerName = (customer: Job['customer']): string => {
    if (typeof customer === 'string') return customer;
    return customer?.name || 'Unknown';
  };


  const handleCreateJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate that pricing calculator has calculated pricing
    if (!customPricing) {
      toast.error('Please select a size and quantity to calculate pricing');
      return;
    }

    // Show warning if pricing is below cost (loss scenario)
    if (customPricing.isLoss) {
      const confirmed = window.confirm(
        `WARNING: This pricing is below cost and will result in a loss of $${customPricing.lossAmount.toFixed(2)}.\n\n` +
        `This job will require manager approval before it can proceed.\n\n` +
        `Do you want to create this job anyway?`
      );
      if (!confirmed) {
        return;
      }
    }

    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const customerId = formData.get('customerId') as string;
    const description = formData.get('description') as string;

    try {
      await jobsAPI.createDirect({
        customerId,
        sizeId: customPricing.sizeId,
        quantity: customPricing.quantity,
        description,
        customPrice: customPricing.isCustomPricing ? customPricing.customerTotal : undefined,
      });

      toast.success('Job created successfully!');
      setShowNewJobModal(false);
      setCustomPricing(null);
      await loadJobs();
      setError(null);
    } catch (err) {
      console.error('Failed to create job:', err);
      toast.error('Failed to create job. Please try again.');
      setError('Failed to create job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      toast.loading('Exporting jobs to CSV...', { id: 'export' });
      const response = await fetch('http://localhost:3001/api/exports/jobs');
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jobs-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Jobs exported successfully!', { id: 'export' });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export jobs', { id: 'export' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Jobs</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track jobs through the production workflow
            </p>
          </div>
          <div className="flex gap-3">
            {canSeeGroupedView && (
              <div className="flex bg-gray-100 rounded-md p-1">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-1.5 text-sm font-medium rounded ${
                    viewMode === 'kanban'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Kanban
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-sm font-medium rounded ${
                    viewMode === 'table'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-3 py-1.5 text-sm font-medium rounded ${
                    viewMode === 'grouped'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Grouped
                </button>
              </div>
            )}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to CSV
            </button>
            {isCustomer ? (
              <Link
                href="/jobs/create"
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Job
              </Link>
            ) : (
              <button
                onClick={() => setShowNewJobModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
              >
                + New Job
              </button>
            )}
          </div>
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

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading jobs...</p>
          </div>
        ) : (
          <>
        {/* Grouped View */}
        {viewMode === 'grouped' && (
          <GroupedJobsTable jobs={jobs} isInternalTeam={!!isInternalTeam} />
        )}

        {/* Kanban Board */}
        {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statusColumns.map((column) => {
            const columnJobs = jobs.filter(job => job.status === column.id);
            const isDragOver = dragOverColumn === column.id;

            return (
              <div
                key={column.id}
                className="flex-shrink-0 w-80"
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div className={`${column.color} rounded-lg p-3 mb-3`}>
                  <h3 className="font-semibold text-gray-900 flex justify-between items-center">
                    {column.name}
                    <span className="text-sm bg-white rounded-full px-2 py-1">{columnJobs.length}</span>
                  </h3>
                </div>

                <div className={`space-y-3 min-h-[200px] rounded-lg p-2 transition-colors ${
                  isDragOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : ''
                }`}>
                  {columnJobs.map((job) => (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={() => handleDragStart(job.id)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white p-4 rounded-lg shadow hover:shadow-md transition-all border border-gray-200 cursor-move ${
                        draggedJob === job.id ? 'opacity-50' : ''
                      }`}
                    >
                      <Link
                        href={`/jobs/${job.id}`}
                        className="block"
                        onClick={(e) => {
                          if (draggedJob) e.preventDefault();
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-blue-600">{job.jobNo}</span>
                          <span className="text-sm text-gray-600">${Number(job.customerTotal).toFixed(2)}</span>
                        </div>
                        <p className="text-sm text-gray-900 mb-1">{getCustomerName(job.customer)}</p>
                        <p className="text-xs text-gray-500">{new Date(job.createdAt).toLocaleDateString()}</p>
                      </Link>
                    </div>
                  ))}

                  {columnJobs.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      {isDragOver ? 'Drop here' : 'No jobs'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* All Jobs Table */}
        {viewMode === 'table' && (
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">All Jobs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  {isInternalTeam && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin Breakdown</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      <Link href={`/jobs/${job.id}`}>{job.jobNo}</Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getCustomerName(job.customer)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{job.sizeName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{job.quantity ? job.quantity.toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${Number(job.customerTotal).toFixed(2)}</td>
                    {isInternalTeam && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {job.bradfordTotalMargin ? (
                          <div className="text-gray-700">
                            <div className="font-semibold text-green-700">${Number(job.bradfordTotalMargin).toFixed(2)}</div>
                            <div className="text-xs text-gray-500">
                              Print: ${Number(job.bradfordPrintMargin || 0).toFixed(2)} | Paper: ${Number(job.bradfordPaperMargin || 0).toFixed(2)}
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link href={`/jobs/${job.id}`} className="text-blue-600 hover:text-blue-900">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
        </>
        )}

        {/* New Job Modal */}
        {showNewJobModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Create New Job</h2>
                <button
                  onClick={() => setShowNewJobModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateJob} className="p-6 space-y-6">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer *
                  </label>
                  <select
                    name="customerId"
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select customer...</option>
                    <option value="jjsa">JJSA</option>
                    <option value="ballantine">Ballantine</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <input
                    type="text"
                    name="description"
                    required
                    placeholder="e.g., Holiday Mailer, Spring Campaign"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Pricing Calculator with Size, Quantity, and Custom Pricing */}
                <PricingCalculator
                  onPricingChange={setCustomPricing}
                  initialQuantity={10000}
                />

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowNewJobModal(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating...' : 'Create Job'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
