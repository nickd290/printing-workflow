'use client';

import { useState, useEffect } from 'react';
import { jobsAPI } from '@/lib/api-client';
import { AlertTriangle, Check, X, DollarSign, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

interface Job {
  id: string;
  jobNo: string;
  customerId: string;
  sizeName: string;
  quantity: number;
  customerTotal: number;
  bradfordTotal: number;
  jdTotal: number;
  impactMargin: number;
  requiresApproval: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  files?: any[];
}

interface JobApprovalSectionProps {
  onJobUpdated?: () => void;
}

export function JobApprovalSection({ onJobUpdated }: JobApprovalSectionProps) {
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPendingJobs();
  }, []);

  const loadPendingJobs = async () => {
    try {
      setLoading(true);
      const response = await jobsAPI.getPendingApproval();
      setPendingJobs(response.jobs || []);
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
      toast.error('Failed to load jobs requiring approval');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedJob) return;

    try {
      setSubmitting(true);
      await jobsAPI.approve(selectedJob.id, 'admin@impactdirect.com', reason || undefined);
      toast.success(`Job ${selectedJob.jobNo} approved!`);
      setShowApproveModal(false);
      setReason('');
      setSelectedJob(null);
      loadPendingJobs();
      onJobUpdated?.();
    } catch (error) {
      console.error('Failed to approve job:', error);
      toast.error('Failed to approve job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedJob || !reason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setSubmitting(true);
      await jobsAPI.reject(selectedJob.id, 'admin@impactdirect.com', reason);
      toast.success(`Job ${selectedJob.jobNo} rejected`);
      setShowRejectModal(false);
      setReason('');
      setSelectedJob(null);
      loadPendingJobs();
      onJobUpdated?.();
    } catch (error) {
      console.error('Failed to reject job:', error);
      toast.error('Failed to reject job');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="text-yellow-500" size={20} />
          <h2 className="text-lg font-semibold">Jobs Requiring Approval</h2>
        </div>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (pendingJobs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="text-green-500" size={20} />
          <h2 className="text-lg font-semibold">Jobs Requiring Approval</h2>
        </div>
        <p className="text-gray-500">No jobs requiring approval at this time.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-yellow-500" size={20} />
            <h2 className="text-lg font-semibold">Jobs Requiring Approval</h2>
            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {pendingJobs.length}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {pendingJobs.map((job) => (
            <div
              key={job.id}
              className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 hover:border-yellow-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono font-semibold text-gray-900">{job.jobNo}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-700">{job.customer.name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
                    <div className="flex items-center gap-1 text-gray-600">
                      <FileText size={14} />
                      <span>{job.sizeName} × {job.quantity.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <DollarSign size={14} />
                      <span>Customer: ${job.customerTotal.toFixed(2)}</span>
                    </div>
                    <div className="text-gray-600">
                      Impact Margin: ${job.impactMargin.toFixed(2)}
                    </div>
                    <div className="text-gray-600">
                      Bradford: ${job.bradfordTotal.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded inline-flex">
                    <AlertTriangle size={12} />
                    <span>Custom pricing below standard rate - approval required</span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setSelectedJob(job);
                      setShowApproveModal(true);
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    <Check size={16} />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setSelectedJob(job);
                      setShowRejectModal(true);
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    <X size={16} />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Approve Job {selectedJob.jobNo}</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to approve this job with custom pricing?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Approval Note (Optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={3}
                placeholder="Add any notes about this approval..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setReason('');
                  setSelectedJob(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Approving...' : 'Approve Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Reject Job {selectedJob.jobNo}</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this job:
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                placeholder="Explain why this job is being rejected..."
                required
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setReason('');
                  setSelectedJob(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                disabled={submitting || !reason.trim()}
              >
                {submitting ? 'Rejecting...' : 'Reject Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
