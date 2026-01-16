'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Navigation } from '@/components/Navigation';
import { FileManagementSection } from '@/components/jobs/FileManagementSection';
import { JobEditModal } from '@/components/jobs/JobEditModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
interface JobSpecs {
  // Basic Print Specs
  size?: string;
  quantity?: number;
  paper?: string;
  paperType?: string;
  colors?: string;
  sides?: string;
  finishing?: string[];

  // Print Production
  folds?: string;
  perforations?: string;
  dieCut?: string;
  bleed?: string;
  proofType?: string;

  // Booklet-specific
  coverType?: 'SELF_COVER' | 'PLUS_COVER';
  coverPaperType?: string;
  pageCount?: number;
  bindingType?: string;

  // Mailing
  mailing?: {
    mailFormat?: 'SELF_MAILER' | 'POSTCARD' | 'ENVELOPE' | 'LETTER';
    mailClass?: string;
    listCount?: number;
    inkjetRequired?: boolean;
    tabbing?: boolean;
  };
  versions?: string;
  components?: string;
  matchType?: '2-WAY' | '3-WAY';

  // Shipping
  shipToName?: string;
  shipToAddress?: string;
  shipToCity?: string;
  shipToState?: string;
  shipToZip?: string;
  shipVia?: string;

  // Instructions
  specialInstructions?: string;
  artworkInstructions?: string;
  packingInstructions?: string;
  labelingInstructions?: string;

  // Any other specs
  [key: string]: any;
}

interface Job {
  id: string;
  jobNo: string;
  customer: { id: string; name: string; email: string };
  customerTotal: number;
  status: string;
  specs: JobSpecs;
  deliveryDate?: string;
  mailDate?: string;
  inHomesDate?: string;
  packingSlipNotes?: string;
  customerPONumber?: string;
  customerPOFile?: string;
  createdAt: string;
  completedAt?: string;

  // Production Info
  routingType?: 'BRADFORD_JD' | 'THIRD_PARTY_VENDOR';
  jobType?: 'FLAT' | 'FOLDED' | 'BOOKLET_SELF_COVER' | 'BOOKLET_PLUS_COVER';
  sizeName?: string;
  quantity?: number;
  paperType?: string;

  // Vendor Info
  vendor?: { id: string; name: string };
  vendorAmount?: number;
  vendorShipToName?: string;
  vendorShipToAddress?: string;
  vendorShipToCity?: string;
  vendorShipToState?: string;
  vendorShipToZip?: string;
  vendorSpecialInstructions?: string;

  // Paper/Pricing
  paperWeightTotal?: number;
  paperCostTotal?: number;
  bradfordTotal?: number;
  jdTotal?: number;
  impactMargin?: number;

  // Relations
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
  poNumber?: string;
  referencePONumber?: string;
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
  issuedAt?: string;
  paidAt?: string;
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

  // Job edit modal
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const loadJob = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`);
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
      toast.error('Please upload a PDF file');
      return;
    }

    setUploadingPO(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('jobId', jobId);
      formData.append('kind', 'PO_PDF');

      const response = await fetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      await loadJob();
      toast.success('PO uploaded successfully!');
    } catch (err) {
      console.error('Failed to upload PO:', err);
      toast.error('Failed to upload PO');
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

        const response = await fetch(`${API_URL}/api/files/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');
      }
      await loadJob();
      toast.success(`${files.length} file(s) uploaded successfully!`);
    } catch (err) {
      console.error('Failed to upload artwork:', err);
      toast.error('Failed to upload artwork');
    } finally {
      setUploadingArtwork(false);
      e.target.value = '';
    }
  };

  const handleProofUpload = async () => {
    if (!proofFile) {
      toast.error('Please select a proof file');
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

      const response = await fetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      await loadJob();
      setProofFile(null);
      setProofNotes('');
      setProofComments('');
      toast.success('Proof uploaded! Email sent to customer.');
    } catch (err) {
      console.error('Failed to upload proof:', err);
      toast.error('Failed to upload proof');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleApproveProof = async (proofId: string) => {
    if (!confirm('Are you sure you want to approve this proof?')) return;

    try {
      const response = await fetch(`${API_URL}/api/proofs/${proofId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });

      if (!response.ok) throw new Error('Approval failed');
      await loadJob();
      toast.success('Proof approved!');
    } catch (err) {
      console.error('Failed to approve proof:', err);
      toast.error('Failed to approve proof');
    }
  };

  const handleRequestChanges = async (proofId: string) => {
    const comments = prompt('Please describe the changes needed:');
    if (!comments) return;

    try {
      const response = await fetch(`${API_URL}/api/proofs/${proofId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, comments }),
      });

      if (!response.ok) throw new Error('Request failed');
      await loadJob();
      toast.success('Revision request sent');
    } catch (err) {
      console.error('Failed to request changes:', err);
      toast.error('Failed to request changes');
    }
  };

  const handleUpdateDelivery = async () => {
    try {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : null,
          packingSlipNotes,
        }),
      });

      if (!response.ok) throw new Error('Update failed');
      await loadJob();
      toast.success('Delivery information updated!');
    } catch (err) {
      console.error('Failed to update delivery:', err);
      toast.error('Failed to update delivery information');
    }
  };

  const handleAddSampleShipment = async () => {
    try {
      for (const recipient of sampleRecipients) {
        if (!recipient.name || !recipient.email) continue;

        const response = await fetch(`${API_URL}/api/jobs/${jobId}/sample-shipments`, {
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
      toast.success('Sample shipment(s) added!');
    } catch (err) {
      console.error('Failed to add sample shipment:', err);
      toast.error('Failed to add sample shipment');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Change job status to ${newStatus.replace(/_/g, ' ')}?`)) return;

    try {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');
      await loadJob();
      toast.success(`Job status updated to ${newStatus.replace(/_/g, ' ')}`);
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update job status');
    }
  };

  const handleCompleteAndGenerateInvoices = async () => {
    if (!confirm('Complete this job and generate all invoices?\n\nThis will create:\n• JD → Bradford invoice\n• Bradford → Impact invoice\n• Impact → Customer invoice\n\nAnd mark the job as COMPLETED.')) {
      return;
    }

    try {
      toast.loading('Generating invoices...', { id: 'complete-job' });

      const response = await fetch(`${API_URL}/api/jobs/${jobId}/complete-and-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete job');
      }

      await loadJob();

      toast.success(
        `Job completed! Generated invoices:\n• ${data.invoices.jdToBradford.invoiceNo}\n• ${data.invoices.bradfordToImpact.invoiceNo}\n• ${data.invoices.impactToCustomer.invoiceNo}`,
        { id: 'complete-job', duration: 6000 }
      );
    } catch (err: any) {
      console.error('Failed to complete job:', err);
      toast.error(err.message || 'Failed to complete job and generate invoices', { id: 'complete-job' });
    }
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const statusFlow: Record<string, string> = {
      'PENDING': 'IN_PRODUCTION',
      'IN_PRODUCTION': 'READY_FOR_PROOF',
      'READY_FOR_PROOF': 'PROOF_APPROVED',
      'PROOF_APPROVED': 'COMPLETED',
    };
    return statusFlow[currentStatus] || null;
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
      toast.success('File downloaded successfully');
    } catch (err) {
      console.error('Failed to download file:', err);
      toast.error('Failed to download file');
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
      case 'in_production':
        return 'bg-blue-500/10 text-blue-700 ring-blue-500/20';
      case 'ready_for_proof':
        return 'bg-purple-500/10 text-purple-700 ring-purple-500/20';
      case 'proof_approved':
        return 'bg-indigo-500/10 text-indigo-700 ring-indigo-500/20';
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
                {isAdmin && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Job
                  </button>
                )}
                {isAdmin && getNextStatus(job.status) && job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleStatusChange(getNextStatus(job.status)!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Move to {getNextStatus(job.status)!.replace(/_/g, ' ')}
                  </button>
                )}
                {isAdmin && job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
                  <button
                    onClick={handleCompleteAndGenerateInvoices}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Complete & Generate Invoices
                  </button>
                )}
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

        {/* PO# Chain Visualization */}
        {job.customerPONumber && (
          <div className="mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-200 overflow-hidden">
            <div className="border-b border-blue-200 bg-white/50 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Purchase Order Chain
              </h2>
            </div>

            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Customer PO */}
                <div className="flex-1 w-full md:w-auto">
                  <div className="bg-white rounded-lg border-2 border-blue-400 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Customer PO#</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900 mb-1">{job.customerPONumber}</p>
                    <p className="text-xs text-slate-500">Master Reference</p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 text-blue-400 rotate-90 md:rotate-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* Impact → Bradford PO */}
                <div className="flex-1 w-full md:w-auto">
                  {job.purchaseOrders && job.purchaseOrders.find(po => po.originCompany.name.includes('Impact') && po.targetCompany.name.includes('Bradford')) ? (
                    <div className="bg-white rounded-lg border-2 border-indigo-400 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Impact → Bradford</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 mb-1">
                        {job.purchaseOrders.find(po => po.originCompany.name.includes('Impact') && po.targetCompany.name.includes('Bradford'))?.poNumber || 'N/A'}
                      </p>
                      <p className="text-xs text-slate-500">Auto-generated</p>
                    </div>
                  ) : (
                    <div className="bg-white/50 rounded-lg border-2 border-dashed border-slate-300 p-4">
                      <p className="text-sm text-slate-500 text-center">No Impact→Bradford PO yet</p>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 text-blue-400 rotate-90 md:rotate-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* Bradford → JD PO */}
                <div className="flex-1 w-full md:w-auto">
                  {job.purchaseOrders && job.purchaseOrders.find(po => po.originCompany.name.includes('Bradford') && po.targetCompany.name.includes('JD')) ? (
                    <div className="bg-white rounded-lg border-2 border-purple-400 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Bradford → JD</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 mb-1">
                        {job.purchaseOrders.find(po => po.originCompany.name.includes('Bradford') && po.targetCompany.name.includes('JD'))?.poNumber || 'N/A'}
                      </p>
                      <p className="text-xs text-slate-500">From uploaded PDF</p>
                    </div>
                  ) : (
                    <div className="bg-white/50 rounded-lg border-2 border-dashed border-slate-300 p-4">
                      <p className="text-sm text-slate-500 text-center">Awaiting Bradford PO upload</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reference note */}
              <div className="mt-4 pt-4 border-t border-blue-200">
                <p className="text-xs text-slate-600 text-center">
                  All purchase orders reference Customer PO# <span className="font-semibold text-blue-700">{job.customerPONumber}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Customer File Upload Section */}
        {!isAdmin && (
          <div className="mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Job Files & Submission</h2>
                <p className="text-sm text-slate-600 mt-1">Upload required files and submit your job for production</p>
              </div>
              <div className="p-6">
                <FileManagementSection
                  jobId={jobId}
                  onFilesUpdated={loadJob}
                />
              </div>
            </div>
          </div>
        )}

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
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">Purchase Orders</h2>
                    {job.bradfordWaivesPaperMargin && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                        Bradford Waived Paper Margin (50/50 Split)
                      </span>
                    )}
                    {job.jdSuppliesPaper && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        JD Supplies Paper (10/10 Split)
                      </span>
                    )}
                  </div>
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

            {/* Production Info Badge */}
            {(job.routingType || job.jobType || job.vendor) && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
                <div className="border-b border-indigo-200 bg-white/50 px-6 py-3">
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Production Info
                  </h2>
                </div>
                <div className="p-4 space-y-2">
                  {job.routingType && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Pathway</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        job.routingType === 'BRADFORD_JD'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {job.routingType === 'BRADFORD_JD' ? 'Bradford → JD' : '3rd Party Vendor'}
                      </span>
                    </div>
                  )}
                  {job.jobType && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Job Type</span>
                      <span className="text-xs font-medium text-slate-900">
                        {job.jobType.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                  {job.vendor && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Vendor</span>
                      <span className="text-xs font-medium text-slate-900">{job.vendor.name}</span>
                    </div>
                  )}
                  {job.paperType && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Paper</span>
                      <span className="text-xs font-medium text-slate-900">{job.paperType}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comprehensive Specifications */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Job Specifications</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {/* Basic Print Specs */}
                {(job.specs?.size || job.sizeName || job.quantity || job.specs?.quantity || job.specs?.paper || job.specs?.colors || job.specs?.sides) && (
                  <div className="p-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Print Basics</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {(job.specs?.size || job.sizeName) && (
                        <>
                          <dt className="text-xs text-slate-500">Size</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs?.size || job.sizeName}</dd>
                        </>
                      )}
                      {(job.specs?.quantity || job.quantity) && (
                        <>
                          <dt className="text-xs text-slate-500">Quantity</dt>
                          <dd className="text-sm font-medium text-slate-900">{(job.specs?.quantity || job.quantity)?.toLocaleString()}</dd>
                        </>
                      )}
                      {job.specs?.paper && (
                        <>
                          <dt className="text-xs text-slate-500">Paper</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.paper}</dd>
                        </>
                      )}
                      {job.specs?.colors && (
                        <>
                          <dt className="text-xs text-slate-500">Colors</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.colors}</dd>
                        </>
                      )}
                      {job.specs?.sides && (
                        <>
                          <dt className="text-xs text-slate-500">Sides</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.sides}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                )}

                {/* Print Production Details */}
                {(job.specs?.folds || job.specs?.perforations || job.specs?.dieCut || job.specs?.bleed || job.specs?.proofType || job.specs?.finishing) && (
                  <div className="p-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Production Details</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {job.specs?.folds && (
                        <>
                          <dt className="text-xs text-slate-500">Folds</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.folds}</dd>
                        </>
                      )}
                      {job.specs?.perforations && (
                        <>
                          <dt className="text-xs text-slate-500">Perforations</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.perforations}</dd>
                        </>
                      )}
                      {job.specs?.dieCut && (
                        <>
                          <dt className="text-xs text-slate-500">Die Cut</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.dieCut}</dd>
                        </>
                      )}
                      {job.specs?.bleed && (
                        <>
                          <dt className="text-xs text-slate-500">Bleed</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.bleed}</dd>
                        </>
                      )}
                      {job.specs?.proofType && (
                        <>
                          <dt className="text-xs text-slate-500">Proof Type</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.proofType}</dd>
                        </>
                      )}
                      {job.specs?.finishing && (
                        <>
                          <dt className="text-xs text-slate-500">Finishing</dt>
                          <dd className="text-sm font-medium text-slate-900">
                            {Array.isArray(job.specs.finishing) ? job.specs.finishing.join(', ') : job.specs.finishing}
                          </dd>
                        </>
                      )}
                    </dl>
                  </div>
                )}

                {/* Booklet Specs */}
                {(job.specs?.coverType || job.specs?.coverPaperType || job.specs?.pageCount || job.specs?.bindingType) && (
                  <div className="p-4 bg-amber-50/50">
                    <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">Booklet Details</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {job.specs?.coverType && (
                        <>
                          <dt className="text-xs text-slate-500">Cover Type</dt>
                          <dd className="text-sm font-medium text-slate-900">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              job.specs.coverType === 'SELF_COVER'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {job.specs.coverType === 'SELF_COVER' ? 'Self Cover' : 'Plus Cover'}
                            </span>
                          </dd>
                        </>
                      )}
                      {job.specs?.coverPaperType && (
                        <>
                          <dt className="text-xs text-slate-500">Cover Paper</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.coverPaperType}</dd>
                        </>
                      )}
                      {job.specs?.pageCount && (
                        <>
                          <dt className="text-xs text-slate-500">Page Count</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.pageCount}</dd>
                        </>
                      )}
                      {job.specs?.bindingType && (
                        <>
                          <dt className="text-xs text-slate-500">Binding</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.bindingType}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                )}

                {/* Mailing Specs */}
                {(job.specs?.mailing || job.specs?.versions || job.specs?.components || job.specs?.matchType) && (
                  <div className="p-4 bg-blue-50/50">
                    <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Mailing Details</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {job.specs?.mailing?.mailFormat && (
                        <>
                          <dt className="text-xs text-slate-500">Mail Format</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.mailing.mailFormat.replace(/_/g, ' ')}</dd>
                        </>
                      )}
                      {job.specs?.mailing?.mailClass && (
                        <>
                          <dt className="text-xs text-slate-500">Mail Class</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.mailing.mailClass}</dd>
                        </>
                      )}
                      {job.specs?.mailing?.listCount && (
                        <>
                          <dt className="text-xs text-slate-500">List Count</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.mailing.listCount.toLocaleString()}</dd>
                        </>
                      )}
                      {job.specs?.matchType && (
                        <>
                          <dt className="text-xs text-slate-500">Match Type</dt>
                          <dd className="text-sm font-medium text-slate-900">
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-semibold">
                              {job.specs.matchType}
                            </span>
                          </dd>
                        </>
                      )}
                      {job.specs?.versions && (
                        <>
                          <dt className="text-xs text-slate-500">Versions</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.versions}</dd>
                        </>
                      )}
                      {job.specs?.components && (
                        <>
                          <dt className="text-xs text-slate-500">Components</dt>
                          <dd className="text-sm font-medium text-slate-900">{job.specs.components}</dd>
                        </>
                      )}
                      {job.specs?.mailing?.inkjetRequired && (
                        <>
                          <dt className="text-xs text-slate-500">Inkjet</dt>
                          <dd className="text-sm font-medium text-emerald-600">Required</dd>
                        </>
                      )}
                      {job.specs?.mailing?.tabbing && (
                        <>
                          <dt className="text-xs text-slate-500">Tabbing</dt>
                          <dd className="text-sm font-medium text-emerald-600">Yes</dd>
                        </>
                      )}
                    </dl>
                  </div>
                )}

                {/* Other Specs (catch-all for any unlisted fields) */}
                {job.specs && (() => {
                  const knownKeys = [
                    'size', 'quantity', 'paper', 'paperType', 'colors', 'sides', 'finishing',
                    'folds', 'perforations', 'dieCut', 'bleed', 'proofType',
                    'coverType', 'coverPaperType', 'pageCount', 'bindingType',
                    'mailing', 'versions', 'components', 'matchType',
                    'shipToName', 'shipToAddress', 'shipToCity', 'shipToState', 'shipToZip', 'shipVia',
                    'specialInstructions', 'artworkInstructions', 'packingInstructions', 'labelingInstructions'
                  ];
                  const otherSpecs = Object.entries(job.specs).filter(
                    ([key]) => !knownKeys.includes(key) && typeof job.specs[key] !== 'object'
                  );
                  if (otherSpecs.length === 0) return null;
                  return (
                    <div className="p-4">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Additional Specs</h3>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {otherSpecs.map(([key, value]) => (
                          <div key={key} className="contents">
                            <dt className="text-xs text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                            <dd className="text-sm font-medium text-slate-900">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })()}

                {/* Empty state if no specs */}
                {(!job.specs || Object.keys(job.specs).length === 0) && !job.sizeName && !job.quantity && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-500">No specifications provided</p>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping & Instructions */}
            {(job.specs?.shipToName || job.specs?.shipToAddress || job.specs?.shipVia ||
              job.specs?.specialInstructions || job.specs?.artworkInstructions ||
              job.specs?.packingInstructions || job.specs?.labelingInstructions ||
              job.vendorShipToName || job.vendorSpecialInstructions) && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
                    </svg>
                    Shipping & Instructions
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  {/* Ship To Address */}
                  {(job.specs?.shipToName || job.specs?.shipToAddress || job.vendorShipToName) && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Ship To</p>
                      <p className="text-sm font-medium text-slate-900">
                        {job.specs?.shipToName || job.vendorShipToName}
                      </p>
                      {(job.specs?.shipToAddress || job.vendorShipToAddress) && (
                        <p className="text-sm text-slate-600">
                          {job.specs?.shipToAddress || job.vendorShipToAddress}
                        </p>
                      )}
                      {(job.specs?.shipToCity || job.vendorShipToCity) && (
                        <p className="text-sm text-slate-600">
                          {job.specs?.shipToCity || job.vendorShipToCity}
                          {(job.specs?.shipToState || job.vendorShipToState) && `, ${job.specs?.shipToState || job.vendorShipToState}`}
                          {(job.specs?.shipToZip || job.vendorShipToZip) && ` ${job.specs?.shipToZip || job.vendorShipToZip}`}
                        </p>
                      )}
                      {job.specs?.shipVia && (
                        <p className="text-xs text-slate-500 mt-2">
                          <span className="font-medium">Ship Via:</span> {job.specs.shipVia}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Instructions */}
                  {job.specs?.specialInstructions && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Special Instructions</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.specs.specialInstructions}</p>
                    </div>
                  )}
                  {job.vendorSpecialInstructions && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Vendor Instructions</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.vendorSpecialInstructions}</p>
                    </div>
                  )}
                  {job.specs?.artworkInstructions && (
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                      <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Artwork Instructions</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.specs.artworkInstructions}</p>
                    </div>
                  )}
                  {job.specs?.packingInstructions && (
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Packing Instructions</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.specs.packingInstructions}</p>
                    </div>
                  )}
                  {job.specs?.labelingInstructions && (
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">Labeling Instructions</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.specs.labelingInstructions}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Tracking */}
            {(job.invoices && job.invoices.length > 0) && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Payment Status
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  {job.invoices?.map((invoice) => {
                    const isPaid = !!invoice.paidAt;
                    return (
                      <div key={invoice.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{invoice.invoiceNo}</p>
                          <p className="text-xs text-slate-500">
                            {invoice.fromCompany.name} → {invoice.toCompany.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">${Number(invoice.amount).toLocaleString()}</p>
                          {isPaid ? (
                            <p className="text-xs text-emerald-600 font-medium">
                              Paid {new Date(invoice.paidAt!).toLocaleDateString()}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600 font-medium">Unpaid</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
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

      {showEditModal && (
        <JobEditModal
          job={job}
          onClose={() => setShowEditModal(false)}
          onSave={async (updates) => {
            try {
              const response = await fetch(`/api/jobs/${job.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...updates,
                  changedBy: 'Admin User', // TODO: Get from auth context
                  changedByRole: 'ADMIN',
                }),
              });

              if (!response.ok) {
                throw new Error('Failed to update job');
              }

              // Refresh the page to show updated data
              window.location.reload();
            } catch (error) {
              console.error('Error updating job:', error);
              alert('Failed to update job. Please try again.');
            }
          }}
        />
      )}
    </div>
  );
}
