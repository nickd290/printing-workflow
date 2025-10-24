'use client';

import { BradfordSidebar } from '@/components/BradfordSidebar';
import { JobsTable } from '@/components/JobsTable';
import { JobDetailModal } from '@/components/JobDetailModal';
import { BradfordDashboard } from '@/components/dashboards/BradfordDashboard';
import { ImpactDirectDashboard } from '@/components/dashboards/ImpactDirectDashboard';
import { useEffect, useState, useMemo } from 'react';
import { jobsAPI } from '@/lib/api-client';
import { useUser } from '@/contexts/UserContext';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DashboardPage() {
  const { user, isCustomer, isBrokerAdmin, isBradfordAdmin } = useUser();
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedPOFile, setUploadedPOFile] = useState<File | null>(null);
  const [parsingPO, setParsingPO] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [entryMode, setEntryMode] = useState<'upload' | 'manual'>('upload');

  // Form field states - always defined to avoid controlled/uncontrolled warnings
  const [formData, setFormData] = useState<{
    description: string;
    paper: string;
    flatSize: string;
    foldedSize: string;
    colors: string;
    finishing: string;
    total: string;
    poNumber: string;
    deliveryDate: string;
    samples: string;
  }>({
    description: '',
    paper: '',
    flatSize: '',
    foldedSize: '',
    colors: '',
    finishing: '',
    total: '',
    poNumber: '',
    deliveryDate: '',
    samples: '',
  });

  // Debug logging for form data changes
  useEffect(() => {
    console.log('🔄 Form data updated:', formData);
  }, [formData]);

  useEffect(() => {
    loadJobs();
  }, []);

  // Filter jobs based on user role
  const filteredJobs = useMemo(() => {
    if (!user) return [];

    // BROKER_ADMIN sees all jobs
    if (isBrokerAdmin) {
      return allJobs;
    }

    // CUSTOMER sees only their own jobs
    if (isCustomer) {
      return allJobs.filter((job) => {
        const customerId = typeof job.customer === 'string' ? job.customer : job.customer?.id;
        return customerId === user.companyId;
      });
    }

    // BRADFORD_ADMIN sees only jobs with Bradford POs
    if (isBradfordAdmin) {
      return allJobs.filter((job) => {
        return job.purchaseOrders?.some(
          (po: any) => po.targetCompany?.id === 'bradford' || po.originCompany?.id === 'bradford'
        );
      });
    }

    return allJobs;
  }, [allJobs, user, isCustomer, isBrokerAdmin, isBradfordAdmin]);

  const loadJobs = async () => {
    try {
      setLoading(true);

      // Build filter params based on user role for server-side filtering
      const params: any = {};

      if (isCustomer && user?.companyId) {
        // CUSTOMER: Only fetch their own jobs (server-side filtering for security)
        params.customerId = user.companyId;
      } else if (isBradfordAdmin && user?.companyId) {
        // BRADFORD: Use role-based filtering
        params.companyId = user.companyId;
        params.userRole = 'BRADFORD_ADMIN';
      }
      // BROKER_ADMIN: No params = fetch all jobs (as intended)

      const result = await jobsAPI.list(params);
      setAllJobs(result.jobs);
      setError(null);
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setError('Failed to load jobs. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const handlePOUpload = async (file: File) => {
    console.log('📤 Starting PO upload:', file.name);
    setUploadedPOFile(file);
    setParsingPO(true);

    try {
      // Parse the PO file
      const parseFormData = new FormData();
      parseFormData.append('file', file);

      console.log('🔍 Sending parse request...');
      const parseResponse = await fetch(`${API_URL}/api/files/parse-po`, {
        method: 'POST',
        body: parseFormData,
      });

      const parseResult = await parseResponse.json();
      console.log('📋 Parse result:', parseResult);
      console.log('📋 Parsed data object:', parseResult.parsed);
      console.log('📋 Description field:', parseResult.parsed?.description);

      if (!parseResult.success) {
        throw new Error(parseResult.message || 'Failed to parse PO');
      }

      if (!parseResult.parsed) {
        throw new Error('No parsed data in response');
      }

      // Upload the file for storage
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('kind', 'PO_PDF');

      console.log('📁 Uploading file for storage...');
      const uploadResponse = await fetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.ok) throw new Error('Upload failed');
      const uploadResult = await uploadResponse.json();
      console.log('✅ Upload result:', uploadResult);

      // Set parsed data with extracted values - ensure all fields are strings
      const extractedData = {
        description: String(parseResult.parsed.description || ''),
        paper: String(parseResult.parsed.paper || ''),
        flatSize: String(parseResult.parsed.flatSize || ''),
        foldedSize: String(parseResult.parsed.foldedSize || ''),
        colors: String(parseResult.parsed.colors || ''),
        finishing: String(parseResult.parsed.finishing || ''),
        total: parseResult.parsed.total ? String(parseResult.parsed.total) : '',
        poNumber: String(parseResult.parsed.poNumber || ''),
        deliveryDate: String(parseResult.parsed.deliveryDate || ''),
        samples: String(parseResult.parsed.samples || ''),
      };

      console.log('🎯 Setting form data:', extractedData);
      console.log('  - Each field value:', JSON.stringify(extractedData, null, 2));

      // Store the file ID separately
      setParsedData({ ...extractedData, fileId: uploadResult.file?.id || uploadResult.id });

      // Update form data to populate the inputs
      setFormData(extractedData);

      // Show success message
      const extractedFields = [];
      if (parseResult.parsed.description) extractedFields.push('description');
      if (parseResult.parsed.quantity) extractedFields.push('quantity');
      if (parseResult.parsed.size) extractedFields.push('size');
      if (parseResult.parsed.paper) extractedFields.push('paper');
      if (parseResult.parsed.colors) extractedFields.push('colors');
      if (parseResult.parsed.customerTotal) extractedFields.push('total');

      if (extractedFields.length > 0) {
        console.log(`✓ Extracted: ${extractedFields.join(', ')}`);
      }
    } catch (err) {
      console.error('Failed to parse PO:', err);
      alert('Failed to parse PO automatically. Please review and fill in the details manually.');
      // Still allow them to submit with empty fields
      const emptyData = {
        description: '',
        paper: '',
        flatSize: '',
        foldedSize: '',
        colors: '',
        finishing: '',
        total: '',
        poNumber: '',
        deliveryDate: '',
        samples: '',
      };
      setParsedData(emptyData);
      setFormData(emptyData);
    } finally {
      setParsingPO(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formDataObj = new FormData(e.currentTarget);
    const customerId = isCustomer ? user?.companyId : (formDataObj.get('customerId') as string);
    const customPrice = parseFloat(formData.total) || 0;

    try {
      await jobsAPI.createDirect({
        customerId: customerId || '',
        sizeId: '', // Will be determined by API from specs
        quantity: 0, // Will be determined by API from specs
        customPrice,
        specs: {
          description: formData.description,
          paper: formData.paper,
          flatSize: formData.flatSize,
          foldedSize: formData.foldedSize,
          colors: formData.colors,
          finishing: formData.finishing,
          poNumber: formData.poNumber,
          deliveryDate: formData.deliveryDate,
          samples: formData.samples,
        },
      });

      toast.success('Order created successfully!');
      setShowNewJobModal(false);
      setUploadedPOFile(null);
      setParsedData(null);
      setFormData({
        description: '',
        paper: '',
        flatSize: '',
        foldedSize: '',
        colors: '',
        finishing: '',
        total: '',
        poNumber: '',
        deliveryDate: '',
        samples: '',
      });
      setEntryMode('upload');
      await loadJobs();
      setError(null);
    } catch (err) {
      console.error('Failed to create job:', err);
      toast.error('Failed to create job. Please try again.');
      setError('Failed to create job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProofApproval = async (jobId: string, proofId: string, approved: boolean) => {
    try {
      toast.loading(approved ? 'Approving proof...' : 'Requesting changes...', { id: 'proof-action' });

      const endpoint = approved
        ? `${API_URL}/api/proofs/${proofId}/approve`
        : `${API_URL}/api/proofs/${proofId}/changes`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: approved ? 'Approved via customer portal' : 'Please make changes',
          approvedBy: user?.companyId?.toUpperCase(),
        }),
      });

      if (!response.ok) throw new Error('Proof action failed');

      toast.success(
        approved ? 'Proof approved! Order moving to production.' : 'Changes requested',
        { id: 'proof-action' }
      );

      await loadJobs();
    } catch (error) {
      console.error('Proof action failed:', error);
      toast.error('Failed to process proof', { id: 'proof-action' });
    }
  };

  // Bradford uses sidebar layout
  if (isBradfordAdmin) {
    return (
      <div className="flex h-screen bg-gray-50">
        <BradfordSidebar />
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">
                Complete snapshot of your operations
              </p>
            </div>
            <BradfordDashboard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Toaster position="top-right" />

      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-[1600px]">
        {/* Render role-specific dashboards */}
        {isBrokerAdmin ? (
          <ImpactDirectDashboard />
        ) : (
          <>
            {/* Customer Dashboard - Simple Job List */}
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  My Jobs
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Track your orders and proofs ({filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'})
                </p>
              </div>
              <button
                onClick={() => setShowNewJobModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Order
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 bg-red-900/20 border border-red-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <span className="font-semibold text-white">Error</span>
                    <p className="text-sm text-red-200 mt-0.5">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-slate-400">Loading your jobs...</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
                <svg className="mx-auto h-16 w-16 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-4 text-lg font-medium text-white">No orders yet</p>
                <p className="mt-2 text-sm text-slate-400">Click "New Order" above to create your first order</p>
              </div>
            ) : (
              <>
                {/* Jobs List with Proof Approval */}
                <div className="space-y-3">
                  {filteredJobs.map((job) => (
                    <div
                      key={job.id}
                      className="bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg p-5 cursor-pointer transition-all"
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">
                            {job.customerPONumber || job.jobNo}
                          </h3>
                          <p className="text-xs text-slate-500 mb-1">
                            Job: {job.jobNo}
                          </p>
                          <p className="text-sm text-slate-400">
                            {job.specs?.description || 'No description'}
                          </p>
                          {job.customerTotal && (
                            <div className="mt-2 inline-flex items-center gap-1.5 text-green-400 font-semibold">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                              </svg>
                              ${Number(job.customerTotal).toFixed(2)}
                            </div>
                          )}
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-md ${
                          job.status === 'READY_FOR_PROOF' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700' :
                          job.status === 'PROOF_APPROVED' ? 'bg-green-900/30 text-green-400 border border-green-700' :
                          job.status === 'IN_PRODUCTION' ? 'bg-blue-900/30 text-blue-400 border border-blue-700' :
                          job.status === 'COMPLETED' ? 'bg-slate-700 text-slate-300 border border-slate-600' :
                          'bg-slate-700 text-slate-400 border border-slate-600'
                        }`}>
                          {job.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Proof Approval Section */}
                      {job.status === 'READY_FOR_PROOF' && job.proofs && job.proofs.length > 0 && (
                        <div className="mt-3 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg" onClick={(e) => e.stopPropagation()}>
                          <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Proof Ready for Your Review
                          </h4>
                          <p className="text-sm text-yellow-200/80 mb-3">
                            Your proof is ready! Please review and approve to move forward with production.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleProofApproval(job.id, job.proofs[0].id, true)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Approve Proof
                            </button>
                            <button
                              onClick={() => handleProofApproval(job.id, job.proofs[0].id, false)}
                              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-md transition-colors"
                            >
                              Request Changes
                            </button>
                            <button
                              onClick={() => setSelectedJobId(job.id)}
                              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-md transition-colors"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      )}

                      {job.status === 'PROOF_APPROVED' && (
                        <div className="mt-3 p-3 bg-green-900/20 border border-green-700 rounded-lg">
                          <p className="text-green-400 font-medium flex items-center gap-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Proof approved! Your order is now in production.
                          </p>
                        </div>
                      )}

                      {job.status === 'COMPLETED' && (
                        <div className="mt-3 p-3 bg-slate-700/50 border border-slate-600 rounded-lg">
                          <p className="text-slate-300 font-medium flex items-center gap-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                            </svg>
                            Order completed and shipped!
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Job Detail Modal */}
        {selectedJobId && (
          <JobDetailModal
            jobId={selectedJobId}
            onClose={() => {
              setSelectedJobId(null);
              loadJobs(); // Refresh jobs list when modal closes
            }}
          />
        )}

        {/* New Job Modal - Simplified */}
        {showNewJobModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {isCustomer ? 'Create New Order' : 'Create New Job'}
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">Fill in the details below</p>
                </div>
                <button
                  onClick={() => {
                    setShowNewJobModal(false);
                    setUploadedPOFile(null);
                    setParsedData(null);
                    setFormData({
                      description: '',
                      paper: '',
                      flatSize: '',
                      foldedSize: '',
                      colors: '',
                      finishing: '',
                      total: '',
                      poNumber: '',
                      deliveryDate: '',
                      samples: '',
                    });
                    setEntryMode('upload');
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* PO Upload Section - Always visible for customers */}
              {isCustomer && !parsedData && (
                <div className="px-6 py-6">
                  <div className="relative border-2 border-dashed border-slate-600 bg-slate-700 rounded-xl p-10 text-center hover:border-slate-600 hover:bg-slate-600 transition-all group">
                    <div className="absolute inset-0 bg-slate-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePOUpload(file);
                      }}
                      className="hidden"
                      id="po-file-upload"
                      disabled={parsingPO}
                    />
                    <label htmlFor="po-file-upload" className="relative cursor-pointer">
                      {parsingPO ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="relative">
                            <div className="absolute inset-0 bg-slate-700 rounded-full blur-xl opacity-50 animate-pulse"></div>
                            <div className="relative w-16 h-16 border-4 border-transparent border-t-blue-400 border-r-purple-400 rounded-full animate-spin"></div>
                          </div>
                          <p className="text-lg font-semibold text-white">Analyzing your PO...</p>
                          <p className="text-sm text-slate-300">This may take a moment</p>
                        </div>
                      ) : (
                        <>
                          <div className="relative inline-block">
                            <div className="absolute inset-0 bg-slate-700 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
                            <svg className="relative mx-auto h-20 w-20 text-slate-300 group-hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <p className="mt-5 text-lg font-bold text-white">Drop your PO here</p>
                          <p className="mt-2 text-sm text-slate-300">or click to browse</p>
                          <p className="mt-4 text-xs text-slate-300/60">Supports PDF, JPG, PNG</p>
                        </>
                      )}
                    </label>
                  </div>
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setParsedData({});
                        setEntryMode('manual');
                      }}
                      className="text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors flex items-center gap-2 mx-auto"
                    >
                      Or enter order details manually
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateJob} className="p-6 space-y-4">
                {/* Show upload indicator if file was uploaded */}
                {uploadedPOFile && (
                  <div className="bg-slate-700 border border-green-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0 mt-0.5">
                        <div className="absolute inset-0 bg-green-500 rounded-full blur-md opacity-50"></div>
                        <svg className="relative w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-base font-bold text-white">{uploadedPOFile.name}</p>
                        <p className="text-sm text-green-300 mt-1">Review the details below and submit</p>
                      </div>
                    </div>
                  </div>
                )}

                {!isCustomer && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Customer *
                    </label>
                    <select
                      name="customerId"
                      required
                      className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-slate-600 transition-all"
                    >
                      <option value="">Select customer...</option>
                      <option value="jjsa">JJSA</option>
                      <option value="ballantine">Ballantine</option>
                    </select>
                  </div>
                )}

                {/* Only show form fields if PO uploaded or manual entry */}
                {(uploadedPOFile || parsedData || entryMode === 'manual') && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                          Description *
                        </label>
                        <input
                          type="text"
                          name="description"
                          required
                          value={formData.description || ''}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="e.g., Business cards, Brochures, Flyers"
                          className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-slate-600 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Paper *
                          </label>
                          <input
                            type="text"
                            name="paper"
                            required
                            value={formData.paper || ''}
                            onChange={(e) => setFormData({ ...formData, paper: e.target.value })}
                            placeholder="100# Gloss"
                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-slate-600 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Colors *
                          </label>
                          <input
                            type="text"
                            name="colors"
                            required
                            value={formData.colors || ''}
                            onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                            placeholder="4/4"
                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-slate-600 transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Size *
                          </label>
                          <input
                            type="text"
                            name="flatSize"
                            required
                            value={formData.flatSize || ''}
                            onChange={(e) => setFormData({ ...formData, flatSize: e.target.value })}
                            placeholder="8.5 x 11"
                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-slate-600 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Total Amount * ($)
                          </label>
                          <input
                            type="number"
                            name="total"
                            required
                            min="0.01"
                            step="0.01"
                            value={formData.total || ''}
                            onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                            placeholder="1250.00"
                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-slate-600 transition-all"
                          />
                        </div>
                      </div>

                      {/* Optional fields - collapsible */}
                      <details className="mt-6">
                        <summary className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer font-semibold flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Add more details (optional)
                        </summary>
                        <div className="mt-4 space-y-4 pl-4 border-l-2 border-slate-600">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-300/80 mb-1">
                                Folded Size
                              </label>
                              <input
                                type="text"
                                name="foldedSize"
                                value={formData.foldedSize || ''}
                                onChange={(e) => setFormData({ ...formData, foldedSize: e.target.value })}
                                placeholder="8.5 x 3.67"
                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-slate-600 transition-all"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-300/80 mb-1">
                                Finishing
                              </label>
                              <input
                                type="text"
                                name="finishing"
                                value={formData.finishing || ''}
                                onChange={(e) => setFormData({ ...formData, finishing: e.target.value })}
                                placeholder="UV coating"
                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-slate-600 transition-all"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-300/80 mb-1">
                                PO Number
                              </label>
                              <input
                                type="text"
                                name="poNumber"
                                value={formData.poNumber || ''}
                                onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                                placeholder="PO-12345"
                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-slate-600 transition-all"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-300/80 mb-1">
                                Delivery Date
                              </label>
                              <input
                                type="date"
                                name="deliveryDate"
                                value={formData.deliveryDate || ''}
                                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-slate-600 transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  </>
                )}

                {(uploadedPOFile || parsedData || entryMode === 'manual') && (
                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-600">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewJobModal(false);
                        setUploadedPOFile(null);
                        setParsedData(null);
                        setFormData({
                          description: '',
                          paper: '',
                          flatSize: '',
                          foldedSize: '',
                          colors: '',
                          finishing: '',
                          total: '',
                          poNumber: '',
                          deliveryDate: '',
                          samples: '',
                        });
                        setEntryMode('upload');
                      }}
                      className="px-6 py-3 text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-600 font-semibold transition-all"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating...
                        </span>
                      ) : isCustomer ? 'Submit Order' : 'Create Job'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
