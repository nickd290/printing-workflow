'use client';

interface FileItem {
  id: string;
  fileName: string;
  kind: string;
  size: number;
  createdAt: string;
}

interface ProofApproval {
  id: string;
  approved: boolean;
  comments?: string;
  approvedBy?: string;
  createdAt: string;
}

interface Proof {
  id: string;
  version: number;
  status: string;
  file: FileItem;
  adminNotes?: string;
  adminComments?: string;
  createdAt: string;
  approvals?: ProofApproval[];
}

interface ProofsTabProps {
  proofs: Proof[];
  isAdmin: boolean;
  onUploadProof: () => void;
  onApproveProof: (proofId: string) => void;
  onRequestChanges: (proofId: string) => void;
  onDownload: (fileId: string, fileName: string) => void;
  uploadingProof: boolean;
  proofFile: File | null;
  setProofFile: (file: File | null) => void;
  proofNotes: string;
  setProofNotes: (notes: string) => void;
  proofComments: string;
  setProofComments: (comments: string) => void;
}

export function ProofsTab({
  proofs,
  isAdmin,
  onUploadProof,
  onApproveProof,
  onRequestChanges,
  onDownload,
  uploadingProof,
  proofFile,
  setProofFile,
  proofNotes,
  setProofNotes,
  proofComments,
  setProofComments,
}: ProofsTabProps) {
  const getStatusBadge = (proof: Proof) => {
    const latestApproval = proof.approvals?.[0];

    if (!latestApproval) {
      return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending Review</span>;
    }

    if (latestApproval.approved) {
      return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Approved</span>;
    }

    return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Changes Requested</span>;
  };

  return (
    <div className="space-y-8">
      {/* Admin Upload Proof Section */}
      {isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload New Proof</h3>

          <div className="space-y-4">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Proof File</label>
              <input
                type="file"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                disabled={uploadingProof}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
              />
              {proofFile && (
                <p className="mt-2 text-sm text-gray-600">Selected: {proofFile.name}</p>
              )}
            </div>

            {/* Admin Notes (Internal) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Internal Notes (Not visible to customer)
              </label>
              <textarea
                value={proofNotes}
                onChange={(e) => setProofNotes(e.target.value)}
                disabled={uploadingProof}
                rows={3}
                placeholder="Add any internal notes or concerns about this proof..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Customer Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comments for Customer
              </label>
              <textarea
                value={proofComments}
                onChange={(e) => setProofComments(e.target.value)}
                disabled={uploadingProof}
                rows={3}
                placeholder="These comments will be included in the proof email to the customer..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Upload Button */}
            <button
              onClick={onUploadProof}
              disabled={uploadingProof || !proofFile}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {uploadingProof ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Uploading Proof...
                </div>
              ) : (
                'Upload Proof & Notify Customer'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Proof History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Proof History</h3>

        {proofs.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No proofs uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proofs.map((proof) => {
              const latestApproval = proof.approvals?.[0];
              const isPending = !latestApproval;

              return (
                <div key={proof.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  {/* Proof Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-semibold text-gray-900">Version {proof.version}</h4>
                        {getStatusBadge(proof)}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Uploaded {new Date(proof.createdAt).toLocaleDateString()} at {new Date(proof.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => onDownload(proof.file.id, proof.file.fileName)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Download Proof
                    </button>
                  </div>

                  {/* Admin Comments (Visible to Customer) */}
                  {proof.adminComments && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-1">Comments from Admin:</p>
                      <p className="text-sm text-gray-600">{proof.adminComments}</p>
                    </div>
                  )}

                  {/* Admin Notes (Admin Only) */}
                  {isAdmin && proof.adminNotes && (
                    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-1">Internal Notes:</p>
                      <p className="text-sm text-gray-600">{proof.adminNotes}</p>
                    </div>
                  )}

                  {/* Customer Approval Section */}
                  {!isAdmin && isPending && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-3">Review this proof:</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => onApproveProof(proof.id)}
                          className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors"
                        >
                          Approve Proof
                        </button>
                        <button
                          onClick={() => onRequestChanges(proof.id)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition-colors"
                        >
                          Request Changes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Approval History */}
                  {proof.approvals && proof.approvals.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Approval History:</p>
                      <div className="space-y-2">
                        {proof.approvals.map((approval) => (
                          <div key={approval.id} className={`p-3 rounded-lg ${approval.approved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {approval.approved ? 'Approved' : 'Changes Requested'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(approval.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {approval.comments && (
                              <p className="text-sm text-gray-600">{approval.comments}</p>
                            )}
                            {approval.approvedBy && (
                              <p className="text-xs text-gray-500 mt-1">By: {approval.approvedBy}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
