'use client';

import { useState } from 'react';

interface ProofViewerProps {
  fileUrl: string;
  fileName: string;
  mimeType: string;
}

export function ProofViewer({ fileUrl, fileName, mimeType }: ProofViewerProps) {
  const [scale, setScale] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);

  const isPDF = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 2.5));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  if (isPDF) {
    return (
      <div className="w-full h-full flex flex-col">
        {/* PDF Controls */}
        <div className="bg-gray-100 border-b border-gray-300 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">{fileName}</span>
          </div>

          <a
            href={fileUrl}
            download={fileName}
            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        </div>

        {/* PDF Viewer using iframe */}
        <div className="flex-1 overflow-hidden bg-gray-200">
          <iframe
            src={fileUrl}
            className="w-full h-full border-0"
            title={fileName}
            onError={() => setError('Failed to load PDF. Please try downloading it instead.')}
          />
          {error && (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <div className="text-center max-w-md p-8">
                <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-red-600 font-medium mb-2">{error}</p>
                <a
                  href={fileUrl}
                  download={fileName}
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Download PDF
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="w-full h-full flex flex-col">
        {/* Image Controls */}
        <div className="bg-gray-100 border-b border-gray-300 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              −
            </button>
            <span className="text-sm text-gray-700 w-16 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={scale >= 2.5}
              className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              +
            </button>
            <button
              onClick={() => setScale(1.0)}
              className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm"
            >
              Reset
            </button>
          </div>

          <a
            href={fileUrl}
            download={fileName}
            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        </div>

        {/* Image Viewer */}
        <div className="flex-1 overflow-auto bg-gray-200 flex items-center justify-center p-4">
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full shadow-lg"
            style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
          />
        </div>
      </div>
    );
  }

  // Fallback for unsupported file types
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center max-w-md p-8">
        <svg className="w-24 h-24 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-600 font-medium mb-2">Preview not available</p>
        <p className="text-sm text-gray-500 mb-4">
          This file type ({mimeType}) cannot be previewed in the browser.
        </p>
        <a
          href={fileUrl}
          download={fileName}
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Download File
        </a>
      </div>
    </div>
  );
}
