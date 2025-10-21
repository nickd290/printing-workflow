'use client';

import { useState, useEffect } from 'react';
import { adminAPI, type MissingPdfsResponse, type GenerateMissingPdfsResponse } from '@/lib/api-client';
import toast from 'react-hot-toast';

export default function PDFManagementPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MissingPdfsResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationType, setGenerationType] = useState<'invoices' | 'purchase-orders' | 'all'>('all');
  const [results, setResults] = useState<GenerateMissingPdfsResponse | null>(null);

  useEffect(() => {
    loadMissingPdfs();
  }, []);

  const loadMissingPdfs = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getMissingPdfs();
      setData(response);
    } catch (err) {
      console.error('Failed to load missing PDFs:', err);
      toast.error('Failed to load missing PDFs');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMissingPdfs = async () => {
    if (!confirm(`Generate all missing ${generationType === 'all' ? 'invoices and purchase orders' : generationType} PDFs? This may take a while.`)) {
      return;
    }

    try {
      setGenerating(true);
      setResults(null);
      toast.loading('Generating PDFs...', { id: 'bulk-gen' });

      const response = await adminAPI.generateMissingPdfs(generationType);
      setResults(response);

      if (response.success) {
        toast.success(response.message, { id: 'bulk-gen' });
        // Reload to get updated counts
        await loadMissingPdfs();
      } else {
        toast.error('PDF generation completed with errors', { id: 'bulk-gen' });
      }
    } catch (err) {
      console.error('Failed to generate PDFs:', err);
      toast.error('Failed to generate PDFs', { id: 'bulk-gen' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading PDF data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">PDF Management</h1>
        <p className="mt-2 text-gray-600">Manage and generate missing invoice and purchase order PDFs</p>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Invoices without PDFs</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {data.summary.totalInvoicesWithoutPdfs}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">POs without PDFs</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {data.summary.totalPurchaseOrdersWithoutPdfs}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Missing PDFs</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {data.summary.totalInvoicesWithoutPdfs + data.summary.totalPurchaseOrdersWithoutPdfs}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generation Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Bulk PDF Generation</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Generate PDFs for:</label>
            <select
              value={generationType}
              onChange={(e) => setGenerationType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={generating}
            >
              <option value="all">All (Invoices + Purchase Orders)</option>
              <option value="invoices">Invoices Only</option>
              <option value="purchase-orders">Purchase Orders Only</option>
            </select>
          </div>
          <div className="flex-shrink-0 pt-6">
            <button
              onClick={handleGenerateMissingPdfs}
              disabled={generating || !!(data && data.summary.totalInvoicesWithoutPdfs + data.summary.totalPurchaseOrdersWithoutPdfs === 0)}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Generate Missing PDFs
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Generation Results */}
      {results && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Generation Results</h2>
          <div className="grid grid-cols-2 gap-6">
            {/* Invoices Results */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Invoices</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-800">Successful</span>
                  <span className="text-lg font-bold text-green-900">{results.results.invoices.success}</span>
                </div>
                {results.results.invoices.failed > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-800">Failed</span>
                    <span className="text-lg font-bold text-red-900">{results.results.invoices.failed}</span>
                  </div>
                )}
                {results.results.invoices.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Errors:</p>
                    <ul className="text-xs text-red-600 space-y-1">
                      {results.results.invoices.errors.map((error, i) => (
                        <li key={i} className="bg-red-50 p-2 rounded">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* POs Results */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Purchase Orders</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-800">Successful</span>
                  <span className="text-lg font-bold text-green-900">{results.results.purchaseOrders.success}</span>
                </div>
                {results.results.purchaseOrders.failed > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-800">Failed</span>
                    <span className="text-lg font-bold text-red-900">{results.results.purchaseOrders.failed}</span>
                  </div>
                )}
                {results.results.purchaseOrders.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Errors:</p>
                    <ul className="text-xs text-red-600 space-y-1">
                      {results.results.purchaseOrders.errors.map((error, i) => (
                        <li key={i} className="bg-red-50 p-2 rounded">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      {data && data.invoices.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Invoices without PDFs ({data.invoices.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From → To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.invoiceNo}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{invoice.jobNo || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {invoice.fromCompany} → {invoice.toCompany}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">${invoice.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchase Orders Table */}
      {data && data.purchaseOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Purchase Orders without PDFs ({data.purchaseOrders.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From → To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{po.poNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{po.jobNo || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {po.originCompany} → {po.targetCompany}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">${po.vendorAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Missing PDFs Message */}
      {data && data.invoices.length === 0 && data.purchaseOrders.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">All PDFs Generated!</h3>
          <p className="text-gray-600">There are no missing invoice or purchase order PDFs.</p>
        </div>
      )}
    </div>
  );
}
