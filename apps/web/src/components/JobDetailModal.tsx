'use client';

import { useState, useEffect } from 'react';
import { jobsAPI, filesAPI, proofsAPI, invoicesAPI } from '@/lib/api-client';
import { useUser } from '@/contexts/UserContext';

interface JobDetailModalProps {
  jobId: string;
  onClose: () => void;
}

export function JobDetailModal({ jobId, onClose }: JobDetailModalProps) {
  const { user, isCustomer, isBrokerAdmin, isManager, isBradfordAdmin } = useUser();
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'pos' | 'shipment'>('overview');
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofComments, setProofComments] = useState('');

  // Role-based permissions
  const canUploadProof = isBrokerAdmin || isManager || isBradfordAdmin;
  const canApproveProof = isCustomer || isBrokerAdmin || isManager;
  const canGenerateInvoice = isBrokerAdmin || isManager;
  const canSeeAllPOs = isBrokerAdmin || isManager;
  const canSeeBradfordPOs = isBradfordAdmin;

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const loadJob = async () => {
    try {
      setLoading(true);
      const data = await jobsAPI.getById(jobId);
      setJob(data.job || data);
    } catch (err) {
      console.error('Failed to load job:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProofUpload = async () => {
    if (!proofFile) return;
    setUploadingProof(true);
    try {
      const uploadedFile = await filesAPI.upload(proofFile, 'PROOF', jobId);
      await proofsAPI.upload(jobId, uploadedFile.file.id);
      await loadJob();
      setProofFile(null);
      setProofComments('');
      alert('Proof uploaded successfully!');
    } catch (err) {
      console.error('Failed to upload proof:', err);
      alert('Failed to upload proof');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleApproveProof = async (proofId: string) => {
    try {
      await proofsAPI.approve(proofId, 'customer@demo.com', 'Approved');
      await loadJob();
      alert('Proof approved!');
    } catch (err) {
      console.error('Failed to approve proof:', err);
      alert('Failed to approve proof');
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      await invoicesAPI.generate(jobId);
      await loadJob();
      alert('Invoice generated!');
    } catch (err) {
      console.error('Failed to generate invoice:', err);
      alert('Failed to generate invoice');
    }
  };

  const downloadFile = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/files/${fileId}/download`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-gray-600">Loading job details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  const customerName = typeof job.customer === 'string' ? job.customer : job.customer?.name || 'Unknown';
  const artworkFiles = job.files?.filter((f: any) => f.kind === 'ARTWORK') || [];
  const poFiles = job.files?.filter((f: any) => f.kind === 'PO_PDF') || [];

  // Tabs - customers don't see PO tab
  const tabs = isCustomer
    ? [
        { id: 'overview', label: 'Job Details' },
        { id: 'files', label: 'Files & Proofs' },
        { id: 'shipment', label: 'Tracking & Invoice' },
      ]
    : [
        { id: 'overview', label: 'Overview' },
        { id: 'files', label: 'Files & Proofs' },
        { id: 'pos', label: 'Purchase Orders' },
        { id: 'shipment', label: 'Shipment & Invoice' },
      ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{job.jobNo}</h2>
            <p className="text-sm text-gray-600">{customerName} • ${Number(job.customerTotal).toLocaleString()}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6 bg-gray-50">
          <div className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Job Number</label>
                  <p className="text-lg font-semibold text-gray-900">{job.jobNo}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Customer</label>
                  <p className="text-lg font-semibold text-gray-900">{customerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {job.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Order Date</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total</label>
                  <p className="text-lg font-semibold text-gray-900">${Number(job.customerTotal).toLocaleString()}</p>
                </div>
                {job.deliveryDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Due Date</label>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(job.deliveryDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Specs */}
              {job.specs && Object.keys(job.specs).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Specifications</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {Object.entries(job.specs).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-sm font-medium text-gray-900">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {job.packingSlipNotes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Special Instructions</h3>
                  <p className="text-sm text-gray-700 bg-yellow-50 p-4 rounded-lg">{job.packingSlipNotes}</p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Job Created</p>
                      <p className="text-xs text-gray-500">{new Date(job.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Files & Proofs Tab */}
          {activeTab === 'files' && (
            <div className="space-y-6">
              {/* Artwork Files */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Artwork Files</h3>
                {artworkFiles.length > 0 ? (
                  <div className="space-y-2">
                    {artworkFiles.map((file: any) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                          <p className="text-xs text-gray-500">{new Date(file.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => downloadFile(file.id, file.fileName)}
                          className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-lg">No artwork files uploaded yet</p>
                )}
              </div>

              {/* PO Files */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Order Files</h3>
                {poFiles.length > 0 ? (
                  <div className="space-y-2">
                    {poFiles.map((file: any) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                          <p className="text-xs text-gray-500">{new Date(file.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => downloadFile(file.id, file.fileName)}
                          className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-lg">No PO files uploaded yet</p>
                )}
              </div>

              {/* Proofs */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Proofs</h3>
                  {canUploadProof && (
                    <>
                      <button
                        onClick={() => document.getElementById('proof-file-input')?.click()}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                      >
                        Upload Proof
                      </button>
                      <input
                        id="proof-file-input"
                        type="file"
                        className="hidden"
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      />
                    </>
                  )}
                </div>

                {proofFile && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-gray-900 mb-2">Selected: {proofFile.name}</p>
                    <textarea
                      value={proofComments}
                      onChange={(e) => setProofComments(e.target.value)}
                      placeholder="Comments for customer..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md mb-2"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleProofUpload}
                        disabled={uploadingProof}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {uploadingProof ? 'Uploading...' : 'Confirm Upload'}
                      </button>
                      <button
                        onClick={() => setProofFile(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {job.proofs && job.proofs.length > 0 ? (
                  <div className="space-y-3">
                    {job.proofs.map((proof: any) => {
                      const latestApproval = proof.approvals?.[0];
                      const isPending = !latestApproval;
                      const isApproved = latestApproval?.approved;

                      return (
                        <div key={proof.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-gray-900">v{proof.version}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                isPending ? 'bg-yellow-100 text-yellow-800' :
                                isApproved ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {isPending ? 'Pending' : isApproved ? 'Approved' : 'Revisions Requested'}
                              </span>
                            </div>
                            <button
                              onClick={() => downloadFile(proof.file.id, proof.file.fileName)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700"
                            >
                              Download
                            </button>
                          </div>
                          {proof.adminComments && (
                            <p className="text-sm text-gray-600 mb-2 p-2 bg-gray-50 rounded">{proof.adminComments}</p>
                          )}
                          {isPending && canApproveProof && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleApproveProof(proof.id)}
                                className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
                              >
                                Approve
                              </button>
                              <button
                                className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
                              >
                                Request Changes
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-lg">No proofs uploaded yet</p>
                )}
              </div>
            </div>
          )}

          {/* Purchase Orders Tab - Hidden for customers */}
          {!isCustomer && activeTab === 'pos' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Orders</h3>
              {job.purchaseOrders && job.purchaseOrders.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From → To</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {job.purchaseOrders.map((po: any) => {
                      const vendorAmount = Number(po.vendorAmount);
                      const originalAmount = Number(po.originalAmount || job.customerTotal);
                      const margin = originalAmount - vendorAmount;
                      const marginPercent = ((margin / originalAmount) * 100).toFixed(1);

                      return (
                        <tr key={po.id}>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {po.originCompany.name} → {po.targetCompany.name}
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900">
                            ${vendorAmount.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-sm text-green-600 font-medium">
                            ${margin.toLocaleString()} ({marginPercent}%)
                          </td>
                          <td className="px-4 py-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {po.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-500 text-center py-12 bg-gray-50 rounded-lg">
                  No purchase orders generated yet
                </p>
              )}
            </div>
          )}

          {/* Shipment & Invoice Tab */}
          {activeTab === 'shipment' && (
            <div className="space-y-6">
              {/* Shipment */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipment Details</h3>
                {job.shipments && job.shipments.length > 0 ? (
                  <div className="space-y-3">
                    {job.shipments.map((shipment: any) => (
                      <div key={shipment.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-500">Carrier</label>
                            <p className="text-sm text-gray-900">{shipment.carrier}</p>
                          </div>
                          {shipment.trackingNo && (
                            <div>
                              <label className="text-sm font-medium text-gray-500">Tracking Number</label>
                              <p className="text-sm text-gray-900">{shipment.trackingNo}</p>
                            </div>
                          )}
                          {shipment.scheduledAt && (
                            <div>
                              <label className="text-sm font-medium text-gray-500">Scheduled</label>
                              <p className="text-sm text-gray-900">
                                {new Date(shipment.scheduledAt).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-lg">No shipment scheduled yet</p>
                )}
              </div>

              {/* Invoice */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Invoice</h3>
                  {(!job.invoices || job.invoices.length === 0) && canGenerateInvoice && (
                    <button
                      onClick={handleGenerateInvoice}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                    >
                      Generate Invoice
                    </button>
                  )}
                </div>
                {job.invoices && job.invoices.length > 0 ? (
                  <div className="space-y-3">
                    {job.invoices.map((invoice: any) => (
                      <div key={invoice.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{invoice.invoiceNo}</p>
                            <p className="text-xs text-gray-500">
                              {invoice.fromCompany.name} → {invoice.toCompany?.name || 'Customer'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">${Number(invoice.amount).toLocaleString()}</p>
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                              invoice.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {invoice.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
                          {invoice.pdfUrl && (
                            <button className="text-blue-600 hover:text-blue-700 font-medium">
                              Download PDF
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-lg">No invoice generated yet</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
