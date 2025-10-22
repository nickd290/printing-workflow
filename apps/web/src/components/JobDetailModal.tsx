'use client';

import { useState, useEffect } from 'react';
import { jobsAPI, filesAPI, proofsAPI, invoicesAPI, purchaseOrdersAPI } from '@/lib/api-client';
import { useUser } from '@/contexts/UserContext';
import toast, { Toaster } from 'react-hot-toast';
import { PricingBreakdown } from '@/components/PricingBreakdown';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface JobDetailModalProps {
  jobId: string;
  onClose: () => void;
}

export function JobDetailModal({ jobId, onClose }: JobDetailModalProps) {
  const { user, isCustomer, isBrokerAdmin, isBradfordAdmin } = useUser();
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'pos' | 'shipment'>('overview');
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofComments, setProofComments] = useState('');

  // Edit mode states
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [editFormData, setEditFormData] = useState({
    deliveryDate: '',
    packingSlipNotes: '',
    customerPONumber: '',
    status: '',
  });
  const [saving, setSaving] = useState(false);

  // PO Edit state
  const [editingPOId, setEditingPOId] = useState<string | null>(null);
  const [editPOData, setEditPOData] = useState({
    vendorAmount: '',
    status: '',
  });

  // Invoice Edit state
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editInvoiceData, setEditInvoiceData] = useState({
    amount: '',
    status: '',
  });

  // Create PO state
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [newPOData, setNewPOData] = useState({
    originCompanyId: 'impact-direct',
    targetCompanyId: 'bradford',
    vendorAmount: '',
  });

  // PDF generation state
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);

  // Role-based permissions
  const canUploadProof = isBrokerAdmin || isBradfordAdmin;
  const canApproveProof = isCustomer || isBrokerAdmin;
  const canGenerateInvoice = isBrokerAdmin;
  const canSeeAllPOs = isBrokerAdmin;
  const canSeeBradfordPOs = isBradfordAdmin;
  const canEditJob = isBrokerAdmin;
  const canCreatePO = isBrokerAdmin || isBradfordAdmin; // Both can create POs

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const loadJob = async () => {
    try {
      setLoading(true);
      const data = await jobsAPI.getById(jobId);
      const jobData = data.job || data;
      setJob(jobData);

      // Initialize edit form data
      setEditFormData({
        deliveryDate: jobData.deliveryDate ? new Date(jobData.deliveryDate).toISOString().split('T')[0] : '',
        packingSlipNotes: jobData.packingSlipNotes || '',
        customerPONumber: jobData.customerPONumber || '',
        status: jobData.status || '',
      });
    } catch (err) {
      console.error('Failed to load job:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJob = async () => {
    if (!job) return;
    setSaving(true);

    try {
      // Update job details
      await fetch(`${API_URL}/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate: editFormData.deliveryDate || undefined,
          packingSlipNotes: editFormData.packingSlipNotes || undefined,
          customerPONumber: editFormData.customerPONumber || undefined,
        }),
      });

      // Update status if changed
      if (editFormData.status !== job.status) {
        await fetch(`${API_URL}/api/jobs/${job.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: editFormData.status }),
        });
      }

      toast.success('Job updated successfully!');
      setIsEditingJob(false);
      await loadJob();
    } catch (err) {
      console.error('Failed to save job:', err);
      toast.error('Failed to save job changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingJob(false);
    // Reset form to current job data
    if (job) {
      setEditFormData({
        deliveryDate: job.deliveryDate ? new Date(job.deliveryDate).toISOString().split('T')[0] : '',
        packingSlipNotes: job.packingSlipNotes || '',
        customerPONumber: job.customerPONumber || '',
        status: job.status || '',
      });
    }
  };

  const handleEditPO = (po: any) => {
    setEditingPOId(po.id);
    setEditPOData({
      vendorAmount: po.vendorAmount.toString(),
      status: po.status,
    });
  };

  const handleSavePO = async (poId: string) => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/purchase-orders/${poId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorAmount: parseFloat(editPOData.vendorAmount),
          status: editPOData.status,
        }),
      });
      toast.success('Purchase order updated!');
      setEditingPOId(null);
      await loadJob();
    } catch (err) {
      console.error('Failed to update PO:', err);
      toast.error('Failed to update purchase order');
    } finally {
      setSaving(false);
    }
  };

  const handleEditInvoice = (invoice: any) => {
    setEditingInvoiceId(invoice.id);
    setEditInvoiceData({
      amount: invoice.amount.toString(),
      status: invoice.status,
    });
  };

  const handleSaveInvoice = async (invoiceId: string) => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editInvoiceData.amount),
          status: editInvoiceData.status,
        }),
      });
      toast.success('Invoice updated!');
      setEditingInvoiceId(null);
      await loadJob();
    } catch (err) {
      console.error('Failed to update invoice:', err);
      toast.error('Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePO = async () => {
    if (!newPOData.vendorAmount || !job) return;

    setSaving(true);
    try {
      const vendorAmount = parseFloat(newPOData.vendorAmount);
      const originalAmount = Number(job.customerTotal);
      const marginAmount = originalAmount - vendorAmount;

      await fetch(`${API_URL}/api/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originCompanyId: newPOData.originCompanyId,
          targetCompanyId: newPOData.targetCompanyId,
          jobId: job.id,
          originalAmount,
          vendorAmount,
          marginAmount,
        }),
      });

      toast.success('Purchase order created!');
      setShowCreatePO(false);
      setNewPOData({
        originCompanyId: 'impact-direct',
        targetCompanyId: 'bradford',
        vendorAmount: '',
      });
      await loadJob();
    } catch (err) {
      console.error('Failed to create PO:', err);
      toast.error('Failed to create purchase order');
    } finally {
      setSaving(false);
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
      toast.success('Invoice generated successfully!');
    } catch (err) {
      console.error('Failed to generate invoice:', err);
      toast.error('Failed to generate invoice');
    }
  };

  const handleGenerateInvoicePdf = async (invoiceId: string) => {
    try {
      setGeneratingPdfId(invoiceId);
      toast.loading('Generating invoice PDF...', { id: 'gen-pdf' });
      await invoicesAPI.generatePdf(invoiceId);
      await loadJob();
      toast.success('Invoice PDF generated successfully!', { id: 'gen-pdf' });
    } catch (err) {
      console.error('Failed to generate invoice PDF:', err);
      toast.error('Failed to generate invoice PDF', { id: 'gen-pdf' });
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handleGeneratePOPdf = async (poId: string) => {
    try {
      setGeneratingPdfId(poId);
      toast.loading('Generating PO PDF...', { id: 'gen-pdf' });
      await purchaseOrdersAPI.generatePdf(poId);
      await loadJob();
      toast.success('PO PDF generated successfully!', { id: 'gen-pdf' });
    } catch (err) {
      console.error('Failed to generate PO PDF:', err);
      toast.error('Failed to generate PO PDF', { id: 'gen-pdf' });
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handleDownloadPdf = async (fileId: string, fileName: string) => {
    try {
      toast.loading('Preparing download...', { id: 'download-pdf' });
      const { url } = await filesAPI.getDownloadUrl(fileId);

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Download started!', { id: 'download-pdf' });
    } catch (err) {
      console.error('Failed to download PDF:', err);
      toast.error('Failed to download PDF', { id: 'download-pdf' });
    }
  };

  const handleEmailProof = async (proofId: string, customerEmail: string) => {
    try {
      toast.loading('Sending proof email...', { id: 'email-proof' });
      const response = await fetch(`${API_URL}/api/notifications/send-proof-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofId, customerEmail }),
      });

      if (!response.ok) throw new Error('Failed to send email');

      toast.success('Proof email sent to customer!', { id: 'email-proof' });
    } catch (error) {
      console.error('Failed to send proof email:', error);
      toast.error('Failed to send proof email', { id: 'email-proof' });
    }
  };

  const downloadFile = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`${API_URL}/api/files/${fileId}/download`);
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
      <Toaster position="top-right" />
      <div className="bg-white rounded-lg w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b-2 border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-1">{job.jobNo}</h2>
            <p className="text-base text-gray-600">{customerName} • <span className="font-semibold text-green-600">${Number(job.customerTotal).toLocaleString()}</span></p>
          </div>
          <div className="flex items-center gap-3">
            {canEditJob && activeTab === 'overview' && !isEditingJob && (
              <button
                onClick={() => setIsEditingJob(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Job
              </button>
            )}
            {isEditingJob && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveJob}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b-2 border-gray-200 px-8 bg-white">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-4 font-semibold text-base transition-all relative ${
                  activeTab === tab.id
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {!isEditingJob ? (
                <>
                  {/* View Mode */}
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
                      <label className="text-sm font-medium text-gray-500">Customer PO Number</label>
                      <p className="text-lg font-semibold text-gray-900">{job.customerPONumber || 'N/A'}</p>
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
                        <label className="text-sm font-medium text-gray-500">Delivery Date</label>
                        <p className="text-lg font-semibold text-gray-900">
                          {new Date(job.deliveryDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Specs */}
                  {job.specs && Object.keys(job.specs).length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                        Specifications
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-5 space-y-3 border border-gray-200">
                        {Object.entries(job.specs).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span className="text-sm font-medium text-gray-900">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing Breakdown */}
                  <PricingBreakdown job={job} userRole={user?.role} />

                  {/* Notes */}
                  {job.packingSlipNotes && (
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <div className="w-1 h-6 bg-yellow-500 rounded-full"></div>
                        Special Instructions
                      </h3>
                      <p className="text-sm text-gray-700 bg-yellow-50 p-5 rounded-lg border border-yellow-200">{job.packingSlipNotes}</p>
                    </div>
                  )}

                  {/* Timeline */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-green-600 rounded-full"></div>
                      Timeline
                    </h3>
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
                </>
              ) : (
                <>
                  {/* Edit Mode */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-blue-900">Edit Mode</p>
                        <p className="text-sm text-blue-700 mt-1">Update job details below. Click "Save Changes" when done.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Read-only fields */}
                    <div>
                      <label className="text-sm font-medium text-gray-500">Job Number</label>
                      <p className="text-lg font-semibold text-gray-900">{job.jobNo}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Customer</label>
                      <p className="text-lg font-semibold text-gray-900">{customerName}</p>
                    </div>

                    {/* Editable: Status */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Status *</label>
                      <select
                        value={editFormData.status}
                        onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PRODUCTION">IN PRODUCTION</option>
                        <option value="READY_FOR_PROOF">READY FOR PROOF</option>
                        <option value="PROOF_APPROVED">PROOF APPROVED</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>

                    {/* Editable: Customer PO Number */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Customer PO Number</label>
                      <input
                        type="text"
                        value={editFormData.customerPONumber}
                        onChange={(e) => setEditFormData({ ...editFormData, customerPONumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="PO-12345"
                      />
                    </div>

                    {/* Read-only */}
                    <div>
                      <label className="text-sm font-medium text-gray-500">Order Date</label>
                      <p className="text-lg font-semibold text-gray-900">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Editable: Delivery Date */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Delivery Date</label>
                      <input
                        type="date"
                        value={editFormData.deliveryDate}
                        onChange={(e) => setEditFormData({ ...editFormData, deliveryDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Editable: Packing Slip Notes */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Special Instructions / Notes</label>
                    <textarea
                      value={editFormData.packingSlipNotes}
                      onChange={(e) => setEditFormData({ ...editFormData, packingSlipNotes: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Add any special instructions or notes for this job..."
                    />
                  </div>

                  {/* Specs - Read-only in edit mode */}
                  {job.specs && Object.keys(job.specs).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Specifications (Read-Only)</h3>
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
                </>
              )}
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
                            <div className="flex items-center gap-2">
                              {canUploadProof && isPending && (
                                <button
                                  onClick={() => handleEmailProof(proof.id, job.customer.email || 'customer@example.com')}
                                  className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  Email to Customer
                                </button>
                              )}
                              <button
                                onClick={() => downloadFile(proof.file.id, proof.file.fileName)}
                                className="text-sm font-medium text-blue-600 hover:text-blue-700"
                              >
                                Download
                              </button>
                            </div>
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Purchase Orders</h3>
                {canCreatePO && !showCreatePO && (
                  <button
                    onClick={() => {
                      // Set default values based on role
                      if (isBradfordAdmin) {
                        setNewPOData({
                          originCompanyId: 'bradford',
                          targetCompanyId: 'jd-graphic',
                          vendorAmount: '',
                        });
                      } else {
                        setNewPOData({
                          originCompanyId: 'impact-direct',
                          targetCompanyId: 'bradford',
                          vendorAmount: '',
                        });
                      }
                      setShowCreatePO(true);
                    }}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Purchase Order
                  </button>
                )}
              </div>

              {/* Create PO Form */}
              {showCreatePO && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">New Purchase Order</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">From (Origin Company)</label>
                      <select
                        value={newPOData.originCompanyId}
                        onChange={(e) => setNewPOData({ ...newPOData, originCompanyId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="impact-direct">Impact Direct</option>
                        <option value="bradford">Bradford</option>
                        <option value="jd-graphic">JD Graphic</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">To (Target Company)</label>
                      <select
                        value={newPOData.targetCompanyId}
                        onChange={(e) => setNewPOData({ ...newPOData, targetCompanyId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="bradford">Bradford</option>
                        <option value="jd-graphic">JD Graphic</option>
                        <option value="impact-direct">Impact Direct</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Vendor Amount *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPOData.vendorAmount}
                        onChange={(e) => setNewPOData({ ...newPOData, vendorAmount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="0.00"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Job Total: ${Number(job.customerTotal).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Margin (Auto-calculated)</label>
                      <p className="text-lg font-semibold text-green-600 mt-2">
                        ${newPOData.vendorAmount ? (Number(job.customerTotal) - parseFloat(newPOData.vendorAmount)).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleCreatePO}
                      disabled={saving || !newPOData.vendorAmount}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? 'Creating...' : 'Create PO'}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreatePO(false);
                        setNewPOData({
                          originCompanyId: 'impact-direct',
                          targetCompanyId: 'bradford',
                          vendorAmount: '',
                        });
                      }}
                      disabled={saving}
                      className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {job.purchaseOrders && job.purchaseOrders.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From → To</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PDF</th>
                      {canCreatePO && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {job.purchaseOrders.map((po: any) => {
                      const vendorAmount = Number(po.vendorAmount);
                      const originalAmount = Number(po.originalAmount || job.customerTotal);
                      const margin = originalAmount - vendorAmount;
                      const marginPercent = ((margin / originalAmount) * 100).toFixed(1);
                      const isEditing = editingPOId === po.id;

                      return (
                        <tr key={po.id} className={isEditing ? 'bg-blue-50' : ''}>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {po.originCompany.name} → {po.targetCompany.name}
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editPOData.vendorAmount}
                                onChange={(e) => setEditPOData({ ...editPOData, vendorAmount: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            ) : (
                              `$${vendorAmount.toLocaleString()}`
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-green-600 font-medium">
                            ${margin.toLocaleString()} ({marginPercent}%)
                          </td>
                          <td className="px-4 py-4">
                            {isEditing ? (
                              <select
                                value={editPOData.status}
                                onChange={(e) => setEditPOData({ ...editPOData, status: e.target.value })}
                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="ACCEPTED">ACCEPTED</option>
                                <option value="IN_PROGRESS">IN PROGRESS</option>
                                <option value="COMPLETED">COMPLETED</option>
                                <option value="CANCELLED">CANCELLED</option>
                              </select>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {po.status}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {po.pdfFile ? (
                              <button
                                onClick={() => handleDownloadPdf(po.pdfFile.id, po.pdfFile.fileName)}
                                className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Download
                              </button>
                            ) : (
                              <button
                                onClick={() => handleGeneratePOPdf(po.id)}
                                disabled={generatingPdfId === po.id}
                                className="text-green-600 hover:text-green-800 font-medium disabled:opacity-50 flex items-center gap-1"
                              >
                                {generatingPdfId === po.id ? (
                                  <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Generate PDF
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                          {canCreatePO && (
                            <td className="px-4 py-4 text-sm">
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSavePO(po.id)}
                                    disabled={saving}
                                    className="text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingPOId(null)}
                                    disabled={saving}
                                    className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleEditPO(po)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          )}
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
                    {job.invoices.map((invoice: any) => {
                      const isEditing = editingInvoiceId === invoice.id;

                      return (
                        <div key={invoice.id} className={`p-4 rounded-lg border ${isEditing ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{invoice.invoiceNo}</p>
                              <p className="text-xs text-gray-500">
                                {invoice.fromCompany.name} → {invoice.toCompany?.name || 'Customer'}
                              </p>
                            </div>
                            <div className="text-right">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editInvoiceData.amount}
                                    onChange={(e) => setEditInvoiceData({ ...editInvoiceData, amount: e.target.value })}
                                    className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                  />
                                  <select
                                    value={editInvoiceData.status}
                                    onChange={(e) => setEditInvoiceData({ ...editInvoiceData, status: e.target.value })}
                                    className="w-32 px-2 py-1 border border-gray-300 rounded text-xs"
                                  >
                                    <option value="DRAFT">DRAFT</option>
                                    <option value="SENT">SENT</option>
                                    <option value="PAID">PAID</option>
                                    <option value="CANCELLED">CANCELLED</option>
                                  </select>
                                </div>
                              ) : (
                                <>
                                  <p className="text-lg font-bold text-gray-900">${Number(invoice.amount).toLocaleString()}</p>
                                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                    invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                    invoice.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {invoice.status}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
                            <div className="flex gap-2">
                              {invoice.pdfFile ? (
                                <button
                                  onClick={() => handleDownloadPdf(invoice.pdfFile.id, invoice.pdfFile.fileName)}
                                  className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Download PDF
                                </button>
                              ) : canEditJob && (
                                <button
                                  onClick={() => handleGenerateInvoicePdf(invoice.id)}
                                  disabled={generatingPdfId === invoice.id}
                                  className="text-green-600 hover:text-green-800 font-medium disabled:opacity-50 flex items-center gap-1"
                                >
                                  {generatingPdfId === invoice.id ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                      Generate PDF
                                    </>
                                  )}
                                </button>
                              )}
                              {canEditJob && (
                                isEditing ? (
                                  <>
                                    <button
                                      onClick={() => handleSaveInvoice(invoice.id)}
                                      disabled={saving}
                                      className="text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingInvoiceId(null)}
                                      disabled={saving}
                                      className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleEditInvoice(invoice)}
                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    Edit
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
