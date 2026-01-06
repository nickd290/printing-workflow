'use client';

import { useState, useEffect } from 'react';
import { jobsAPI, filesAPI, proofsAPI, invoicesAPI, purchaseOrdersAPI } from '@/lib/api-client';
import { useUser } from '@/contexts/UserContext';
import toast, { Toaster } from 'react-hot-toast';
import { PricingBreakdown } from '@/components/PricingBreakdown';
import { DeliveryUrgencyBadge } from '@/components/jobs/DeliveryUrgencyBadge';
import { POViewer } from '@/components/jobs/POViewer';
import { SampleShipmentCard } from '@/components/jobs/SampleShipmentCard';
import { FileUploadSection } from '@/components/customer/FileUploadSection';
import { ProofViewer } from '@/components/ProofViewer';
import { InvoiceAmountDialog } from '@/components/ui/InvoiceAmountDialog';
import { COMPANY_IDS } from '@printing-workflow/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface JobDetailModalProps {
  jobId: string;
  onClose: () => void;
}

export function JobDetailModal({ jobId, onClose }: JobDetailModalProps) {
  const { user, isCustomer, isBrokerAdmin, isBradfordAdmin } = useUser();
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'samples' | 'pos' | 'shipment'>('overview');
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofComments, setProofComments] = useState('');

  // Edit mode states
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [editFormData, setEditFormData] = useState({
    quantity: '',
    deliveryDate: '',
    packingSlipNotes: '',
    customerPONumber: '',
    status: '',
    customerTotal: '',
    paperChargedCPM: '',
  });
  const [skipNotification, setSkipNotification] = useState(false);
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

  // Individual invoice creation state
  const [creatingInvoiceType, setCreatingInvoiceType] = useState<string | null>(null);
  const [showCreateInvoiceDialog, setShowCreateInvoiceDialog] = useState(false);
  const [pendingInvoiceData, setPendingInvoiceData] = useState<{
    fromCompanyId: string;
    toCompanyId: string;
    invoiceType: string;
    suggestedAmount: number;
  } | null>(null);

  // File upload state
  const [showFileUpload, setShowFileUpload] = useState(false);

  // File viewer state
  const [viewingFile, setViewingFile] = useState<{id: string; fileName: string; mimeType: string} | null>(null);

  // Download all state
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Role-based permissions
  const canUploadProof = isBrokerAdmin || isBradfordAdmin;
  const canApproveProof = isCustomer || isBrokerAdmin;
  const canGenerateInvoice = isBrokerAdmin;
  const canSeeAllPOs = isBrokerAdmin;
  const canSeeBradfordPOs = isBradfordAdmin;
  const canEditJob = isCustomer || isBrokerAdmin; // Allow customers to edit jobs
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
        quantity: jobData.quantity?.toString() || '',
        deliveryDate: jobData.deliveryDate ? new Date(jobData.deliveryDate).toISOString().split('T')[0] : '',
        packingSlipNotes: jobData.packingSlipNotes || '',
        customerPONumber: jobData.customerPONumber || '',
        status: jobData.status || '',
        customerTotal: jobData.customerTotal?.toString() || '',
        paperChargedCPM: jobData.paperChargedCPM?.toString() || '',
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
      // Update job details with activity tracking
      await fetch(`${API_URL}/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: editFormData.quantity ? parseInt(editFormData.quantity) : undefined,
          deliveryDate: editFormData.deliveryDate || undefined,
          packingSlipNotes: editFormData.packingSlipNotes || undefined,
          customerPONumber: editFormData.customerPONumber || undefined,
          customerTotal: editFormData.customerTotal ? parseFloat(editFormData.customerTotal) : undefined,
          paperChargedCPM: editFormData.paperChargedCPM ? parseFloat(editFormData.paperChargedCPM) : undefined,
          // User context for activity tracking
          changedBy: user?.email || 'Unknown User',
          changedByRole: user?.role || 'CUSTOMER',
          // Skip notification if checkbox is checked
          skipNotification,
        }),
      });

      // Update status if changed
      if (editFormData.status !== job.status) {
        await fetch(`${API_URL}/api/jobs/${job.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: editFormData.status, skipNotification }),
        });
      }

      toast.success(skipNotification ? 'Job updated successfully!' : 'Job updated successfully! Notification emails sent.');
      setIsEditingJob(false);
      setSkipNotification(false); // Reset checkbox
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
    setSkipNotification(false); // Reset checkbox
    // Reset form to current job data
    if (job) {
      setEditFormData({
        quantity: job.quantity?.toString() || '',
        deliveryDate: job.deliveryDate ? new Date(job.deliveryDate).toISOString().split('T')[0] : '',
        packingSlipNotes: job.packingSlipNotes || '',
        customerPONumber: job.customerPONumber || '',
        status: job.status || '',
        customerTotal: job.customerTotal?.toString() || '',
        paperChargedCPM: job.paperChargedCPM?.toString() || '',
      });
    }
  };

  const handleStartEdit = () => {
    // Re-initialize form with current job data before entering edit mode
    if (job) {
      setEditFormData({
        quantity: job.quantity?.toString() || '',
        deliveryDate: job.deliveryDate ? new Date(job.deliveryDate).toISOString().split('T')[0] : '',
        packingSlipNotes: job.packingSlipNotes || '',
        customerPONumber: job.customerPONumber || '',
        status: job.status || '',
        customerTotal: job.customerTotal?.toString() || '',
        paperChargedCPM: job.paperChargedCPM?.toString() || '',
      });
    }
    setIsEditingJob(true);
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
    if (!job) return;

    try {
      await invoicesAPI.generate(jobId, {
        toCompanyId: job.customerId,
        fromCompanyId: 'impact-direct',
      });
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
    } catch (err: any) {
      console.error('Failed to generate invoice PDF:', err);

      // Display specific error message from the API
      const errorMessage = err?.message || err?.data?.error || 'Failed to generate invoice PDF';

      // Show a more detailed error in the UI
      toast.error(errorMessage, {
        id: 'gen-pdf',
        duration: 8000, // Show for 8 seconds so user can read it
      });
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handleCreateIndividualInvoice = (fromCompanyId: string, toCompanyId: string, invoiceType: string) => {
    if (!job) return;

    // Calculate suggested amount based on invoice type
    let suggestedAmount = 0;
    if (fromCompanyId === COMPANY_IDS.JD_GRAPHIC && toCompanyId === COMPANY_IDS.BRADFORD) {
      suggestedAmount = job.jdTotal || 0;
    } else if (fromCompanyId === COMPANY_IDS.BRADFORD && toCompanyId === COMPANY_IDS.IMPACT_DIRECT) {
      suggestedAmount = job.bradfordTotal || 0;
    } else if (fromCompanyId === COMPANY_IDS.IMPACT_DIRECT) {
      suggestedAmount = job.customerTotal || 0;
    }

    // Show dialog with suggested amount
    setPendingInvoiceData({
      fromCompanyId,
      toCompanyId,
      invoiceType,
      suggestedAmount,
    });
    setShowCreateInvoiceDialog(true);
  };

  const handleConfirmInvoiceCreation = async (amount: number) => {
    if (!job || !pendingInvoiceData) return;

    try {
      setCreatingInvoiceType(pendingInvoiceData.invoiceType);
      toast.loading(`Creating ${pendingInvoiceData.invoiceType} invoice...`, { id: 'create-invoice' });

      // Create invoice with specified amount
      await invoicesAPI.generate(jobId, {
        fromCompanyId: pendingInvoiceData.fromCompanyId,
        toCompanyId: pendingInvoiceData.toCompanyId
      });

      // Note: If the API doesn't support setting amount during creation,
      // we'll need to update it after creation

      await loadJob();
      toast.success(`${pendingInvoiceData.invoiceType} invoice created successfully!`, { id: 'create-invoice' });
      setShowCreateInvoiceDialog(false);
      setPendingInvoiceData(null);
    } catch (err: any) {
      console.error('Failed to create invoice:', err);
      const errorMessage = err?.message || err?.data?.error || 'Failed to create invoice';
      toast.error(errorMessage, { id: 'create-invoice', duration: 8000 });
    } finally {
      setCreatingInvoiceType(null);
    }
  };

  const handleCancelInvoiceCreation = () => {
    setShowCreateInvoiceDialog(false);
    setPendingInvoiceData(null);
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

  const downloadAllFiles = async () => {
    if (allFiles.length === 0) {
      toast.error('No files to download');
      return;
    }

    setDownloadingAll(true);
    toast.loading(`Downloading ${allFiles.length} file(s)...`, { id: 'download-all' });

    try {
      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        await downloadFile(file.id, file.fileName);
        // Add small delay to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));
        toast.loading(`Downloaded ${i + 1} of ${allFiles.length}...`, { id: 'download-all' });
      }
      toast.success(`Successfully downloaded ${allFiles.length} file(s)!`, { id: 'download-all' });
    } catch (error) {
      console.error('Failed to download all files:', error);
      toast.error('Failed to download all files', { id: 'download-all' });
    } finally {
      setDownloadingAll(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('zip')) return '📦';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const dataFiles = job.files?.filter((f: any) => f.kind === 'DATA_FILE') || [];
  const poFiles = job.files?.filter((f: any) => f.kind === 'PO_PDF') || [];

  // All downloadable files
  const allFiles = [...artworkFiles, ...dataFiles, ...poFiles];

  // Tabs - customers see samples tab, admins see PO tab
  const tabs = isCustomer
    ? [
        { id: 'overview', label: 'Job Details' },
        { id: 'files', label: 'Files & Proofs' },
        { id: 'samples', label: 'Samples' },
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
                onClick={handleStartEdit}
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
                    {job.quantity && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Quantity</label>
                        <p className="text-lg font-semibold text-gray-900">{job.quantity.toLocaleString()}</p>
                      </div>
                    )}
                    {job.deliveryDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Delivery Date</label>
                        <p className="text-lg font-semibold text-gray-900 mb-2">
                          {new Date(job.deliveryDate).toLocaleDateString()}
                        </p>
                        <DeliveryUrgencyBadge
                          deliveryDate={job.deliveryDate}
                          completedAt={job.completedAt}
                        />
                      </div>
                    )}
                  </div>

                  {/* PO Viewer */}
                  {(job.customerPONumber || poFiles.length > 0) && (
                    <POViewer
                      customerPONumber={job.customerPONumber}
                      customerPOFile={job.customerPOFile}
                      poFiles={poFiles}
                      onDownload={downloadFile}
                    />
                  )}

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

                  {/* Key Pricing Fields */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-purple-600 rounded-full"></div>
                      Pricing Details
                    </h3>
                    <div className="bg-purple-50 rounded-lg p-5 border border-purple-200">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-medium text-gray-600 block mb-1">Customer Total</label>
                          <p className="text-2xl font-bold text-purple-900">
                            ${Number(job.customerTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Total amount charged to customer</p>
                        </div>
                        {job.paperChargedCPM && (
                          <div>
                            <label className="text-sm font-medium text-gray-600 block mb-1">Bradford Paper CPM</label>
                            <p className="text-2xl font-bold text-purple-900">
                              ${Number(job.paperChargedCPM || 0).toFixed(2)}/M
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Paper cost per thousand pieces</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

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
                      {/* Skip notification checkbox */}
                      <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipNotification}
                          onChange={(e) => setSkipNotification(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">Skip notification emails for this update</span>
                      </label>
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

                    {/* Editable: Quantity */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Quantity</label>
                      <input
                        type="number"
                        value={editFormData.quantity}
                        onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="50000"
                        min="1"
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

                  {/* Pricing Section - Editable */}
                  <div className="border-t border-gray-200 pt-6 mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>
                    <div className="grid grid-cols-2 gap-6">
                      {/* Editable: Customer Total */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Customer Total ($)
                        </label>
                        <input
                          type="number"
                          value={editFormData.customerTotal}
                          onChange={(e) => setEditFormData({ ...editFormData, customerTotal: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                        />
                        <p className="text-xs text-gray-500 mt-1">Total amount charged to customer</p>
                      </div>

                      {/* Editable: Bradford Paper CPM */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Bradford Paper CPM ($/M)
                        </label>
                        <input
                          type="number"
                          value={editFormData.paperChargedCPM}
                          onChange={(e) => setEditFormData({ ...editFormData, paperChargedCPM: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                        />
                        <p className="text-xs text-gray-500 mt-1">Paper cost per thousand pieces</p>
                      </div>
                    </div>
                  </div>

                  {/* Editable: Packing Slip Notes */}
                  <div className="mt-6">
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
              {/* Header with Download All button */}
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Files & Documents</h3>
                {allFiles.length > 0 && (
                  <button
                    onClick={downloadAllFiles}
                    disabled={downloadingAll}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {downloadingAll ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download All ({allFiles.length})
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* File Upload Section */}
              {isCustomer && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                  <FileUploadSection
                    jobId={job.id}
                    jobNo={job.jobNo}
                    requiredArtworkCount={job.requiredArtworkCount || 0}
                    requiredDataFileCount={job.requiredDataFileCount || 0}
                    onFilesUpdated={() => {
                      loadJob();
                    }}
                  />
                </div>
              )}

              {/* Artwork Files */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span>🎨</span>
                  Artwork Files
                  {artworkFiles.length > 0 && <span className="text-sm text-gray-500">({artworkFiles.length})</span>}
                </h3>
                {artworkFiles.length > 0 ? (
                  <div className="space-y-2">
                    {artworkFiles.map((file: any) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setViewingFile({ id: file.id, fileName: file.fileName, mimeType: file.mimeType })}
                            className="px-3 py-1 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded"
                          >
                            👁️ Preview
                          </button>
                          <button
                            onClick={() => downloadFile(file.id, file.fileName)}
                            className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                          >
                            ⬇️ Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-lg">No artwork files uploaded yet</p>
                )}
              </div>

              {/* Data Files */}
              {(dataFiles.length > 0 || job.requiredDataFileCount > 0) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span>📊</span>
                    Data Files
                    {dataFiles.length > 0 && <span className="text-sm text-gray-500">({dataFiles.length})</span>}
                  </h3>
                  {dataFiles.length > 0 ? (
                    <div className="space-y-2">
                      {dataFiles.map((file: any) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setViewingFile({ id: file.id, fileName: file.fileName, mimeType: file.mimeType })}
                              className="px-3 py-1 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded"
                            >
                              👁️ Preview
                            </button>
                            <button
                              onClick={() => downloadFile(file.id, file.fileName)}
                              className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            >
                              ⬇️ Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-lg">No data files uploaded yet</p>
                  )}
                </div>
              )}

              {/* PO Files */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span>📄</span>
                  Purchase Order Files
                  {poFiles.length > 0 && <span className="text-sm text-gray-500">({poFiles.length})</span>}
                </h3>
                {poFiles.length > 0 ? (
                  <div className="space-y-2">
                    {poFiles.map((file: any) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setViewingFile({ id: file.id, fileName: file.fileName, mimeType: file.mimeType })}
                            className="px-3 py-1 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded"
                          >
                            👁️ Preview
                          </button>
                          <button
                            onClick={() => downloadFile(file.id, file.fileName)}
                            className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                          >
                            ⬇️ Download
                          </button>
                        </div>
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
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span>✅</span>
                    Proofs
                    {job.proofs && job.proofs.length > 0 && <span className="text-sm text-gray-500">({job.proofs.length})</span>}
                  </h3>
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
                            {po.originCompany.name} → {po.targetCompany?.name || po.targetVendor?.name || 'Unknown'}
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

          {/* Samples Tab - Customer only */}
          {activeTab === 'samples' && (
            <div>
              <SampleShipmentCard
                sampleShipments={job.sampleShipments || []}
                onRequestSample={() => {
                  toast.success('Sample request submitted! Our team will contact you shortly.');
                  // TODO: Implement sample request API call
                }}
              />
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoices</h3>
                {(() => {
                  // Helper function to find invoice by company IDs
                  const findInvoice = (fromId: string, toId: string) => {
                    return (job.invoices || []).find((inv: any) =>
                      inv.fromCompany?.id === fromId && inv.toCompany?.id === toId
                    );
                  };

                  // Define invoice types with company IDs
                  const invoiceTypes = [
                    {
                      id: 'jd-bradford',
                      label: 'JD Graphic → Bradford',
                      fromCompanyId: COMPANY_IDS.JD_GRAPHIC,
                      toCompanyId: COMPANY_IDS.BRADFORD,
                      invoice: findInvoice(COMPANY_IDS.JD_GRAPHIC, COMPANY_IDS.BRADFORD),
                    },
                    {
                      id: 'bradford-impact',
                      label: 'Bradford → Impact Direct',
                      fromCompanyId: COMPANY_IDS.BRADFORD,
                      toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
                      invoice: findInvoice(COMPANY_IDS.BRADFORD, COMPANY_IDS.IMPACT_DIRECT),
                    },
                    {
                      id: 'impact-customer',
                      label: 'Impact Direct → Customer',
                      fromCompanyId: COMPANY_IDS.IMPACT_DIRECT,
                      toCompanyId: job.customerId,
                      invoice: findInvoice(COMPANY_IDS.IMPACT_DIRECT, job.customerId),
                    },
                  ];

                  // Filter invoice types based on user role
                  const visibleInvoiceTypes = isCustomer
                    ? invoiceTypes.filter(type => type.id === 'impact-customer')
                    : invoiceTypes;

                  return (
                    <div className="space-y-3">
                      {visibleInvoiceTypes.map((type) => {
                        const invoice = type.invoice;
                        const isEditing = invoice && editingInvoiceId === invoice.id;
                        const isCreating = creatingInvoiceType === type.id;
                        const isGeneratingPdf = invoice && generatingPdfId === invoice.id;

                        return (
                          <div key={type.id} className={`p-4 rounded-lg border ${
                            isEditing ? 'bg-blue-50 border-blue-300' :
                            invoice ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300 border-dashed'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="text-sm font-medium text-gray-700">{type.label}</p>
                                {invoice ? (
                                  <p className="text-xs font-semibold text-gray-900 mt-1">{invoice.invoiceNo}</p>
                                ) : (
                                  <p className="text-xs text-gray-500 mt-1">Not Created</p>
                                )}
                              </div>
                              <div className="text-right">
                                {invoice && isEditing ? (
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
                                ) : invoice ? (
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
                                ) : (
                                  <span className="text-sm text-gray-400">—</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">
                                {invoice ? new Date(invoice.createdAt).toLocaleDateString() : ''}
                              </span>
                              <div className="flex gap-2">
                                {!invoice && canGenerateInvoice && (
                                  <button
                                    onClick={() => handleCreateIndividualInvoice(type.fromCompanyId, type.toCompanyId, type.label)}
                                    disabled={isCreating}
                                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                  >
                                    {isCreating ? (
                                      <>
                                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Creating...
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Create Invoice
                                      </>
                                    )}
                                  </button>
                                )}
                                {invoice && invoice.pdfFile && (
                                  <>
                                    <button
                                      onClick={() => handleDownloadPdf(invoice.pdfFile.id, invoice.pdfFile.fileName)}
                                      className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      Download
                                    </button>
                                    {canEditJob && (
                                      <button
                                        onClick={() => handleGenerateInvoicePdf(invoice.id)}
                                        disabled={isGeneratingPdf}
                                        className="text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50 flex items-center gap-1"
                                      >
                                        {isGeneratingPdf ? (
                                          <>
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Regenerating...
                                          </>
                                        ) : (
                                          <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Regenerate
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </>
                                )}
                                {invoice && !invoice.pdfFile && canEditJob && (
                                  <button
                                    onClick={() => handleGenerateInvoicePdf(invoice.id)}
                                    disabled={isGeneratingPdf}
                                    className="text-green-600 hover:text-green-800 font-medium disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isGeneratingPdf ? (
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
                                {invoice && canEditJob && (
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
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={() => setViewingFile(null)}>
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl m-4" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">{viewingFile.fileName}</h3>
              <button
                onClick={() => setViewingFile(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-hidden">
              <ProofViewer
                fileUrl={`${API_URL}/api/files/${viewingFile.id}/download`}
                fileName={viewingFile.fileName}
                mimeType={viewingFile.mimeType}
              />
            </div>
          </div>
        </div>
      )}

      {/* Invoice Amount Confirmation Dialog */}
      <InvoiceAmountDialog
        isOpen={showCreateInvoiceDialog}
        onClose={handleCancelInvoiceCreation}
        onConfirm={handleConfirmInvoiceCreation}
        title={`Create Invoice - ${pendingInvoiceData?.invoiceType || ''}`}
        suggestedAmount={pendingInvoiceData?.suggestedAmount || 0}
        isLoading={creatingInvoiceType !== null}
      />
    </div>
  );
}
