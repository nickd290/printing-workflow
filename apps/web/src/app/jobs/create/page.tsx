'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { FileUploadZone } from '@/components/jobs/FileUploadZone';
import { POReviewForm } from '@/components/jobs/POReviewForm';
import { JobFormFields } from '@/components/jobs/JobFormFields';

type WorkflowStep = 'select-method' | 'upload-po' | 'review-po' | 'manual-entry' | 'creating';

export default function CreateJobPage() {
  const router = useRouter();
  const { isBrokerAdmin } = useUser();
  const [step, setStep] = useState<WorkflowStep>('select-method');
  const [poFile, setPoFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualFormData, setManualFormData] = useState<any>({
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
    requiredArtworkCount: 1,
    requiredDataFileCount: 0,
    // Routing fields (admin only)
    routingType: 'BRADFORD_JD',
    vendorId: '',
    vendorAmount: '',
    bradfordCut: '',
  });

  // Get customer ID from session/context (hardcoded for demo)
  const customerId = 'impact-direct';

  const handlePOFileSelect = async (file: File) => {
    setPoFile(file);
    setError(null);
    setLoading(true);
    setStep('upload-po');

    try {
      // Upload and parse PO
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/customer/parse-po', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse PO');
      }

      const result = await response.json();
      setParsedData(result.parsed);
      setStep('review-po');
    } catch (err: any) {
      setError(err.message || 'Failed to parse PO. Please try manual entry.');
      setStep('select-method');
    } finally {
      setLoading(false);
    }
  };

  const handlePOReviewConfirm = async (data: any) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/customer/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          ...data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create job');
      }

      const result = await response.json();

      // Redirect to job details page
      router.push(`/jobs/${result.job.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  const handleManualFormChange = (field: string, value: string | number) => {
    setManualFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleManualSubmit = async () => {
    if (!manualFormData.description) {
      setError('Job description is required');
      return;
    }

    // Validate third-party vendor fields if selected
    if (manualFormData.routingType === 'THIRD_PARTY_VENDOR') {
      if (!manualFormData.vendorId) {
        setError('Please select a vendor');
        return;
      }
      if (!manualFormData.vendorAmount || parseFloat(manualFormData.vendorAmount) <= 0) {
        setError('Please enter a valid vendor amount');
        return;
      }
      if (!manualFormData.bradfordCut || parseFloat(manualFormData.bradfordCut) < 0) {
        setError('Please enter a valid Bradford cut amount');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Build submission data
      const submitData: any = {
        customerId,
        ...manualFormData,
      };

      // Convert routing fields to proper types
      if (isBrokerAdmin && manualFormData.routingType === 'THIRD_PARTY_VENDOR') {
        submitData.routingType = 'THIRD_PARTY_VENDOR';
        submitData.vendorId = manualFormData.vendorId;
        submitData.vendorAmount = parseFloat(manualFormData.vendorAmount);
        submitData.bradfordCut = parseFloat(manualFormData.bradfordCut);
      } else {
        submitData.routingType = 'BRADFORD_JD';
      }

      const response = await fetch('/api/customer/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        throw new Error('Failed to create job');
      }

      const result = await response.json();

      // Redirect to job details page
      router.push(`/jobs/${result.job.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Job</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload your Purchase Order for AI-assisted job creation, or enter details manually.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <div className="flex">
              <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            {/* Step 1: Select Method */}
            {step === 'select-method' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  How would you like to create your job?
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PO Upload Option */}
                  <button
                    onClick={() => setStep('upload-po')}
                    className="relative rounded-lg border-2 border-gray-300 bg-white p-6 shadow-sm hover:border-blue-500 hover:shadow-md transition-all text-left"
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-8 w-8 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">Upload Purchase Order</h3>
                        <p className="mt-2 text-sm text-gray-500">
                          Let AI extract job details from your PO PDF automatically. Faster and more accurate.
                        </p>
                        <div className="mt-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Recommended
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Manual Entry Option */}
                  <button
                    onClick={() => setStep('manual-entry')}
                    className="relative rounded-lg border-2 border-gray-300 bg-white p-6 shadow-sm hover:border-blue-500 hover:shadow-md transition-all text-left"
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-8 w-8 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">Enter Manually</h3>
                        <p className="mt-2 text-sm text-gray-500">
                          Fill out the job details form yourself. Best if you don't have a PO or prefer manual entry.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Upload PO */}
            {step === 'upload-po' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Upload Purchase Order</h2>
                  <button
                    onClick={() => setStep('select-method')}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    � Back
                  </button>
                </div>

                <FileUploadZone
                  label="Click to upload PO"
                  accept=".pdf"
                  maxSize={10}
                  onFileSelect={handlePOFileSelect}
                  disabled={loading}
                />

                {loading && (
                  <div className="text-center py-8">
                    <svg
                      className="animate-spin h-10 w-10 text-blue-600 mx-auto"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <p className="mt-4 text-sm text-gray-600">Analyzing your PO with AI...</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review Parsed PO Data */}
            {step === 'review-po' && parsedData && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Review Job Details</h2>
                  <button
                    onClick={() => {
                      setStep('select-method');
                      setParsedData(null);
                      setPoFile(null);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    � Start Over
                  </button>
                </div>

                <POReviewForm
                  parsedData={parsedData}
                  onConfirm={handlePOReviewConfirm}
                  onCancel={() => setStep('select-method')}
                  loading={loading}
                />
              </div>
            )}

            {/* Step 4: Manual Entry */}
            {step === 'manual-entry' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Enter Job Details</h2>
                  <button
                    onClick={() => setStep('select-method')}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    � Back
                  </button>
                </div>

                <JobFormFields
                  data={manualFormData}
                  onChange={handleManualFormChange}
                  disabled={loading}
                  showFileRequirements={true}
                  showRoutingOptions={isBrokerAdmin}
                />

                {/* Actions */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setStep('select-method')}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={loading || !manualFormData.description}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  >
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Creating Job...
                      </>
                    ) : (
                      'Create Job'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
