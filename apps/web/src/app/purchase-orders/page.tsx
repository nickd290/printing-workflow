'use client';

import { Navigation } from '@/components/navigation';
import { useState, useEffect } from 'react';
import { purchaseOrdersAPI, jobsAPI, APIError } from '@/lib/api-client';

const mockPOs = [
  {
    id: '1',
    originCompany: 'Impact Direct',
    targetCompany: 'Bradford',
    jobNo: 'J-2025-000001',
    originalAmount: 100.00,
    vendorAmount: 80.00,
    marginAmount: 20.00,
    status: 'PENDING',
    type: 'AUTO',
    createdAt: '2025-01-10T10:30:00Z',
  },
  {
    id: '2',
    originCompany: 'Bradford',
    targetCompany: 'JD Graphic',
    jobNo: 'J-2025-000001',
    originalAmount: 80.00,
    vendorAmount: 60.00,
    marginAmount: 20.00,
    status: 'ACCEPTED',
    type: 'WEBHOOK',
    externalRef: 'COMP-12345-EST-67890',
    createdAt: '2025-01-10T11:00:00Z',
  },
  {
    id: '3',
    originCompany: 'Impact Direct',
    targetCompany: 'Bradford',
    jobNo: 'J-2025-000002',
    originalAmount: 275.50,
    vendorAmount: 220.40,
    marginAmount: 55.10,
    status: 'IN_PROGRESS',
    type: 'AUTO',
    createdAt: '2025-01-12T09:15:00Z',
  },
];

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [uploadResult, setUploadResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [posResult, jobsResult] = await Promise.all([
        purchaseOrdersAPI.list(),
        jobsAPI.list(),
      ]);
      setPurchaseOrders(posResult.purchaseOrders);
      setJobs(jobsResult.jobs);
      setError(null);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please select a PDF file');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const result = await purchaseOrdersAPI.uploadBradfordPDF(
        selectedFile,
        selectedJobId || undefined
      );
      setUploadResult(result);
      setSelectedFile(null);
      setSelectedJobId('');
      await loadData();
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadResult(null);
      }, 3000);
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert(err.message || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track purchase orders and money flow between companies
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            + Upload Bradford PO
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
            <p className="mt-4 text-gray-600">Loading purchase orders...</p>
          </div>
        ) : (
          <>
        {/* Money Flow Diagram */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Money Flow Example ($100 Job)</h2>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 font-bold mb-2">
                $100
              </div>
              <p className="text-sm font-medium text-gray-900">Customer</p>
              <p className="text-xs text-gray-500">Pays Impact</p>
            </div>
            <div className="flex-shrink-0 px-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="text-center flex-1">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 font-bold mb-2">
                $80
              </div>
              <p className="text-sm font-medium text-gray-900">Bradford</p>
              <p className="text-xs text-gray-500">Auto PO (80%)</p>
              <p className="text-xs text-green-600 font-semibold">Impact keeps $20</p>
            </div>
            <div className="flex-shrink-0 px-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="text-center flex-1">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 text-purple-600 font-bold mb-2">
                $60
              </div>
              <p className="text-sm font-medium text-gray-900">JD Graphic</p>
              <p className="text-xs text-gray-500">Webhook PO</p>
              <p className="text-xs text-green-600 font-semibold">Bradford keeps $20</p>
            </div>
          </div>
        </div>

        {/* POs Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">All Purchase Orders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From → To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{po.originCompany?.name || po.originCompany}</div>
                      <div className="text-gray-500">→ {po.targetCompany?.name || po.targetCompany}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      {po.job?.jobNo || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${po.originalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${po.vendorAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                      ${po.marginAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        po.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        po.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {po.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}

        {/* Upload Bradford PO Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Upload Bradford PO (PDF)</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpload} className="p-6 space-y-6">
                {/* Success Message */}
                {uploadResult && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1">
                        <h3 className="font-semibold text-green-800 mb-2">PDF Parsed Successfully!</h3>
                        <div className="text-sm text-green-700 space-y-1">
                          <p><strong>Customer:</strong> {uploadResult.parsed.customerCode} ({uploadResult.parsed.customerId})</p>
                          <p><strong>Amount:</strong> ${uploadResult.parsed.amount.toFixed(2)}</p>
                          {uploadResult.parsed.poNumber && (
                            <p><strong>PO Number:</strong> {uploadResult.parsed.poNumber}</p>
                          )}
                          <p className="mt-2 text-green-600 font-semibold">PO created: Bradford → JD Graphic</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bradford PO PDF *
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {selectedFile && (
                    <p className="mt-2 text-sm text-gray-600">
                      Selected: <span className="font-medium">{selectedFile.name}</span>
                    </p>
                  )}
                </div>

                {/* Optional Job Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link to Job (Optional)
                  </label>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- None --</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.jobNo} - {job.customer?.name || 'Unknown Customer'}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    Optionally link this PO to an existing job
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Upload a PDF from Bradford (email attachment)</li>
                    <li>System auto-detects customer code (JJSG or BALSG)</li>
                    <li>Extracts the dollar amount from the PDF</li>
                    <li>Creates PO: Bradford → JD Graphic</li>
                  </ol>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : 'Upload & Parse'}
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
