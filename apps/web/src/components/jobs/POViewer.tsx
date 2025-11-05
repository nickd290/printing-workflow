'use client';

import { useState } from 'react';

interface POViewerProps {
  customerPONumber: string | null;
  customerPOFile: string | null; // File path or ID
  poFiles?: Array<{
    id: string;
    fileName: string;
    createdAt: string;
  }>;
  onDownload?: (fileId: string, fileName: string) => void;
}

export function POViewer({ customerPONumber, customerPOFile, poFiles = [], onDownload }: POViewerProps) {
  const [showDetails, setShowDetails] = useState(false);

  // If no PO number or files, don't show anything
  if (!customerPONumber && poFiles.length === 0) {
    return null;
  }

  const handleDownload = (fileId: string, fileName: string) => {
    if (onDownload) {
      onDownload(fileId, fileName);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Customer Purchase Order</h4>
              {customerPONumber && (
                <p className="text-xs text-gray-500">PO #: {customerPONumber}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {poFiles.length > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-md">
                {poFiles.length} file{poFiles.length > 1 ? 's' : ''}
              </span>
            )}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* File List */}
      {showDetails && (
        <div className="p-4 bg-white border-t border-gray-200">
          {poFiles.length > 0 ? (
            <div className="space-y-2">
              {poFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                      <p className="text-xs text-gray-500">
                        Uploaded {new Date(file.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(file.id, file.fileName)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download
                  </button>
                </div>
              ))}
            </div>
          ) : customerPOFile ? (
            <div className="text-center py-4">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-500 mb-3">PO file uploaded but not yet processed</p>
              <p className="text-xs text-gray-400">File path: {customerPOFile}</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <svg className="mx-auto h-12 w-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-500">No PO file uploaded yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
