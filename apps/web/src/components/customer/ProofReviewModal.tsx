'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';

// Dynamically import ProofViewer to avoid webpack bundling issues with pdfjs-dist
const ProofViewer = dynamic(
  () => import('../ProofViewer').then((mod) => ({ default: mod.ProofViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading viewer...</p>
        </div>
      </div>
    ),
  }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ProofReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobNo: string;
  proofId?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  onProofAction?: () => void;
}

export function ProofReviewModal({
  isOpen,
  onClose,
  jobId,
  jobNo,
  proofId,
  fileId,
  fileName,
  mimeType,
  onProofAction,
}: ProofReviewModalProps) {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleApprove = async () => {
    if (!proofId) {
      toast.error('Proof ID not found');
      return;
    }

    setSubmitting(true);
    try {
      toast.loading('Approving proof...', { id: 'proof-action' });

      const response = await fetch(`${API_URL}/api/proofs/${proofId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: feedback || 'Approved via customer portal',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve proof');
      }

      toast.success('Proof approved! Moving to production.', { id: 'proof-action' });

      if (onProofAction) {
        onProofAction();
      }

      onClose();
    } catch (error) {
      console.error('Proof approval failed:', error);
      toast.error('Failed to approve proof', { id: 'proof-action' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!proofId) {
      toast.error('Proof ID not found');
      return;
    }

    if (!feedback.trim()) {
      toast.error('Please provide feedback about what changes you need');
      return;
    }

    setSubmitting(true);
    try {
      toast.loading('Requesting changes...', { id: 'proof-action' });

      const response = await fetch(`${API_URL}/api/proofs/${proofId}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: feedback,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to request changes');
      }

      toast.success('Changes requested', { id: 'proof-action' });

      if (onProofAction) {
        onProofAction();
      }

      onClose();
    } catch (error) {
      console.error('Request changes failed:', error);
      toast.error('Failed to submit feedback', { id: 'proof-action' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Background overlay */}
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Review Proof</h3>
                <p className="text-sm text-gray-600 mt-1">Job #{jobNo}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6" style={{ height: '70vh' }}>
            {/* Proof Viewer (2/3 width) */}
            <div className="lg:col-span-2 h-full">
              {fileId && fileName && mimeType ? (
                <div className="h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <ProofViewer
                    fileUrl={`${API_URL}/api/files/${fileId}/download`}
                    fileName={fileName}
                    mimeType={mimeType}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
                  <p className="text-gray-500">Proof not available</p>
                </div>
              )}
            </div>

            {/* Feedback Panel (1/3 width) */}
            <div className="lg:col-span-1 flex flex-col">
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comments (Optional)
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add any comments or feedback..."
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {submitting ? 'Processing...' : 'Approve Proof'}
                  </button>

                  <button
                    onClick={handleRequestChanges}
                    disabled={submitting || !feedback.trim()}
                    className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Request Changes
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  Requesting changes requires comments
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
