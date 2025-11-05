'use client';

import { useState, useEffect } from 'react';
import { FileUploadZone } from '../jobs/FileUploadZone';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface File {
  id: string;
  fileName: string;
  kind: 'ARTWORK' | 'DATA_FILE';
  createdAt: string;
}

interface FileProgress {
  uploadedArtwork: number;
  requiredArtwork: number;
  uploadedDataFiles: number;
  requiredDataFiles: number;
  isReady: boolean;
}

interface FileUploadSectionProps {
  jobId: string;
  jobNo: string;
  requiredArtworkCount: number;
  requiredDataFileCount: number;
  onFilesUpdated?: () => void;
}

export function FileUploadSection({
  jobId,
  jobNo,
  requiredArtworkCount,
  requiredDataFileCount,
  onFilesUpdated,
}: FileUploadSectionProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<FileProgress>({
    uploadedArtwork: 0,
    requiredArtwork: requiredArtworkCount,
    uploadedDataFiles: 0,
    requiredDataFiles: requiredDataFileCount,
    isReady: false,
  });
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [uploadingDataFile, setUploadingDataFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing files and progress
  useEffect(() => {
    loadFiles();
  }, [jobId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const [filesRes, progressRes] = await Promise.all([
        fetch(`${API_URL}/api/files/by-job/${jobId}`),
        fetch(`${API_URL}/api/customer/jobs/${jobId}/progress`),
      ]);

      const filesData = await filesRes.json();
      const progressData = await progressRes.json();

      setFiles(filesData.files || []);
      setProgress(progressData.progress);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, kind: 'ARTWORK' | 'DATA_FILE') => {
    const isArtwork = kind === 'ARTWORK';
    const setUploading = isArtwork ? setUploadingArtwork : setUploadingDataFile;

    try {
      setUploading(true);
      toast.loading(`Uploading ${isArtwork ? 'artwork' : 'data file'}...`, { id: 'file-upload' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('jobId', jobId);
      formData.append('kind', kind);

      const response = await fetch(`${API_URL}/api/customer/jobs/${jobId}/files`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      toast.success(`${isArtwork ? 'Artwork' : 'Data file'} uploaded successfully!`, {
        id: 'file-upload',
      });

      // Update progress
      setProgress(result.progress);

      // Reload files list
      await loadFiles();

      // Notify parent if job became ready
      if (result.isReady && onFilesUpdated) {
        onFilesUpdated();
      }
    } catch (error) {
      console.error('File upload failed:', error);
      toast.error('Failed to upload file', { id: 'file-upload' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitForProduction = async () => {
    try {
      setSubmitting(true);
      toast.loading('Submitting for production...', { id: 'submit-job' });

      const response = await fetch(`${API_URL}/api/customer/jobs/${jobId}/submit`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Submission failed');
      }

      toast.success('Job submitted for production! We\'ll be in touch soon.', {
        id: 'submit-job',
        duration: 5000,
      });

      if (onFilesUpdated) {
        onFilesUpdated();
      }
    } catch (error: any) {
      console.error('Job submission failed:', error);
      toast.error(error.message || 'Failed to submit job', { id: 'submit-job' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <p className="text-blue-800">Loading file requirements...</p>
        </div>
      </div>
    );
  }

  const artworkFiles = files.filter(f => f.kind === 'ARTWORK');
  const dataFiles = files.filter(f => f.kind === 'DATA_FILE');

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">File Upload Progress</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-blue-800">
              Artwork Files: {progress.uploadedArtwork} / {progress.requiredArtwork}
              {progress.uploadedArtwork >= progress.requiredArtwork && ' ✓'}
            </p>
            <div className="mt-1 w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{
                  width: `${(progress.uploadedArtwork / progress.requiredArtwork) * 100}%`,
                }}
              />
            </div>
          </div>

          {progress.requiredDataFiles > 0 && (
            <div>
              <p className="text-sm text-blue-800">
                Data Files: {progress.uploadedDataFiles} / {progress.requiredDataFiles}
                {progress.uploadedDataFiles >= progress.requiredDataFiles && ' ✓'}
              </p>
              <div className="mt-1 w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${(progress.uploadedDataFiles / progress.requiredDataFiles) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {progress.isReady && (
          <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-md">
            <p className="text-sm text-green-800 font-medium">
              ✓ All required files uploaded! Ready to submit for production.
            </p>
          </div>
        )}
      </div>

      {/* Artwork Upload */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-2">
          Upload Artwork Files ({artworkFiles.length}{progress.requiredArtwork > 0 ? ` / ${progress.requiredArtwork}` : ''})
        </h4>
        <FileUploadZone
          label="Upload Artwork"
          accept=".pdf,.ai,.eps,.psd,.indd"
          maxSize={50}
          onFileSelect={(file) => handleFileUpload(file, 'ARTWORK')}
          disabled={uploadingArtwork}
        />
      </div>

      {/* Data Files Upload */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-2">
          Upload Data Files ({dataFiles.length}{progress.requiredDataFiles > 0 ? ` / ${progress.requiredDataFiles}` : ''})
        </h4>
        <FileUploadZone
          label="Upload Data File"
          accept=".csv,.xlsx,.xls,.txt,.zip"
          maxSize={25}
          onFileSelect={(file) => handleFileUpload(file, 'DATA_FILE')}
          disabled={uploadingDataFile}
        />
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">Uploaded Files</h4>
          <div className="space-y-2">
            {artworkFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                    <p className="text-xs text-gray-500">Artwork</p>
                  </div>
                </div>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  Uploaded
                </span>
              </div>
            ))}

            {dataFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                    <p className="text-xs text-gray-500">Data File</p>
                  </div>
                </div>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  Uploaded
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit for Production Button */}
      {progress.isReady && (
        <button
          onClick={handleSubmitForProduction}
          disabled={submitting}
          className="w-full bg-green-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Submitting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Submit Job for Production
            </>
          )}
        </button>
      )}
    </div>
  );
}
