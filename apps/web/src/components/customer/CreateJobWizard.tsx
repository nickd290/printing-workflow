'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { POReviewModal } from './POReviewModal';
import { ParsingLoadingModal } from './ParsingLoadingModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SampleRecipient {
  quantity: number;
  recipientName: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface ParsedPOData {
  description?: string;
  paper?: string;
  flatSize?: string;
  foldedSize?: string;
  colors?: string;
  finishing?: string;
  total?: number;
  poNumber?: string;
  orderDate?: string;
  deliveryDate?: string;
  pickupDate?: string;
  poolDate?: string;
  samples?: string;
  sampleInstructions?: string;
  sampleRecipients?: SampleRecipient[];
  quantity?: number;
  requiredArtworkCount?: number;
  requiredDataFileCount?: number;
}

interface CreateJobWizardProps {
  customerId: string;
  onJobCreated: () => void;
}

type WizardStep = 'upload' | 'review' | 'files' | 'complete';

interface FileUploadProgress {
  artworkUploaded: number;
  artworkRequired: number;
  dataFilesUploaded: number;
  dataFilesRequired: number;
}

export function CreateJobWizard({ customerId, onJobCreated }: CreateJobWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedPOData | null>(null);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [createdJobNo, setCreatedJobNo] = useState<string | null>(null);
  const [fileProgress, setFileProgress] = useState<FileUploadProgress>({
    artworkUploaded: 0,
    artworkRequired: 0,
    dataFilesUploaded: 0,
    dataFilesRequired: 0,
  });
  const [loading, setLoading] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showParsingModal, setShowParsingModal] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please select a PDF file');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleParsePO = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    try {
      setLoading(true);
      setShowParsingModal(true); // Show centered loading modal

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${API_URL}/api/customer/parse-po`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        // Show specific error message from API
        const errorMessage = result.error || result.message || 'Failed to parse PO';
        throw new Error(errorMessage);
      }

      setParsedData(result.parsed);
      setShowParsingModal(false); // Close loading modal
      setShowReviewModal(true); // Open review modal
      toast.success('PO analyzed successfully!');
    } catch (error) {
      console.error('Parse failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze PO';

      setShowParsingModal(false); // Close loading modal

      // Show detailed error to user
      toast.error(errorMessage, { duration: 5000 });

      // Offer manual entry option
      toast((t) => (
        <div className="flex flex-col gap-2">
          <p className="font-medium">Unable to parse PO automatically</p>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              // Open modal with empty data for manual entry
              setParsedData({});
              setShowReviewModal(true);
            }}
            className="btn-primary text-sm px-3 py-1 rounded"
          >
            Enter Details Manually
          </button>
        </div>
      ), {
        duration: 10000,
        id: 'manual-entry-option'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (confirmedData: ParsedPOData) => {
    try {
      setLoading(true);
      toast.loading('Creating your order...', { id: 'create-job' });

      // Create JSON payload for job creation
      const requestBody = {
        customerId,
        description: confirmedData.description || undefined,
        paper: confirmedData.paper || undefined,
        flatSize: confirmedData.flatSize || undefined,
        foldedSize: confirmedData.foldedSize || undefined,
        colors: confirmedData.colors || undefined,
        finishing: confirmedData.finishing || undefined,
        total: confirmedData.total?.toString(),
        poNumber: confirmedData.poNumber || undefined,
        quantity: confirmedData.quantity?.toString(),
        orderDate: confirmedData.orderDate || undefined,
        deliveryDate: confirmedData.deliveryDate || undefined,
        pickupDate: confirmedData.pickupDate || undefined,
        poolDate: confirmedData.poolDate || undefined,
        samples: confirmedData.samples || undefined,
        sampleInstructions: confirmedData.sampleInstructions || undefined,
        sampleRecipients: confirmedData.sampleRecipients && confirmedData.sampleRecipients.length > 0
          ? confirmedData.sampleRecipients
          : undefined,
        requiredArtworkCount: confirmedData.requiredArtworkCount,
        requiredDataFileCount: confirmedData.requiredDataFileCount,
        notes: confirmedData.notes || undefined,
      };

      const response = await fetch(`${API_URL}/api/customer/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Job creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create job');
      }

      const result = await response.json();
      setCreatedJobId(result.job.id);
      setCreatedJobNo(result.job.jobNo);
      setFileProgress({
        artworkUploaded: 0,
        artworkRequired: result.job.requiredArtworkCount || 1,
        dataFilesUploaded: 0,
        dataFilesRequired: result.job.requiredDataFileCount || 0,
      });

      setShowReviewModal(false);
      setCurrentStep('files');
      toast.success(`Order ${result.job.jobNo} created successfully!`, { id: 'create-job' });

      // Refresh the job list in the parent component
      if (onJobCreated) {
        onJobCreated();
      }

      // Log if PO was stored
      if (result.poFile) {
        console.log(`📄 Original PO stored: ${result.poFile.fileName}`);
      }
    } catch (error) {
      console.error('Create job failed:', error);
      toast.error('Failed to create order', { id: 'create-job' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, kind: 'ARTWORK' | 'DATA_FILE') => {
    if (!createdJobId) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', kind);

      const response = await fetch(`${API_URL}/api/customer/jobs/${createdJobId}/files`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('File upload failed');
      }

      const result = await response.json();

      // Update progress
      if (result.progress) {
        setFileProgress({
          artworkUploaded: result.progress.artworkCount,
          artworkRequired: fileProgress.artworkRequired,
          dataFilesUploaded: result.progress.dataFileCount,
          dataFilesRequired: fileProgress.dataFilesRequired,
        });
      }

      // Check if job is ready
      if (result.isReady) {
        setCurrentStep('complete');
        toast.success('All files uploaded! Order submitted for production.');
        onJobCreated();
      } else {
        toast.success(`${kind === 'ARTWORK' ? 'Artwork' : 'Data file'} uploaded successfully`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload file');
    }
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setParsedData(null);
    setCreatedJobId(null);
    setCreatedJobNo(null);
    setShowReviewModal(false);
    setLoading(false);
    onJobCreated();
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { id: 'upload', label: 'Upload PO', icon: '📄' },
              { id: 'review', label: 'Review Details', icon: '✏️' },
              { id: 'files', label: 'Upload Files', icon: '📁' },
              { id: 'complete', label: 'Complete', icon: '✅' },
            ].map((step, index, array) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                      currentStep === step.id
                        ? 'bg-blue-600 text-white'
                        : array.findIndex((s) => s.id === currentStep) > index
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {step.icon}
                  </div>
                  <p className="text-xs font-medium text-gray-600 mt-2">{step.label}</p>
                </div>
                {index < array.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      array.findIndex((s) => s.id === currentStep) > index ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 'upload' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Purchase Order</h2>
            <p className="text-gray-600 mb-6">Upload your PO in PDF format to get started</p>

            <div className="space-y-4">
              <label className="block">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-8 hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                />
              </label>

              {selectedFile && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-blue-900">{selectedFile.name}</p>
                        <p className="text-xs text-blue-700">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <button
                      onClick={handleParsePO}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Analyzing...' : 'Continue'}
                    </button>
                  </div>
                  <div className="text-center">
                    <button
                      onClick={() => {
                        setParsedData({});
                        setShowReviewModal(true);
                      }}
                      disabled={loading}
                      className="text-sm text-blue-700 hover:text-blue-900 font-medium underline disabled:opacity-50"
                    >
                      Skip AI & Enter Details Manually
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 'files' && createdJobNo && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Files</h2>
            <p className="text-gray-600 mb-6">Order {createdJobNo} - Upload artwork and data files</p>

            <div className="space-y-6">
              {/* Artwork Upload */}
              {fileProgress.artworkRequired > 0 && (
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Artwork Files ({fileProgress.artworkUploaded} / {fileProgress.artworkRequired})
                  </h3>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'ARTWORK');
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 cursor-pointer"
                  />
                </div>
              )}

              {/* Data Files Upload */}
              {fileProgress.dataFilesRequired > 0 && (
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Data Files ({fileProgress.dataFilesUploaded} / {fileProgress.dataFilesRequired})
                  </h3>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'DATA_FILE');
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 'complete' && createdJobNo && (
          <div className="text-center py-8">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Order Submitted Successfully!</h2>
            <p className="text-xl text-gray-600 mb-8">
              Order Number: <span className="font-semibold text-blue-600">{createdJobNo}</span>
            </p>
            <p className="text-gray-500 mb-8">
              Your order has been submitted for production. You'll receive updates as it progresses through our system.
            </p>
            <button
              onClick={handleReset}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              Create Another Order
            </button>
          </div>
        )}
      </div>

      {/* Parsing Loading Modal */}
      <ParsingLoadingModal isOpen={showParsingModal} />

      {/* Review Modal */}
      {parsedData && (
        <POReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          parsedData={parsedData}
          onConfirm={handleCreateJob}
          loading={loading}
        />
      )}
    </>
  );
}
