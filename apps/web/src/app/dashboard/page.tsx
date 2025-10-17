'use client';

import { Navigation } from '@/components/navigation';
import { JobsTable } from '@/components/JobsTable';
import { JobDetailModal } from '@/components/JobDetailModal';
import { useEffect, useState, useMemo } from 'react';
import { jobsAPI } from '@/lib/api-client';
import { useUser } from '@/contexts/UserContext';

export default function DashboardPage() {
  const { user, isCustomer, isBrokerAdmin, isManager, isBradfordAdmin } = useUser();
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

    // BROKER_ADMIN and MANAGER see all jobs
    if (isBrokerAdmin || isManager) {
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
  }, [allJobs, user, isCustomer, isBrokerAdmin, isManager, isBradfordAdmin]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const result = await jobsAPI.list();
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
      const parseResponse = await fetch('http://localhost:3001/api/files/parse-po', {
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
      const uploadResponse = await fetch('http://localhost:3001/api/files/upload', {
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
        size: '',
        quantity: '',
        colors: '',
        finishing: '',
        customerTotal: '',
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
    const customerTotal = parseFloat(formData.total);

    try {
      await jobsAPI.createDirect({
        customerId: customerId || '',
        customerTotal,
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
      setError('Failed to create job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px]">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isCustomer ? 'My Jobs' : 'Jobs'}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {isCustomer
                ? `Track your orders and proofs (${filteredJobs.length} ${filteredJobs.length === 1 ? 'job' : 'jobs'})`
                : isBradfordAdmin
                ? `Bradford jobs (${filteredJobs.length})`
                : `All active and completed jobs (${filteredJobs.length})`}
            </p>
          </div>
          <button
            onClick={() => setShowNewJobModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
          >
            {isCustomer ? '+ New Order' : '+ New Job'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Error:</span> {error}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading jobs...</p>
          </div>
        ) : (
          <JobsTable
            jobs={filteredJobs}
            onJobClick={setSelectedJobId}
            onRefresh={loadJobs}
          />
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

        {/* New Job Modal */}
        {showNewJobModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  {isCustomer ? 'Create New Order' : 'Create New Job'}
                </h2>
                <button
                  onClick={() => {
                    setShowNewJobModal(false);
                    setUploadedPOFile(null);
                    setParsedData(null);
                    setFormData({
                      description: '',
                      paper: '',
                      size: '',
                      quantity: '',
                      colors: '',
                      finishing: '',
                      customerTotal: '',
                    });
                    setEntryMode('upload');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Entry mode toggle */}
              {isCustomer && !parsedData && (
                <div className="px-6 pt-6">
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setEntryMode('upload')}
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-md ${
                        entryMode === 'upload'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Upload PO
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode('manual')}
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-md ${
                        entryMode === 'manual'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Enter Manually
                    </button>
                  </div>
                </div>
              )}

              {/* PO Upload Section */}
              {isCustomer && entryMode === 'upload' && !parsedData && (
                <div className="px-6 pb-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
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
                    <label htmlFor="po-file-upload" className="cursor-pointer">
                      {parsingPO ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-sm text-gray-600">Parsing your PO...</p>
                        </div>
                      ) : (
                        <>
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="mt-3 text-sm font-medium text-gray-900">Upload your Purchase Order</p>
                          <p className="mt-1 text-xs text-gray-500">PDF, JPG, or PNG (auto-parsed)</p>
                          <p className="mt-4 text-xs text-blue-600 font-medium">Click to browse files</p>
                        </>
                      )}
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-gray-500 text-center">
                    We'll automatically extract order details from your PO
                  </p>
                </div>
              )}

              <form onSubmit={handleCreateJob} className="p-6 space-y-6">
                {/* Debug info */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="bg-gray-100 p-2 text-xs font-mono rounded">
                    <div>Form State: {JSON.stringify(formData)}</div>
                  </div>
                )}
                {/* Show upload indicator if file was uploaded */}
                {uploadedPOFile && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-green-900">PO Uploaded: {uploadedPOFile.name}</p>
                        <p className="text-xs text-green-700">Review and confirm details below</p>
                      </div>
                    </div>
                  </div>
                )}

                {!isCustomer && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer *
                    </label>
                    <select
                      name="customerId"
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select customer...</option>
                      <option value="jjsa">JJSA</option>
                      <option value="ballantine">Ballantine</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <input
                    type="text"
                    name="description"
                    required
                    value={formData.description || ''}
                    onChange={(e) => {
                      console.log('📝 Description changed:', e.target.value);
                      setFormData({ ...formData, description: e.target.value });
                    }}
                    placeholder="e.g., Business cards, Brochures, etc."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paper *
                  </label>
                  <input
                    type="text"
                    name="paper"
                    required
                    value={formData.paper || ''}
                    onChange={(e) => setFormData({ ...formData, paper: e.target.value })}
                    placeholder="e.g., 100# Gloss Text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Flat Size *
                    </label>
                    <input
                      type="text"
                      name="flatSize"
                      required
                      value={formData.flatSize || ''}
                      onChange={(e) => setFormData({ ...formData, flatSize: e.target.value })}
                      placeholder="e.g., 8.5 x 11"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Folded Size
                    </label>
                    <input
                      type="text"
                      name="foldedSize"
                      value={formData.foldedSize || ''}
                      onChange={(e) => setFormData({ ...formData, foldedSize: e.target.value })}
                      placeholder="e.g., 8.5 x 3.67 (optional)"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Colors *
                  </label>
                  <input
                    type="text"
                    name="colors"
                    required
                    value={formData.colors || ''}
                    onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                    placeholder="e.g., 4/4, 4/0"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Finishing
                  </label>
                  <input
                    type="text"
                    name="finishing"
                    value={formData.finishing || ''}
                    onChange={(e) => setFormData({ ...formData, finishing: e.target.value })}
                    placeholder="e.g., UV coating, die cut, etc. (optional)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total * ($)
                    </label>
                    <input
                      type="number"
                      name="total"
                      required
                      min="0.01"
                      step="0.01"
                      value={formData.total || ''}
                      onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                      placeholder="e.g., 1250.00"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PO Number
                    </label>
                    <input
                      type="text"
                      name="poNumber"
                      value={formData.poNumber || ''}
                      onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                      placeholder="e.g., 1227419 (optional)"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Date
                    </label>
                    <input
                      type="date"
                      name="deliveryDate"
                      value={formData.deliveryDate || ''}
                      onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Samples
                    </label>
                    <input
                      type="text"
                      name="samples"
                      value={formData.samples || ''}
                      onChange={(e) => setFormData({ ...formData, samples: e.target.value })}
                      placeholder="e.g., 25 samples (optional)"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewJobModal(false);
                      setUploadedPOFile(null);
                      setParsedData(null);
                      setEntryMode('upload');
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating...' : isCustomer ? 'Submit Order' : 'Create Job'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
