'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { useUser } from '@/contexts/UserContext';
import { Navigation } from '@/components/navigation';
import { StatsCards } from '@/components/customer/StatsCards';
import { JobsTable } from '@/components/customer/JobsTable';
import { FileUploadModal } from '@/components/customer/FileUploadModal';
import { ProofReviewModal } from '@/components/customer/ProofReviewModal';
import { JobDetailModal } from '@/components/JobDetailModal';
import { CreateJobWizard } from '@/components/customer/CreateJobWizard';
import { TableSkeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function CustomerPortalPage() {
  const router = useRouter();
  const { user, isCustomer, logout, loading: authLoading } = useUser();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [fileUploadModal, setFileUploadModal] = useState<{ isOpen: boolean; job: any | null }>({
    isOpen: false,
    job: null,
  });
  const [proofReviewModal, setProofReviewModal] = useState<{ isOpen: boolean; job: any | null; proof: any | null }>({
    isOpen: false,
    job: null,
    proof: null,
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Auth check - redirect non-customers to login
  useEffect(() => {
    if (!authLoading && (!user || !isCustomer)) {
      router.push('/login');
    }
  }, [user, isCustomer, authLoading, router]);

  // Load jobs when user is authenticated
  useEffect(() => {
    if (user && isCustomer) {
      loadJobs();
    }
  }, [user, isCustomer]);

  const loadJobs = async () => {
    if (!user?.companyId) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/jobs?customerId=${user.companyId}`);
      const data = await response.json();

      console.log('🔍 Customer Portal Debug - Jobs loaded:', {
        totalJobs: data.jobs?.length || 0,
        firstJob: data.jobs?.[0],
        allStatuses: data.jobs?.map((j: any) => ({ jobNo: j.jobNo, status: j.status })),
      });

      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      toast.error('Failed to load your orders');
    } finally {
      setLoading(false);
    }
  };

  // Modal handlers
  const handleUploadFilesClick = (job: any) => {
    setFileUploadModal({ isOpen: true, job });
  };

  const handleReviewProofClick = async (job: any) => {
    // Fetch latest proof for this job
    try {
      const response = await fetch(`${API_URL}/api/proofs/by-job/${job.id}`);
      const data = await response.json();

      if (data.proofs && data.proofs.length > 0) {
        const latestProof = data.proofs[0]; // Already sorted by version desc
        setProofReviewModal({ isOpen: true, job, proof: latestProof });
      } else {
        toast.error('No proof available for this job');
      }
    } catch (error) {
      console.error('Failed to load proof:', error);
      toast.error('Failed to load proof');
    }
  };

  const handleViewBOLClick = (job: any) => {
    // TODO: Implement BOL/packing slip PDF download
    // For now, show a message
    toast('BOL/Packing slip download coming soon!', { icon: '📄' });
  };

  const closeFileUploadModal = () => {
    setFileUploadModal({ isOpen: false, job: null });
    loadJobs(); // Reload jobs when modal closes
  };

  const closeProofReviewModal = () => {
    setProofReviewModal({ isOpen: false, job: null, proof: null });
    loadJobs(); // Reload jobs when modal closes
  };

  // Filter jobs based on search query
  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;

    const query = searchQuery.toLowerCase();
    return jobs.filter(job =>
      job.jobNo?.toLowerCase().includes(query) ||
      job.customerPONumber?.toLowerCase().includes(query) ||
      job.description?.toLowerCase().includes(query) ||
      job.specs?.description?.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="spinner h-12 w-12 mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!user || !isCustomer) {
    return null;
  }

  // Customer portal (authenticated)
  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />

      {/* Navigation */}
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {jobs.length > 0 && <StatsCards jobs={jobs} />}

        {/* Create Job Wizard */}
        {user?.companyId && (
          <div className="mb-8">
            <CreateJobWizard customerId={user.companyId} onJobCreated={loadJobs} />
          </div>
        )}

        {/* Orders Section */}
        <div>
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Your Orders</h2>
                <p className="text-muted-foreground mt-1">Track and manage all your printing orders</p>
              </div>
              {jobs.length > 0 && (
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search by Job #, PO #, or Description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input"
                  />
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="card p-6">
              <TableSkeleton rows={8} columns={6} />
            </div>
          ) : (
            <JobsTable
              jobs={filteredJobs}
              onUploadFilesClick={handleUploadFilesClick}
              onReviewProofClick={handleReviewProofClick}
              onViewBOLClick={handleViewBOLClick}
              onRowClick={(job) => setSelectedJobId(job.id)}
            />
          )}
        </div>
      </div>

      {/* File Upload Modal */}
      {fileUploadModal.job && (
        <FileUploadModal
          isOpen={fileUploadModal.isOpen}
          onClose={closeFileUploadModal}
          jobId={fileUploadModal.job.id}
          jobNo={fileUploadModal.job.jobNo}
          requiredArtworkCount={fileUploadModal.job.requiredArtworkCount || 0}
          requiredDataFileCount={fileUploadModal.job.requiredDataFileCount || 0}
          onFilesUpdated={loadJobs}
        />
      )}

      {/* Proof Review Modal */}
      {proofReviewModal.job && proofReviewModal.proof && (
        <ProofReviewModal
          isOpen={proofReviewModal.isOpen}
          onClose={closeProofReviewModal}
          jobId={proofReviewModal.job.id}
          jobNo={proofReviewModal.job.jobNo}
          proofId={proofReviewModal.proof.id}
          fileId={proofReviewModal.proof.file?.id}
          fileName={proofReviewModal.proof.file?.fileName}
          mimeType={proofReviewModal.proof.file?.mimeType}
          onProofAction={loadJobs}
        />
      )}

      {/* Job Detail Modal */}
      {selectedJobId && (
        <JobDetailModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  );
}
