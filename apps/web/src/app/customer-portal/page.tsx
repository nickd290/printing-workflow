'use client';

import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';

export default function CustomerPortalPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<'jjsa' | 'ballantine' | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedPO, setUploadedPO] = useState<any>(null);

  useEffect(() => {
    if (selectedCustomer) {
      loadJobs();
    }
  }, [selectedCustomer]);

  const loadJobs = async () => {
    if (!selectedCustomer) return;

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/jobs`);
      const data = await response.json();

      // Filter jobs for the selected customer only
      const customerJobs = data.jobs.filter((job: any) =>
        job.customerId === selectedCustomer
      );

      setJobs(customerJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      toast.error('Failed to load your orders');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please select a PDF file');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handlePOUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedCustomer) {
      toast.error('Please select a file');
      return;
    }

    try {
      toast.loading('Uploading and parsing your PO...', { id: 'upload-po' });

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('customerId', selectedCustomer);

      const response = await fetch('http://localhost:3001/api/customer/upload-po', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      setUploadedPO(result);
      setSelectedFile(null);
      toast.success('PO uploaded successfully! Order created.', { id: 'upload-po' });

      // Reload jobs after upload
      await loadJobs();
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload PO', { id: 'upload-po' });
    }
  };

  const handleProofApproval = async (proofId: string, approved: boolean, comments?: string) => {
    try {
      toast.loading(approved ? 'Approving proof...' : 'Requesting changes...', { id: 'proof-action' });

      const endpoint = approved
        ? `http://localhost:3001/api/proofs/${proofId}/approve`
        : `http://localhost:3001/api/proofs/${proofId}/changes`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments,
          approvedBy: selectedCustomer?.toUpperCase(),
        }),
      });

      if (!response.ok) throw new Error('Proof action failed');

      toast.success(
        approved ? 'Proof approved! Moving to production.' : 'Changes requested',
        { id: 'proof-action' }
      );

      await loadJobs();
    } catch (error) {
      console.error('Proof action failed:', error);
      toast.error('Failed to process proof', { id: 'proof-action' });
    }
  };

  // Customer login screen
  if (!selectedCustomer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg mb-4">
              <h1 className="text-2xl font-bold">Impact Direct</h1>
            </div>
            <p className="text-gray-600">Customer Portal</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setSelectedCustomer('ballantine')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg transition-colors shadow-lg"
            >
              Login as Ballantine
            </button>
            <button
              onClick={() => setSelectedCustomer('jjsa')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-lg transition-colors shadow-lg"
            >
              Login as JJSA
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-8">
            Secure portal for viewing proofs and placing orders
          </p>
        </div>
      </div>
    );
  }

  // Customer portal (after login)
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-blue-600">Impact Direct</h1>
              <p className="text-sm text-gray-600">Welcome, {selectedCustomer.toUpperCase()}</p>
            </div>
            <button
              onClick={() => setSelectedCustomer(null)}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload PO Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Purchase Order</h2>
          <form onSubmit={handlePOUpload} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select PO (PDF)
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: <span className="font-medium">{selectedFile.name}</span>
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={!selectedFile}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload & Create Order
            </button>
          </form>
        </div>

        {/* Orders Section */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Your Orders</h2>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading your orders...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4 text-gray-600">No orders yet. Upload a PO to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <div key={job.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{job.jobNo}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {job.specs?.description || 'No description'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      job.status === 'READY_FOR_PROOF' ? 'bg-yellow-100 text-yellow-800' :
                      job.status === 'PROOF_APPROVED' ? 'bg-green-100 text-green-800' :
                      job.status === 'IN_PRODUCTION' ? 'bg-blue-100 text-blue-800' :
                      job.status === 'COMPLETED' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {job.customerTotal && (
                    <p className="text-lg font-bold text-green-600 mb-4">
                      Total: ${Number(job.customerTotal).toFixed(2)}
                    </p>
                  )}

                  {/* Proof Section - Only show if proof exists */}
                  {job.status === 'READY_FOR_PROOF' && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="font-semibold text-yellow-900 mb-2">Proof Ready for Review</h4>
                      <p className="text-sm text-yellow-800 mb-4">
                        Please review and approve the proof to move forward with production.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleProofApproval(job.id, true)}
                          className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700"
                        >
                          ✓ Approve Proof
                        </button>
                        <button
                          onClick={() => handleProofApproval(job.id, false, 'Please make changes')}
                          className="px-4 py-2 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700"
                        >
                          Request Changes
                        </button>
                      </div>
                    </div>
                  )}

                  {job.status === 'PROOF_APPROVED' && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 font-medium">
                        ✓ Proof approved! Your order is now in production.
                      </p>
                    </div>
                  )}

                  {job.status === 'COMPLETED' && (
                    <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-purple-800 font-medium">
                        ✓ Order completed and shipped!
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
