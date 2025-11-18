'use client';

import { BradfordSidebar } from '@/components/BradfordSidebar';
import { JobsTable } from '@/components/JobsTable';
import { JobDetailModal } from '@/components/JobDetailModal';
import { UnifiedJobCreationWizard } from '@/components/jobs/UnifiedJobCreationWizard';
import { BradfordDashboard } from '@/components/dashboards/BradfordDashboard';
import { ImpactDirectDashboard } from '@/components/dashboards/ImpactDirectDashboard';
import { DeliveryUrgencyBadge, getDeliveryUrgency } from '@/components/jobs/DeliveryUrgencyBadge';
import { JobStatsBar } from '@/components/jobs/JobStatsBar';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { jobsAPI, filesAPI, proofsAPI } from '@/lib/api-client';
import { useUser } from '@/contexts/UserContext';
import toast, { Toaster } from 'react-hot-toast';

export default function DashboardPage() {
  const router = useRouter();
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

  // Redirect customers to their dedicated portal
  useEffect(() => {
    if (user && isCustomer) {
      router.push('/customer-portal');
    }
  }, [user, isCustomer, router]);

  useEffect(() => {
    loadJobs();
  }, []);

  // Filter jobs based on user role
  const filteredJobs = useMemo(() => {
    if (!user) return [];

    let jobs: any[] = [];

    // BROKER_ADMIN sees all jobs
    if (isBrokerAdmin) {
      jobs = allJobs;
    }
    // CUSTOMER sees only their own jobs
    else if (isCustomer) {
      jobs = allJobs.filter((job) => {
        const customerId = typeof job.customer === 'string' ? job.customer : job.customer?.id;
        return customerId === user.companyId;
      });
    }
    // BRADFORD_ADMIN sees only jobs with Bradford POs
    else if (isBradfordAdmin) {
      jobs = allJobs.filter((job) => {
        return job.purchaseOrders?.some(
          (po: any) => po.targetCompany?.id === 'bradford' || po.originCompany?.id === 'bradford'
        );
      });
    } else {
      jobs = allJobs;
    }

    // Sort customers' jobs by delivery urgency (late jobs first)
    if (isCustomer) {
      return jobs.sort((a, b) => {
        const urgencyA = getDeliveryUrgency(a.deliveryDate, a.completedAt);
        const urgencyB = getDeliveryUrgency(b.deliveryDate, b.completedAt);
        return urgencyA - urgencyB; // Lower urgency value = higher priority
      });
    }

    return jobs;
  }, [allJobs, user, isCustomer, isBrokerAdmin, isBradfordAdmin]);

  // Calculate stats for the stats bar
  const jobStats = useMemo(() => {
    if (!isCustomer) {
      return { late: 0, urgent: 0, proofNeeded: 0, inProduction: 0, completed: 0 };
    }

    const stats = {
      late: 0,
      urgent: 0,
      proofNeeded: 0,
      inProduction: 0,
      completed: 0,
    };

    filteredJobs.forEach((job) => {
      const urgency = getDeliveryUrgency(job.deliveryDate, job.completedAt);

      if (urgency === -1) stats.late++;
      else if (urgency === 0) stats.urgent++;

      if (job.status === 'READY_FOR_PROOF') stats.proofNeeded++;
      if (job.status === 'IN_PRODUCTION' || job.status === 'PROOF_APPROVED') stats.inProduction++;
      if (job.status === 'COMPLETED') stats.completed++;
    });

    return stats;
  }, [filteredJobs, isCustomer]);

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
      setError('Failed to load jobs. Please check your connection and try again.');
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
      console.log('🔍 Sending parse request...');
      const parseResult = await filesAPI.parsePO(file);
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
      console.log('📁 Uploading file for storage...');
      const uploadResult = await filesAPI.upload(file, 'PO_PDF');
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

  const handleWizardSubmit = async (data: any) => {
    try {
      await jobsAPI.createCustomerJob({
        customerId: data.customerId || user?.companyId || '',
        description: data.description,
        paper: data.paper,
        flatSize: data.flatSize,
        foldedSize: data.foldedSize,
        colors: data.colors,
        finishing: data.finishing,
        total: data.total,
        poNumber: data.poNumber,
        deliveryDate: data.deliveryDate,
        samples: data.samples,
        requiredArtworkCount: data.requiredArtworkCount,
        requiredDataFileCount: data.requiredDataFileCount,
        // Routing fields (admin only)
        routingType: data.routingType,
        vendorId: data.vendorId,
        vendorAmount: data.vendorAmount,
        bradfordCut: data.bradfordCut,
      });

      toast.success('Order created successfully!');
      await loadJobs();
      setError(null);
    } catch (err: any) {
      console.error('Failed to create job:', err);
      const errorMessage = err.message || 'Failed to create job. Please try again.';
      toast.error(errorMessage);
      throw err; // Re-throw so the wizard can handle it
    }
  };

  const handleProofApproval = async (jobId: string, proofId: string, approved: boolean) => {
    try {
      toast.loading(approved ? 'Approving proof...' : 'Requesting changes...', { id: 'proof-action' });

      if (approved) {
        await proofsAPI.approve(proofId, user?.companyId?.toUpperCase() || '', 'Approved via customer portal');
      } else {
        await proofsAPI.requestChanges(proofId, user?.companyId?.toUpperCase() || '', 'Please make changes');
      }

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
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />

      <div className="mx-auto px-6 sm:px-8 lg:px-12 py-12 max-w-[1800px]">
        {/* Render role-specific dashboards */}
        {isBrokerAdmin ? (
          <ImpactDirectDashboard
            jobs={allJobs}
            loading={loading}
            onCreateJob={() => setShowNewJobModal(true)}
            onJobsChanged={loadJobs}
          />
        ) : (
          <>
            {/* Customer Dashboard - Enhanced Header */}
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
                  My Jobs
                </h1>
                <p className="text-base text-muted-foreground">
                  Track your orders and proofs • {filteredJobs.length} active {filteredJobs.length === 1 ? 'job' : 'jobs'}
                </p>
              </div>
              <button
                onClick={() => setShowNewJobModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Order
              </button>
            </div>

            {/* Stats Bar */}
            <JobStatsBar stats={jobStats} />

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
                <p className="mt-4 text-muted-foreground">Loading your jobs...</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-4 text-lg font-medium text-foreground">No orders yet</p>
                <p className="mt-2 text-sm text-muted-foreground">Click "New Order" above to create your first order</p>
              </div>
            ) : (
              <>
                {/* Jobs List with Proof Approval - Responsive Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredJobs.map((job) => {
                    // Calculate urgency for border color and glow effect
                    const urgency = getDeliveryUrgency(job.deliveryDate, job.completedAt);
                    let borderColor = 'border-slate-700/50';
                    let glowEffect = '';

                    if (urgency === -1) {
                      borderColor = 'border-red-500/50 border-l-4'; // Late (overdue)
                      glowEffect = 'shadow-red-500/20';
                    } else if (urgency === 0) {
                      borderColor = 'border-orange-500/50 border-l-4'; // Urgent (0-2 days)
                      glowEffect = 'shadow-orange-500/20';
                    } else if (urgency === 1) {
                      borderColor = 'border-yellow-500/50 border-l-4'; // Warning (3-7 days)
                      glowEffect = 'shadow-yellow-500/10';
                    } else if (urgency === 2) {
                      borderColor = 'border-green-500/50 border-l-4'; // Normal (8+ days)
                      glowEffect = 'shadow-green-500/10';
                    }

                    return (
                      <div
                        key={job.id}
                        className={`group relative overflow-hidden bg-white border ${borderColor} hover:border-gray-300 rounded-xl p-6 cursor-pointer shadow-md hover:shadow-lg ${glowEffect} transition-all duration-300 hover:-translate-y-1`}
                        onClick={() => setSelectedJobId(job.id)}
                      >
                        {/* Subtle background decoration */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full blur-3xl group-hover:bg-gray-100 transition-all duration-300"></div>

                        {/* Card Content */}
                        <div className="relative">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-xl font-bold tracking-tight text-foreground">
                                  {job.customerPONumber || job.jobNo}
                                </h3>
                                {job.deliveryDate && !job.completedAt && (
                                  <DeliveryUrgencyBadge
                                    deliveryDate={job.deliveryDate}
                                    completedAt={job.completedAt}
                                  />
                                )}
                              </div>
                              <p className="text-xs text-data-label font-medium mb-2">
                                Job #{job.jobNo}
                              </p>
                              <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                                {job.specs?.description || 'No description'}
                              </p>
                            {job.customerTotal && (
                              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 font-bold">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07-.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                </svg>
                                ${Number(job.customerTotal).toFixed(2)}
                              </div>
                            )}
                          </div>
                          <span className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                            job.status === 'READY_FOR_PROOF' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                            job.status === 'PROOF_APPROVED' ? 'bg-green-50 text-green-700 border border-green-200' :
                            job.status === 'IN_PRODUCTION' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            job.status === 'COMPLETED' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                            'bg-gray-100 text-gray-600 border border-gray-200'
                          } shadow-sm`}>
                            {job.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                          {/* Proof Approval Section */}
                          {job.status === 'READY_FOR_PROOF' && job.proofs && job.proofs.length > 0 && (
                            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl" onClick={(e) => e.stopPropagation()}>
                              <h4 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                Proof Ready for Your Review
                              </h4>
                              <p className="text-sm text-yellow-700 mb-3 leading-relaxed">
                                Your proof is ready! Please review and approve to move forward with production.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => handleProofApproval(job.id, job.proofs[0].id, true)}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Approve Proof
                                </button>
                                <button
                                  onClick={() => handleProofApproval(job.id, job.proofs[0].id, false)}
                                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                                >
                                  Request Changes
                                </button>
                                <button
                                  onClick={() => setSelectedJobId(job.id)}
                                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm transition-all duration-300 hover:-translate-y-0.5"
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          )}

                          {job.status === 'PROOF_APPROVED' && (
                            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                              <p className="text-green-700 font-semibold flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Proof approved! Your order is now in production.
                              </p>
                            </div>
                          )}

                          {job.status === 'COMPLETED' && (
                            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                              <p className="text-gray-700 font-semibold flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                                </svg>
                                Order completed and shipped!
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )})}
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

        {/* New Job Creation Wizard */}
        <UnifiedJobCreationWizard
          isOpen={showNewJobModal}
          onClose={() => setShowNewJobModal(false)}
          onSubmit={handleWizardSubmit}
          userRole={isCustomer ? 'customer' : (isBrokerAdmin || isBradfordAdmin) ? 'admin' : 'production'}
          defaultCustomerId={isCustomer ? user?.companyId : undefined}
        />
      </div>
    </div>
  );
}
