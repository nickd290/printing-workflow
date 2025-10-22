'use client';

import { Navigation } from '@/components/navigation';
import { useState, useEffect } from 'react';
import { revenueAPI } from '@/lib/api-client';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';
export default function RevenuePage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await revenueAPI.getMetrics();
      setMetrics(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setError('Failed to load revenue metrics. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      toast.loading('Exporting revenue data to CSV...', { id: 'export-revenue' });
      const response = await fetch('${API_URL}/api/exports/revenue');
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Revenue data exported successfully!', { id: 'export-revenue' });
    } catch (error) {
      console.error('Failed to export revenue:', error);
      toast.error('Failed to export revenue data', { id: 'export-revenue' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revenue Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track revenue, costs, and profit margins
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export to CSV
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
            <p className="mt-4 text-gray-600">Loading revenue metrics...</p>
          </div>
        ) : metrics ? (
          <>
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Total Revenue</div>
                <div className="text-3xl font-bold text-green-600">
                  ${metrics.profitMargins.totalRevenue.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">From customer invoices</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Total Costs</div>
                <div className="text-3xl font-bold text-red-600">
                  ${metrics.profitMargins.totalCosts.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Owed to Bradford</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Gross Profit</div>
                <div className="text-3xl font-bold text-blue-600">
                  ${metrics.profitMargins.grossProfit.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Revenue minus costs</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Profit Margin</div>
                <div className="text-3xl font-bold text-purple-600">
                  {metrics.profitMargins.profitMargin.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Gross margin</div>
              </div>
            </div>

            {/* Revenue by Customer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">JJSA Revenue</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Invoices</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {metrics.invoices.byCustomer.jjsa.count}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Amount</span>
                      <span className="text-lg font-semibold text-green-600">
                        ${metrics.invoices.byCustomer.jjsa.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-600">Paid</span>
                      <span className="text-sm font-medium text-green-600">
                        {metrics.invoices.byCustomer.jjsa.paid}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Unpaid</span>
                      <span className="text-sm font-medium text-yellow-600">
                        {metrics.invoices.byCustomer.jjsa.unpaid}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Ballantine Revenue</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Invoices</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {metrics.invoices.byCustomer.ballantine.count}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Amount</span>
                      <span className="text-lg font-semibold text-green-600">
                        ${metrics.invoices.byCustomer.ballantine.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-600">Paid</span>
                      <span className="text-sm font-medium text-green-600">
                        {metrics.invoices.byCustomer.ballantine.paid}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Unpaid</span>
                      <span className="text-sm font-medium text-yellow-600">
                        {metrics.invoices.byCustomer.ballantine.unpaid}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Orders Summary */}
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Purchase Orders</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Total POs</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {metrics.purchaseOrders.total}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Impact → Bradford</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {metrics.purchaseOrders.byCompany.impactToBradford.count}
                    </div>
                    <div className="text-sm text-gray-500">
                      ${metrics.purchaseOrders.byCompany.impactToBradford.total.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Bradford → JD Graphic</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {metrics.purchaseOrders.byCompany.bradfordToJD.count}
                    </div>
                    <div className="text-sm text-gray-500">
                      ${metrics.purchaseOrders.byCompany.bradfordToJD.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Status Summary */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Invoice Status</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Total Invoices</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {metrics.invoices.total}
                    </div>
                    <div className="text-sm text-gray-500">
                      ${metrics.invoices.totalAmount.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Paid</div>
                    <div className="text-2xl font-bold text-green-600">
                      {metrics.invoices.paid}
                    </div>
                    <div className="text-sm text-gray-500">
                      ${metrics.invoices.paidAmount.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Unpaid</div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {metrics.invoices.unpaid}
                    </div>
                    <div className="text-sm text-gray-500">
                      ${metrics.invoices.unpaidAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
