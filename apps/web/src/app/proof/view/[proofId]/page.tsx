'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ProofData {
  id: string;
  version: number;
  status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
  adminComments?: string;
  createdAt: string;
  job: {
    id: string;
    jobNo: string;
    customerTotal: number;
    specs: any;
    customer: {
      name: string;
    };
  };
  file: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  };
  approvals: Array<{
    id: string;
    approved: boolean;
    comments?: string;
    approvedBy?: string;
    createdAt: string;
  }>;
}

export default function ProofViewerPage() {
  const params = useParams();
  const router = useRouter();
  const proofId = params?.proofId as string;

  const [proof, setProof] = useState<ProofData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [comments, setComments] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!proofId) return;

    async function fetchProof() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        // Fetch proof data
        const proofRes = await fetch(`${apiUrl}/api/proofs/${proofId}`);
        if (!proofRes.ok) {
          throw new Error('Proof not found');
        }
        const proofData = await proofRes.json();
        setProof(proofData);

        // Fetch file download URL
        const fileRes = await fetch(`${apiUrl}/api/files/${proofData.file.id}/download-url`);
        if (fileRes.ok) {
          const { url } = await fileRes.json();
          setFileUrl(url);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load proof');
      } finally {
        setLoading(false);
      }
    }

    fetchProof();
  }, [proofId]);

  const handleApprove = async () => {
    if (!proof) return;
    setActionLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/proofs/${proofId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedBy: proof.job.customer.name,
          comments: comments || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to approve proof');
      }

      setSuccessMessage('✅ Proof approved successfully! We will begin production shortly.');
      setShowSuccess(true);

      // Refresh proof data
      const updatedProof = await res.json();
      setProof(updatedProof);
    } catch (err: any) {
      alert(err.message || 'Failed to approve proof');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!proof) return;
    if (!comments.trim()) {
      alert('Please provide comments about the changes you need');
      return;
    }

    setActionLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/proofs/${proofId}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments,
          requestedBy: proof.job.customer.name,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to request changes');
      }

      setSuccessMessage('📝 Changes requested successfully! We will prepare a new proof for you.');
      setShowSuccess(true);

      // Refresh proof data
      const updatedProof = await res.json();
      setProof(updatedProof);
    } catch (err: any) {
      alert(err.message || 'Failed to request changes');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading proof...</p>
        </div>
      </div>
    );
  }

  if (error || !proof) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Proof Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The proof you are looking for does not exist.'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const isAlreadyActedOn = proof.status !== 'PENDING';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Proof Review</h1>
              <p className="text-gray-600 mt-1">Job {proof.job.jobNo} - Version {proof.version}</p>
            </div>
            <div>
              {proof.status === 'PENDING' && (
                <span className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-semibold">
                  ⏳ Awaiting Review
                </span>
              )}
              {proof.status === 'APPROVED' && (
                <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
                  ✅ Approved
                </span>
              )}
              {proof.status === 'CHANGES_REQUESTED' && (
                <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded-full text-sm font-semibold">
                  📝 Changes Requested
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-semibold text-gray-900">{proof.job.customer.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Order Total</p>
              <p className="font-semibold text-gray-900">${proof.job.customerTotal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Uploaded</p>
              <p className="font-semibold text-gray-900">
                {new Date(proof.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {proof.adminComments && (
            <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-sm font-semibold text-blue-900 mb-1">Note from Production Team:</p>
              <p className="text-blue-800">{proof.adminComments}</p>
            </div>
          )}
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg shadow-lg mb-6">
            <p className="text-green-800 text-lg font-semibold">{successMessage}</p>
          </div>
        )}

        {/* Proof File Viewer */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Proof File</h2>
          {fileUrl ? (
            <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
              {proof.file.mimeType.startsWith('image/') ? (
                <img src={fileUrl} alt="Proof" className="w-full h-auto" />
              ) : proof.file.mimeType === 'application/pdf' ? (
                <iframe src={fileUrl} className="w-full h-[600px]" title="Proof PDF" />
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition"
                  >
                    Download File ({proof.file.filename})
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">Loading proof file...</p>
          )}
        </div>

        {/* Action Panel */}
        {!isAlreadyActedOn ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Your Decision</h2>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Comments (Optional for approval, Required for changes)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={4}
                placeholder="Enter your comments or change requests here..."
                disabled={actionLoading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center gap-2"
              >
                ✅ Approve Proof
              </button>

              <button
                onClick={handleRequestChanges}
                disabled={actionLoading || !comments.trim()}
                className="bg-orange-600 text-white px-8 py-4 rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center gap-2"
              >
                📝 Request Changes
              </button>
            </div>

            <p className="text-sm text-gray-500 mt-4 text-center">
              ⚠️ Once you submit your decision, production will proceed accordingly
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Approval History</h2>
            <div className="space-y-4">
              {proof.approvals.map((approval) => (
                <div
                  key={approval.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    approval.approved
                      ? 'bg-green-50 border-green-500'
                      : 'bg-orange-50 border-orange-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900">
                      {approval.approved ? '✅ Approved' : '📝 Changes Requested'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(approval.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {approval.approvedBy && (
                    <p className="text-sm text-gray-700 mb-1">By: {approval.approvedBy}</p>
                  )}
                  {approval.comments && (
                    <p className="text-gray-800 mt-2">{approval.comments}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
