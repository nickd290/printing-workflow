'use client';

interface FileProgress {
  uploaded: number;
  required: number;
  complete: boolean;
}

interface FileChecklistProps {
  artwork: FileProgress;
  dataFiles: FileProgress;
  overall: {
    complete: boolean;
    percentage: number;
  };
  className?: string;
}

export function FileChecklist({ artwork, dataFiles, overall, className = '' }: FileChecklistProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Progress */}
      <div className="rounded-lg bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-semibold text-gray-900">{overall.percentage}%</span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              overall.complete ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${overall.percentage}%` }}
          />
        </div>

        {overall.complete && (
          <div className="mt-2 flex items-center text-sm text-green-600">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            All files uploaded! Ready to submit.
          </div>
        )}
      </div>

      {/* Artwork Files */}
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
              artwork.complete ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              {artwork.complete ? (
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Artwork Files</h3>
              <p className="text-xs text-gray-500">Print-ready artwork (PDF, AI, EPS)</p>
            </div>
          </div>
          <div className={`text-sm font-semibold ${
            artwork.complete ? 'text-green-600' : 'text-gray-600'
          }`}>
            {artwork.uploaded} / {artwork.required}
          </div>
        </div>

        {artwork.required > 0 && (
          <div className="space-y-1">
            {Array.from({ length: artwork.required }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center text-xs ${
                  i < artwork.uploaded ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  {i < artwork.uploaded ? (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                      clipRule="evenodd"
                    />
                  )}
                </svg>
                Artwork file {i + 1}
                {i < artwork.uploaded && ' (uploaded)'}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Files */}
      {dataFiles.required > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                dataFiles.complete ? 'bg-green-100' : 'bg-blue-100'
              }`}>
                {dataFiles.complete ? (
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Data Files</h3>
                <p className="text-xs text-gray-500">Mailing lists, variable data (CSV, XLSX)</p>
              </div>
            </div>
            <div className={`text-sm font-semibold ${
              dataFiles.complete ? 'text-green-600' : 'text-gray-600'
            }`}>
              {dataFiles.uploaded} / {dataFiles.required}
            </div>
          </div>

          <div className="space-y-1">
            {Array.from({ length: dataFiles.required }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center text-xs ${
                  i < dataFiles.uploaded ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  {i < dataFiles.uploaded ? (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                      clipRule="evenodd"
                    />
                  )}
                </svg>
                Data file {i + 1}
                {i < dataFiles.uploaded && ' (uploaded)'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
