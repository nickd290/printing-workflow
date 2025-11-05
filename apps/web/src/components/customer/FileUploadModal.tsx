'use client';

import { useState, useEffect } from 'react';
import { FileUploadSection } from './FileUploadSection';
import { ProofViewer } from '../ProofViewer';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobNo: string;
  requiredArtworkCount: number;
  requiredDataFileCount: number;
  onFilesUpdated?: () => void;
}

export function FileUploadModal({
  isOpen,
  onClose,
  jobId,
  jobNo,
  requiredArtworkCount,
  requiredDataFileCount,
  onFilesUpdated,
}: FileUploadModalProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingFile, setViewingFile] = useState<{id: string; fileName: string; mimeType: string} | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen, jobId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/files/by-job/${jobId}`);
      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilesUpdated = () => {
    loadFiles(); // Reload files to show newly uploaded ones
    if (onFilesUpdated) {
      onFilesUpdated();
    }
    // Don't close modal automatically - let user close it
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
    } catch (err) {
      console.error('Failed to download file:', err);
      toast.error('Failed to download file');
    }
  };

  const downloadAllFiles = async () => {
    const uploadedFiles = files.filter(f => f.kind === 'ARTWORK' || f.kind === 'DATA_FILE');
    if (uploadedFiles.length === 0) {
      toast.error('No files to download');
      return;
    }

    setDownloadingAll(true);
    toast.loading(`Downloading ${uploadedFiles.length} file(s)...`, { id: 'download-all' });

    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        await downloadFile(file.id, file.fileName);
        await new Promise(resolve => setTimeout(resolve, 500));
        toast.loading(`Downloaded ${i + 1} of ${uploadedFiles.length}...`, { id: 'download-all' });
      }
      toast.success(`Successfully downloaded ${uploadedFiles.length} file(s)!`, { id: 'download-all' });
    } catch (error) {
      console.error('Failed to download all files:', error);
      toast.error('Failed to download all files', { id: 'download-all' });
    } finally {
      setDownloadingAll(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('zip')) return '📦';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  const artworkFiles = files.filter(f => f.kind === 'ARTWORK');
  const dataFiles = files.filter(f => f.kind === 'DATA_FILE');
  const allUploadedFiles = [...artworkFiles, ...dataFiles];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Background overlay */}
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Files</h3>
                <p className="text-sm text-gray-600 mt-1">Job #{jobNo}</p>
              </div>
              <div className="flex items-center gap-2">
                {allUploadedFiles.length > 0 && (
                  <button
                    onClick={downloadAllFiles}
                    disabled={downloadingAll}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {downloadingAll ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        Downloading...
                      </>
                    ) : (
                      <>
                        ⬇️ Download All ({allUploadedFiles.length})
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 max-h-[70vh] overflow-y-auto space-y-6">
            {/* Upload Section */}
            <FileUploadSection
              jobId={jobId}
              jobNo={jobNo}
              requiredArtworkCount={requiredArtworkCount}
              requiredDataFileCount={requiredDataFileCount}
              onFilesUpdated={handleFilesUpdated}
            />

            {/* Uploaded Files Section */}
            {!loading && allUploadedFiles.length > 0 && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Uploaded Files</h4>

                {/* Artwork Files */}
                {artworkFiles.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <span>🎨</span>
                      Artwork Files ({artworkFiles.length})
                    </h5>
                    <div className="space-y-2">
                      {artworkFiles.map((file: any) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setViewingFile({ id: file.id, fileName: file.fileName, mimeType: file.mimeType })}
                              className="px-2 py-1 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded"
                            >
                              👁️ Preview
                            </button>
                            <button
                              onClick={() => downloadFile(file.id, file.fileName)}
                              className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            >
                              ⬇️ Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data Files */}
                {dataFiles.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <span>📊</span>
                      Data Files ({dataFiles.length})
                    </h5>
                    <div className="space-y-2">
                      {dataFiles.map((file: any) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setViewingFile({ id: file.id, fileName: file.fileName, mimeType: file.mimeType })}
                              className="px-2 py-1 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded"
                            >
                              👁️ Preview
                            </button>
                            <button
                              onClick={() => downloadFile(file.id, file.fileName)}
                              className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            >
                              ⬇️ Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={() => setViewingFile(null)}>
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl m-4" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">{viewingFile.fileName}</h3>
              <button
                onClick={() => setViewingFile(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-hidden">
              <ProofViewer
                fileUrl={`${API_URL}/api/files/${viewingFile.id}/download`}
                fileName={viewingFile.fileName}
                mimeType={viewingFile.mimeType}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
