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

interface FilesProofsTabProps {
  jobId: string;
  files: FileItem[];
  proofs: Proof[];
  isAdmin: boolean;
  onUploadPO: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadArtwork: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadProof: () => void;
  onApproveProof: (proofId: string) => void;
  onRequestChanges: (proofId: string) => void;
  onDownload: (fileId: string, fileName: string) => void;
  uploadingPO: boolean;
  uploadingArtwork: boolean;
  uploadingProof: boolean;
  proofFile: File | null;
  setProofFile: (file: File | null) => void;
  proofNotes: string;
  setProofNotes: (notes: string) => void;
  proofComments: string;
  setProofComments: (comments: string) => void;
}

export function FilesProofsTab({
  jobId,
  files,
  proofs,
  isAdmin,
  onUploadPO,
  onUploadArtwork,
  onUploadProof,
  onApproveProof,
  onRequestChanges,
  onDownload,
  uploadingPO,
  uploadingArtwork,
  uploadingProof,
  proofFile,
  setProofFile,
  proofNotes,
  setProofNotes,
  proofComments,
  setProofComments,
}: FilesProofsTabProps) {
  const artworkFiles = files.filter(f => f.kind === 'ARTWORK');
  const poFiles = files.filter(f => f.kind === 'PO_PDF');

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
      {/* Customer PO Upload */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Purchase Order</h3>
        <label htmlFor="po-upload" className="cursor-pointer">
          <input
            type="file"
            accept=".pdf"
            onChange={onUploadPO}
            disabled={uploadingPO}
            className="hidden"
            id="po-upload"
          />
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors">
            {uploadingPO ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="ml-3 text-gray-600">Uploading PO...</p>
              </div>
            ) : (
              <>
                <svg className="mx-auto h-10 w-10 text-gray-400 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm text-gray-700 font-medium">Click to upload PO (PDF)</p>
                <p className="text-xs text-gray-500 mt-1">System will automatically parse information</p>
              </>
            )}
          </div>
        </label>

        {poFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {poFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                    <p className="text-xs text-gray-500">Uploaded {new Date(file.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => onDownload(file.id, file.fileName)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artwork Upload */}
      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Artwork Files</h3>
        <label htmlFor="artwork-upload" className="cursor-pointer">
          <input
            type="file"
            multiple
            onChange={onUploadArtwork}
            disabled={uploadingArtwork}
            className="hidden"
            id="artwork-upload"
          />
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors mb-4">
            {uploadingArtwork ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="ml-3 text-gray-600">Uploading artwork...</p>
              </div>
            ) : (
              <>
                <svg className="mx-auto h-10 w-10 text-gray-400 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm text-gray-700 font-medium">Click to upload artwork files</p>
                <p className="text-xs text-gray-500 mt-1">Multiple files allowed</p>
              </>
            )}
          </div>
        </label>

        {artworkFiles.length > 0 ? (
          <div className="space-y-2">
            {artworkFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center flex-1">
                  <svg className="h-6 w-6 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onDownload(file.id, file.fileName)}
                  className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">No artwork files uploaded yet</p>
          </div>
        )}
      </div>

      {/* Proofs Section */}
      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Proofs</h3>

        {/* Admin Upload Proof */}
        {isAdmin && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
            <h4 className="text-base font-semibold text-gray-900 mb-4">Upload New Proof</h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Proof File</label>
                <input
                  type="file"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  disabled={uploadingProof}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer"
                />
                {proofFile && (
                  <p className="mt-2 text-sm text-gray-600">Selected: {proofFile.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Internal Notes (Not visible to customer)
                </label>
                <textarea
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  disabled={uploadingProof}
                  rows={2}
                  placeholder="Internal notes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments for Customer
                </label>
                <textarea
                  value={proofComments}
                  onChange={(e) => setProofComments(e.target.value)}
                  disabled={uploadingProof}
                  rows={2}
                  placeholder="Comments for customer..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>

              <button
                onClick={onUploadProof}
                disabled={uploadingProof || !proofFile}
                className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {uploadingProof ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </div>
                ) : (
                  'Upload Proof & Notify Customer'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Proof History */}
        {proofs.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500">No proofs uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proofs.map((proof) => {
              const latestApproval = proof.approvals?.[0];
              const isPending = !latestApproval;

              return (
                <div key={proof.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  {/* Proof Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-base font-semibold text-gray-900">Version {proof.version}</h4>
                        {getStatusBadge(proof)}
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(proof.createdAt).toLocaleDateString()} at {new Date(proof.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => onDownload(proof.file.id, proof.file.fileName)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Download
                    </button>
                  </div>

                  {/* Admin Comments */}
                  {proof.adminComments && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-1">From Admin:</p>
                      <p className="text-sm text-gray-600">{proof.adminComments}</p>
                    </div>
                  )}

                  {/* Admin Notes (Admin Only) */}
                  {isAdmin && proof.adminNotes && (
                    <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-1">Internal Notes:</p>
                      <p className="text-sm text-gray-600">{proof.adminNotes}</p>
                    </div>
                  )}

                  {/* Customer Approval Section */}
                  {!isAdmin && isPending && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onApproveProof(proof.id)}
                          className="flex-1 px-3 py-2 bg-green-600 text-white font-medium text-sm rounded-md hover:bg-green-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onRequestChanges(proof.id)}
                          className="flex-1 px-3 py-2 bg-red-600 text-white font-medium text-sm rounded-md hover:bg-red-700 transition-colors"
                        >
                          Request Changes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Approval History */}
                  {proof.approvals && proof.approvals.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-700 mb-2">Response:</p>
                      {proof.approvals.map((approval) => (
                        <div key={approval.id} className={`p-2 rounded-lg text-sm ${approval.approved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-900">
                              {approval.approved ? '✓ Approved' : '✗ Changes Requested'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(approval.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {approval.comments && (
                            <p className="text-xs text-gray-600">{approval.comments}</p>
                          )}
                        </div>
                      ))}
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
