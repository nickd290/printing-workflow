'use client';

import { useState, useEffect } from 'react';
import { revenueAPI, jobsAPI } from '@/lib/api-client';
import { JobDetailModal } from '@/components/JobDetailModal';

export function ImpactDirectDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsData, jobsData] = await Promise.all([
        revenueAPI.getMetrics(),
        jobsAPI.list(),
      ]);
      setMetrics(metricsData);
      setJobs(jobsData.jobs);
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load dashboard data. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold">Error:</span> {error}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Impact Direct Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Complete operations overview
        </p>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-5 border border-green-200">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Revenue</p>
          <p className="text-3xl font-bold text-green-900 mt-2">
            ${metrics.profitMargins.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-5 border border-red-200">
          <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Costs</p>
          <p className="text-3xl font-bold text-red-900 mt-2">
            ${metrics.profitMargins.totalCosts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Profit</p>
          <p className="text-3xl font-bold text-blue-900 mt-2">
            ${metrics.profitMargins.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-5 border border-purple-200">
          <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Margin</p>
          <p className="text-3xl font-bold text-purple-900 mt-2">
            {metrics.profitMargins.profitMargin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Jobs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{jobs.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Purchase Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.purchaseOrders.total}</p>
          <p className="text-xs text-gray-500 mt-1">
            ${metrics.purchaseOrders.byCompany.impactToBradford.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} to Bradford
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Invoices</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.invoices.total}</p>
          <p className="text-xs text-green-600 mt-1">{metrics.invoices.paid} paid · </p>
          <p className="text-xs text-yellow-600">{metrics.invoices.unpaid} unpaid</p>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
          <p className="text-sm text-gray-500 mt-1">Click any row to view details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.slice(0, 20).map((job) => (
                <tr
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {job.jobNo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {typeof job.customer === 'string' ? job.customer : job.customer?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ${Number(job.customerTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    ${job.impactMargin ? Number(job.impactMargin).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {job.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No jobs found
            </div>
          )}
        </div>
      </div>

      {/* Job Detail Modal */}
      {selectedJobId && (
        <JobDetailModal
          jobId={selectedJobId}
          onClose={() => {
            setSelectedJobId(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
