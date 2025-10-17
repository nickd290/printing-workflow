'use client';

interface FileItem {
  id: string;
  fileName: string;
  kind: string;
  size: number;
  createdAt: string;
}

interface FilesTabProps {
  jobId: string;
  files: FileItem[];
  onUploadPO: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadArtwork: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: (fileId: string, fileName: string) => void;
  uploadingPO: boolean;
  uploadingArtwork: boolean;
}

export function FilesTab({
  jobId,
  files,
  onUploadPO,
  onUploadArtwork,
  onDownload,
  uploadingPO,
  uploadingArtwork
}: FilesTabProps) {
  const artworkFiles = files.filter(f => f.kind === 'ARTWORK');
  const poFiles = files.filter(f => f.kind === 'PO_PDF');

  return (
    <div className="space-y-8">
      {/* Customer PO Upload */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Purchase Order</h3>
        <label htmlFor="po-upload" className="cursor-pointer">
          <input
            type="file"
            accept=".pdf"
            onChange={onUploadPO}
            disabled={uploadingPO}
            className="hidden"
            id="po-upload"
          />
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors">
            {uploadingPO ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="ml-3 text-gray-600">Uploading and parsing PO...</p>
              </div>
            ) : (
              <>
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-2 text-sm text-gray-700 font-medium">Click to upload PO (PDF)</p>
                <p className="text-xs text-gray-500 mt-1">System will automatically parse PO information</p>
              </>
            )}
          </div>
        </label>

        {poFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {poFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                    <p className="text-xs text-gray-500">Uploaded {new Date(file.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => onDownload(file.id, file.fileName)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artwork Upload */}
      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Artwork Files</h3>
        <label htmlFor="artwork-upload" className="cursor-pointer">
          <input
            type="file"
            multiple
            onChange={onUploadArtwork}
            disabled={uploadingArtwork}
            className="hidden"
            id="artwork-upload"
          />
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors mb-4">
            {uploadingArtwork ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="ml-3 text-gray-600">Uploading artwork...</p>
              </div>
            ) : (
              <>
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-2 text-sm text-gray-700 font-medium">Click to upload artwork files</p>
                <p className="text-xs text-gray-500 mt-1">Support for images, PDFs, and design files (multiple files allowed)</p>
              </>
            )}
          </div>
        </label>

        {/* Artwork Files List */}
        {artworkFiles.length > 0 ? (
          <div className="space-y-2">
            {artworkFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center flex-1">
                  <svg className="h-8 w-8 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • Uploaded {new Date(file.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onDownload(file.id, file.fileName)}
                  className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No artwork files uploaded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
