'use client';

import { useState, useEffect } from 'react';
import { FileUploadZone } from './FileUploadZone';
import { FileChecklist } from './FileChecklist';

interface FileManagementSectionProps {
  jobId: string;
  onFilesUpdated?: () => void;
}

interface ProgressData {
  artwork: {
    uploaded: number;
    required: number;
    complete: boolean;
  };
  dataFiles: {
    uploaded: number;
    required: number;
    complete: boolean;
  };
  overall: {
    complete: boolean;
    percentage: number;
  };
}

export function FileManagementSection({ jobId, onFilesUpdated }: FileManagementSectionProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch progress on load
  useEffect(() => {
    fetchProgress();
  }, [jobId]);

  const fetchProgress = async () => {
    try {
      const response = await fetch(`/api/customer/jobs/${jobId}/progress`);
      if (!response.ok) throw new Error('Failed to fetch progress');

      const data = await response.json();
      setProgress(data.progress);
    } catch (err: any) {
      console.error('Error fetching progress:', err);
      setError(err.message);
    }
  };

  const handleFileUpload = async (file: File, kind: 'ARTWORK' | 'DATA_FILE') => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', kind);

      const response = await fetch(`/api/customer/jobs/${jobId}/files`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const result = await response.json();

      // Update progress
      setProgress(result.progress);

      // Notify parent
      if (onFilesUpdated) {
        onFilesUpdated();
      }

      // Show success message if job became ready
      if (result.isReady) {
        alert('All files uploaded! Your job is ready for production.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitForProduction = async () => {
    if (!progress?.overall.complete) {
      setError('Please upload all required files before submitting');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/customer/jobs/${jobId}/submit`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit job');
      }

      alert('Job submitted for production! You will receive a confirmation email shortly.');

      // Refresh progress
      await fetchProgress();

      // Notify parent
      if (onFilesUpdated) {
        onFilesUpdated();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit job');
    } finally {
      setSubmitting(false);
    }
  };

  if (!progress) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
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

      {/* Progress Checklist */}
      <FileChecklist
        artwork={progress.artwork}
        dataFiles={progress.dataFiles}
        overall={progress.overall}
      />

      {/* File Upload Zones */}
      {!progress.overall.complete && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Artwork Upload */}
          {!progress.artwork.complete && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Upload Artwork</h3>
              <FileUploadZone
                label="Click to upload artwork file"
                accept=".pdf,.ai,.eps,.tiff,.png,.jpg"
                maxSize={10}
                onFileSelect={(file) => handleFileUpload(file, 'ARTWORK')}
                disabled={uploading}
              />
              <p className="mt-2 text-xs text-gray-500">
                Accepted formats: PDF, AI, EPS, TIFF, PNG, JPG
              </p>
            </div>
          )}

          {/* Data File Upload */}
          {progress.dataFiles.required > 0 && !progress.dataFiles.complete && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Upload Data Files</h3>
              <FileUploadZone
                label="Click to upload data file"
                accept=".csv,.xlsx,.txt"
                maxSize={10}
                onFileSelect={(file) => handleFileUpload(file, 'DATA_FILE')}
                disabled={uploading}
              />
              <p className="mt-2 text-xs text-gray-500">
                Accepted formats: CSV, XLSX, TXT
              </p>
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      {progress.overall.complete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="h-8 w-8 text-green-600 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-lg font-medium text-green-900">
                  All Files Uploaded!
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Your job is ready to be submitted for production.
                </p>
              </div>
            </div>

            <button
              onClick={handleSubmitForProduction}
              disabled={submitting}
              className="px-6 py-3 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
            >
              {submitting ? (
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
                  Submitting...
                </>
              ) : (
                'Submit for Production'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
