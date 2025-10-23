'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Proof {
  id: string;
  version: number;
  status: string;
  shareExpiresAt: string;
  job: {
    jobNo: string;
    customer: {
      name: string;
    };
  };
  file: {
    fileName: string;
    objectKey: string;
  };
}

export default function PublicProofViewerPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [proof, setProof] = useState<Proof | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchProof = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/proofs/share/${token}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('This proof link was not found. It may have been removed.');
          } else if (response.status === 410) {
            setError('This proof link has expired. Please request a new link.');
          } else {
            setError('Failed to load proof. Please try again later.');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setProof(data);
      } catch (err) {
        console.error('Error fetching proof:', err);
        setError('Failed to load proof. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProof();
  }, [token]);

  const handleApprove = async () => {
    if (!proof) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/proofs/${proof.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: feedback || 'Approved via share link',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve proof');
      }

      setSuccess(true);
    } catch (err) {
      console.error('Error approving proof:', err);
      alert('Failed to approve proof. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!proof) return;

    if (!feedback.trim()) {
      alert('Please provide feedback about what changes you need');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/proofs/${proof.id}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: feedback,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to request changes');
      }

      setSuccess(true);
    } catch (err) {
      console.error('Error requesting changes:', err);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDaysUntilExpiration = () => {
    if (!proof?.shareExpiresAt) return null;

    const now = new Date();
    const expires = new Date(proof.shareExpiresAt);
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading proof...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Issue</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">If you believe this is a mistake, please contact your print provider.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            Your feedback has been submitted successfully. We'll process your response and be in touch soon.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            View proof again
          </button>
        </div>
      </div>
    );
  }

  if (!proof) return null;

  const daysLeft = getDaysUntilExpiration();
  const isExpiringSoon = daysLeft !== null && daysLeft <= 2;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Proof Review</h1>
              <p className="mt-1 text-sm text-gray-600">
                Job #{proof.job.jobNo} • Version {proof.version}
              </p>
            </div>
            {daysLeft !== null && (
              <div className={`px-4 py-2 rounded-lg ${isExpiringSoon ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                <p className="text-sm font-medium">
                  {daysLeft > 0 ? `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : 'Expires today'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Proof Display */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="aspect-[8.5/11] bg-gray-100 flex items-center justify-center">
                {/* TODO: Display actual proof image/PDF */}
                <div className="text-center p-8">
                  <svg className="w-24 h-24 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600 font-medium">{proof.file.fileName}</p>
                  <p className="text-sm text-gray-500 mt-2">Proof File</p>
                  {/* In production, render the actual image or PDF viewer here */}
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Review & Approve</h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments (Optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any comments or feedback..."
                />
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={submitting || proof.status === 'APPROVED'}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {proof.status === 'APPROVED' ? 'Already Approved' : 'Approve Proof'}
                </button>

                <button
                  onClick={handleRequestChanges}
                  disabled={submitting || proof.status === 'APPROVED'}
                  className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Request Changes
                </button>
              </div>

              {proof.status === 'APPROVED' && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800 font-medium">
                    ✓ This proof has been approved
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
