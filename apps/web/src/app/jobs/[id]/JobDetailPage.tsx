'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/navigation';

// Types
interface Job {
  id: string;
  jobNo: string;
  customer: { id: string; name: string; email: string };
  customerTotal: number;
  status: string;
  specs: any;
  deliveryDate?: string;
  packingSlipNotes?: string;
  customerPONumber?: string;
  customerPOFile?: string;
  createdAt: string;
  files?: FileItem[];
  proofs?: Proof[];
  purchaseOrders?: PurchaseOrder[];
  invoices?: Invoice[];
  shipments?: Shipment[];
  sampleShipments?: SampleShipment[];
}

interface FileItem {
  id: string;
  fileName: string;
  kind: string;
  size: number;
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

interface ProofApproval {
  id: string;
  approved: boolean;
  comments?: string;
  approvedBy?: string;
  createdAt: string;
}

interface PurchaseOrder {
  id: string;
  originCompany: { name: string };
  targetCompany: { name: string };
  vendorAmount: number;
  status: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  fromCompany: { name: string };
  toCompany: { name: string };
  amount: number;
  status: string;
  createdAt: string;
}

interface Shipment {
  id: string;
  carrier: string;
  trackingNo?: string;
  scheduledAt?: string;
  shippedAt?: string;
}

interface SampleShipment {
  id: string;
  recipientName: string;
  recipientEmail: string;
  recipientAddress?: string;
  carrier: string;
  trackingNo?: string;
  sentAt?: string;
}

interface JobDetailPageProps {
  jobId: string;
}

export default function JobDetailPage({ jobId }: JobDetailPageProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine if current user is admin
  const isAdmin = true;

  // File upload states
  const [uploadingPO, setUploadingPO] = useState(false);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);

  // Proof upload form
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofNotes, setProofNotes] = useState('');
  const [proofComments, setProofComments] = useState('');

  // Delivery form
  const [deliveryDate, setDeliveryDate] = useState('');
  const [packingSlipNotes, setPackingSlipNotes] = useState('');

  // Sample shipment modal
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [sampleRecipients, setSampleRecipients] = useState([
    { name: '', email: '', address: '' }
  ]);
  const [sampleCarrier, setSampleCarrier] = useState('');
  const [sampleTracking, setSampleTracking] = useState('');

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const loadJob = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/jobs/${jobId}`);
      if (!response.ok) throw new Error('Failed to load job');

      const data = await response.json();
      const jobData = data.job || data;
      setJob(jobData);

      if (jobData.deliveryDate) {
        setDeliveryDate(new Date(jobData.deliveryDate).toISOString().split('T')[0]);
      }
      if (jobData.packingSlipNotes) {
        setPackingSlipNotes(jobData.packingSlipNotes);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to load job:', err);
      setError('Failed to load job details.');
    } finally {
      setLoading(false);
    }
  };

  // File upload handlers
  const handlePOUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setUploadingPO(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('jobId', jobId);
      formData.append('kind', 'PO_PDF');

      const response = await fetch('http://localhost:3001/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      await loadJob();
      alert('PO uploaded successfully!');
    } catch (err) {
      console.error('Failed to upload PO:', err);
      alert('Failed to upload PO.');
    } finally {
      setUploadingPO(false);
    }
  };

  const handleArtworkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingArtwork(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('jobId', jobId);
        formData.append('kind', 'ARTWORK');

        const response = await fetch('http://localhost:3001/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');
      }
      await loadJob();
      alert(`${files.length} file(s) uploaded successfully!`);
    } catch (err) {
      console.error('Failed to upload artwork:', err);
      alert('Failed to upload artwork.');
    } finally {
      setUploadingArtwork(false);
      e.target.value = '';
    }
  };

  const handleProofUpload = async () => {
    if (!proofFile) {
      alert('Please select a proof file');
      return;
    }

    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('file', proofFile);
      formData.append('jobId', jobId);
      formData.append('kind', 'PROOF');
      if (proofNotes) formData.append('adminNotes', proofNotes);
      if (proofComments) formData.append('adminComments', proofComments);

      const response = await fetch('http://localhost:3001/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      await loadJob();
      setProofFile(null);
      setProofNotes('');
      setProofComments('');
      alert('Proof uploaded! Email sent to customer.');
    } catch (err) {
      console.error('Failed to upload proof:', err);
      alert('Failed to upload proof.');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleApproveProof = async (proofId: string) => {
    if (!confirm('Are you sure you want to approve this proof?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/proofs/${proofId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });

      if (!response.ok) throw new Error('Approval failed');
      await loadJob();
      alert('Proof approved!');
    } catch (err) {
      console.error('Failed to approve proof:', err);
      alert('Failed to approve proof.');
    }
  };

  const handleRequestChanges = async (proofId: string) => {
    const comments = prompt('Please describe the changes needed:');
    if (!comments) return;

    try {
      const response = await fetch(`http://localhost:3001/api/proofs/${proofId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, comments }),
      });

      if (!response.ok) throw new Error('Request failed');
      await loadJob();
      alert('Revision request sent.');
    } catch (err) {
      console.error('Failed to request changes:', err);
      alert('Failed to request changes.');
    }
  };

  const handleUpdateDelivery = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : null,
          packingSlipNotes,
        }),
      });

      if (!response.ok) throw new Error('Update failed');
      await loadJob();
      alert('Delivery information updated!');
    } catch (err) {
      console.error('Failed to update delivery:', err);
      alert('Failed to update delivery information.');
    }
  };

  const handleAddSampleShipment = async () => {
    try {
      for (const recipient of sampleRecipients) {
        if (!recipient.name || !recipient.email) continue;

        const response = await fetch(`http://localhost:3001/api/jobs/${jobId}/sample-shipments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientName: recipient.name,
            recipientEmail: recipient.email,
            recipientAddress: recipient.address,
            carrier: sampleCarrier,
            trackingNo: sampleTracking || undefined,
          }),
        });

        if (!response.ok) throw new Error('Failed to add sample shipment');
      }

      await loadJob();
      setShowSampleModal(false);
      setSampleRecipients([{ name: '', email: '', address: '' }]);
      setSampleCarrier('');
      setSampleTracking('');
      alert('Sample shipment(s) added!');
    } catch (err) {
      console.error('Failed to add sample shipment:', err);
      alert('Failed to add sample shipment.');
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
      alert('Failed to download file.');
    }
  };

  const addRecipient = () => {
    setSampleRecipients([...sampleRecipients, { name: '', email: '', address: '' }]);
  };

  const removeRecipient = (index: number) => {
    setSampleRecipients(sampleRecipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, field: 'name' | 'email' | 'address', value: string) => {
    const updated = [...sampleRecipients];
    updated[index][field] = value;
    setSampleRecipients(updated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-amber-500/10 text-amber-700 ring-amber-500/20';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-700 ring-blue-500/20';
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-700 ring-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-700 ring-slate-500/20';
    }
  };

  const getProofStatusBadge = (proof: Proof) => {
    const latestApproval = proof.approvals?.[0];

    if (!latestApproval) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/20">Pending</span>;
    }

    if (latestApproval.approved) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/20">Approved</span>;
    }

    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-700 ring-1 ring-inset ring-red-500/20">Revisions</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
              <p className="text-sm text-slate-600">Loading job details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-800 text-sm">{error || 'Job not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const customerName = typeof job.customer === 'string' ? job.customer : job.customer?.name || 'Unknown';
  const artworkFiles = job.files?.filter(f => f.kind === 'ARTWORK') || [];
  const poFiles = job.files?.filter(f => f.kind === 'PO_PDF') || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Modern Header */}
        <div className="mb-8">
          <Link href="/jobs" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Jobs
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{job.jobNo}</h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ring-1 ring-inset ${getStatusColor(job.status)}`}>
                  {job.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-slate-600">
                {customerName} • {new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600 mb-1">Total Value</p>
              <p className="text-3xl font-bold text-slate-900">${Number(job.customerTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Modern Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Files & Proofs Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Files & Proofs</h2>
              </div>

              <div className="p-6 space-y-6">
                {/* PO Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">Customer PO</label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePOUpload}
                    disabled={uploadingPO}
                    className="hidden"
                    id="po-upload"
                  />
                  <label
                    htmlFor="po-upload"
                    className="block border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 hover:bg-slate-50 transition-all cursor-pointer group"
                  >
                    {uploadingPO ? (
                      <div className="flex items-center justify-center gap-2 text-slate-600">
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                        <span className="text-sm">Uploading...</span>
                      </div>
                    ) : (
                      <>
                        <svg className="mx-auto h-10 w-10 text-slate-400 group-hover:text-slate-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="mt-2 text-sm font-medium text-slate-700">Upload PDF</p>
                        <p className="text-xs text-slate-500 mt-1">Auto-parsed purchase order</p>
                      </>
                    )}
                  </label>

                  {poFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {poFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{file.fileName}</p>
                              <p className="text-xs text-slate-500">{new Date(file.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => downloadFile(file.id, file.fileName)}
                            className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Artwork Files */}
                <div className="border-t border-slate-200 pt-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">Artwork Files</label>
                  <input
                    type="file"
                    multiple
                    onChange={handleArtworkUpload}
                    disabled={uploadingArtwork}
                    className="hidden"
                    id="artwork-upload"
                  />
                  <label
                    htmlFor="artwork-upload"
                    className="block border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 hover:bg-slate-50 transition-all cursor-pointer group"
                  >
                    {uploadingArtwork ? (
                      <div className="flex items-center justify-center gap-2 text-slate-600">
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                        <span className="text-sm">Uploading...</span>
                      </div>
                    ) : (
                      <>
                        <svg className="mx-auto h-10 w-10 text-slate-400 group-hover:text-slate-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="mt-2 text-sm font-medium text-slate-700">Upload artwork</p>
                        <p className="text-xs text-slate-500 mt-1">Multiple files supported</p>
                      </>
                    )}
                  </label>

                  {artworkFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {artworkFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">{file.fileName}</p>
                              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button
                            onClick={() => downloadFile(file.id, file.fileName)}
                            className="ml-4 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Proofs */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Proofs</h3>

                  {/* Admin Upload */}
                  {isAdmin && (
                    <div className="bg-violet-50 rounded-lg border border-violet-200 p-4 mb-4">
                      <div className="space-y-3">
                        <div>
                          <input
                            type="file"
                            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                            disabled={uploadingProof}
                            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-600 file:text-white hover:file:bg-violet-700 file:transition-colors file:cursor-pointer"
                          />
                        </div>
                        <textarea
                          value={proofComments}
                          onChange={(e) => setProofComments(e.target.value)}
                          placeholder="Comments for customer..."
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleProofUpload}
                          disabled={uploadingProof || !proofFile}
                          className="w-full px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {uploadingProof ? 'Uploading...' : 'Upload Proof'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Proof List */}
                  {job.proofs && job.proofs.length > 0 ? (
                    <div className="space-y-3">
                      {job.proofs.map((proof) => {
                        const latestApproval = proof.approvals?.[0];
                        const isPending = !latestApproval;

                        return (
                          <div key={proof.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-slate-900">v{proof.version}</span>
                                {getProofStatusBadge(proof)}
                              </div>
                              <button
                                onClick={() => downloadFile(proof.file.id, proof.file.fileName)}
                                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                              >
                                Download
                              </button>
                            </div>

                            {proof.adminComments && (
                              <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <p className="text-xs text-blue-900">{proof.adminComments}</p>
                              </div>
                            )}

                            {!isAdmin && isPending && (
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleApproveProof(proof.id)}
                                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRequestChanges(proof.id)}
                                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                                >
                                  Request Changes
                                </button>
                              </div>
                            )}

                            {latestApproval && latestApproval.comments && (
                              <div className={`mt-3 p-3 rounded-lg ${latestApproval.approved ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                                <p className="text-xs text-slate-700">{latestApproval.comments}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-sm">No proofs yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* Financials Section */}
            {job.purchaseOrders && job.purchaseOrders.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Purchase Orders</h2>
                </div>

                <div className="p-6 space-y-3">
                  {job.purchaseOrders.map((po, index) => {
                    const vendorAmount = Number(po.vendorAmount);
                    const margin = Number(job.customerTotal) - vendorAmount;
                    const marginPercent = ((margin / Number(job.customerTotal)) * 100).toFixed(1);

                    return (
                      <div key={po.id} className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {po.originCompany.name} → {po.targetCompany.name}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{new Date(po.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-slate-900">${vendorAmount.toLocaleString()}</p>
                            <p className="text-xs text-emerald-600 font-medium">${margin.toLocaleString()} ({marginPercent}%)</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">

            {/* Job Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Details</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Customer</p>
                  <p className="text-sm font-medium text-slate-900">{customerName}</p>
                  <p className="text-xs text-slate-500">{job.customer.email}</p>
                </div>
                {job.customerPONumber && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">PO Number</p>
                    <p className="text-sm font-medium text-slate-900">{job.customerPONumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-1">Created</p>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Specifications */}
            {job.specs && Object.keys(job.specs).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Specifications</h2>
                </div>
                <div className="p-6">
                  <dl className="space-y-3">
                    {Object.entries(job.specs).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-start">
                        <dt className="text-xs text-slate-500 capitalize flex-1">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                        <dd className="text-sm font-medium text-slate-900 text-right">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}

            {/* Delivery Info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Delivery</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-2">Delivery Date</label>
                  {isAdmin ? (
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium text-slate-900">
                      {deliveryDate ? new Date(deliveryDate).toLocaleDateString() : 'Not set'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-2">Packing Notes</label>
                  {isAdmin ? (
                    <textarea
                      value={packingSlipNotes}
                      onChange={(e) => setPackingSlipNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                      placeholder="Special instructions..."
                    />
                  ) : (
                    <p className="text-sm text-slate-700">
                      {packingSlipNotes || 'None'}
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <button
                    onClick={handleUpdateDelivery}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Update
                  </button>
                )}
              </div>
            </div>

            {/* Shipments */}
            {(job.shipments && job.shipments.length > 0) || (job.sampleShipments && job.sampleShipments.length > 0) ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Shipments</h2>
                </div>
                <div className="p-6 space-y-3">
                  {job.shipments?.map((shipment) => (
                    <div key={shipment.id} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm font-medium text-slate-900">{shipment.carrier}</p>
                      {shipment.trackingNo && (
                        <p className="text-xs text-slate-600 mt-1">{shipment.trackingNo}</p>
                      )}
                    </div>
                  ))}

                  {job.sampleShipments?.map((sample) => (
                    <div key={sample.id} className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <p className="text-sm font-medium text-slate-900">{sample.recipientName}</p>
                      <p className="text-xs text-slate-600">{sample.recipientEmail}</p>
                      {sample.trackingNo && (
                        <p className="text-xs text-slate-600 mt-1">{sample.carrier}: {sample.trackingNo}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

          </div>
        </div>
      </div>

      {/* Sample Modal */}
      {showSampleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Add Sample Shipment</h3>
              <button
                onClick={() => setShowSampleModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700">Recipients</label>
                  <button
                    onClick={addRecipient}
                    className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
                  >
                    + Add Another
                  </button>
                </div>

                <div className="space-y-4">
                  {sampleRecipients.map((recipient, index) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-700">Recipient {index + 1}</span>
                        {sampleRecipients.length > 1 && (
                          <button
                            onClick={() => removeRecipient(index)}
                            className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={recipient.name}
                          onChange={(e) => updateRecipient(index, 'name', e.target.value)}
                          placeholder="Name"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                        />
                        <input
                          type="email"
                          value={recipient.email}
                          onChange={(e) => updateRecipient(index, 'email', e.target.value)}
                          placeholder="Email"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                        />
                        <textarea
                          value={recipient.address}
                          onChange={(e) => updateRecipient(index, 'address', e.target.value)}
                          placeholder="Address (Optional)"
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Carrier</label>
                  <select
                    value={sampleCarrier}
                    onChange={(e) => setSampleCarrier(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  >
                    <option value="">Select carrier...</option>
                    <option value="UPS">UPS</option>
                    <option value="FedEx">FedEx</option>
                    <option value="USPS">USPS</option>
                    <option value="DHL">DHL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tracking Number</label>
                  <input
                    type="text"
                    value={sampleTracking}
                    onChange={(e) => setSampleTracking(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setShowSampleModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSampleShipment}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Add Sample
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
