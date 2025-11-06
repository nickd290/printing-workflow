'use client';

import { useState, useEffect } from 'react';
import { InventoryManagement } from '@/components/InventoryManagement';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BradfordPaperTabProps {
  jobs: any[];
  onJobClick: (jobId: string) => void;
}

export function BradfordPaperTab({ jobs, onJobClick }: BradfordPaperTabProps) {
  const [paperData, setPaperData] = useState<any>(null);
  const [loadingPaperData, setLoadingPaperData] = useState(false);

  useEffect(() => {
    loadPaperMarginsData();
  }, []);

  const loadPaperMarginsData = async () => {
    try {
      setLoadingPaperData(true);
      const response = await fetch(`${API_URL}/api/reports/bradford/paper-margins`);
      if (!response.ok) throw new Error('Failed to fetch paper/margins data');
      const data = await response.json();
      setPaperData(data);
    } catch (err) {
      console.error('Failed to load paper/margins data:', err);
      toast.error('Failed to load paper and margins data');
    } finally {
      setLoadingPaperData(false);
    }
  };

  // Calculate paper usage stats from jobs
  const jobsWithPaper = jobs.filter((job) => job.paperWeightTotal && Number(job.paperWeightTotal) > 0);
  const totalPaperWeight = jobsWithPaper.reduce((sum, job) => sum + (Number(job.paperWeightTotal) || 0), 0);
  const averagePaperPerJob = jobsWithPaper.length > 0 ? totalPaperWeight / jobsWithPaper.length : 0;

  return (
    <div className="space-y-8">
      {/* Paper Roll Inventory Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Paper Roll Inventory</h3>
        <InventoryManagement />
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-4 bg-gray-50 text-sm font-medium text-gray-500">Paper Usage by Job</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Paper Used</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {totalPaperWeight.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">lbs</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Jobs with Paper</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{jobsWithPaper.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avg per Job</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {averagePaperPerJob.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">lbs</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Paper Usage by Job</h2>
          <p className="text-sm text-gray-500 mt-1">Click any row to view job details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paper Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Weight (lbs)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Per 1000 (lbs)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobsWithPaper
                .sort((a, b) => Number(b.paperWeightTotal) - Number(a.paperWeightTotal))
                .map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => onJobClick(job.id)}
                    className="hover:bg-orange-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {job.jobNo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {typeof job.customer === 'string' ? job.customer : job.customer?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.paperType || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-orange-600">
                      {Number(job.paperWeightTotal).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.paperWeightPer1000 ? Number(job.paperWeightPer1000).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.quantity ? Number(job.quantity).toLocaleString('en-US') : '—'}
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
          {jobsWithPaper.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4">No paper usage data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Paper & Margins Analysis */}
      {loadingPaperData ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading paper and margins analysis...</p>
        </div>
      ) : paperData && (
        <div className="space-y-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-gray-50 text-sm font-medium text-gray-500">Paper Usage & Margin Analysis</span>
            </div>
          </div>

          {/* Paper Usage by Size */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Paper Usage by Size</h3>
            <div className="space-y-3">
              {Object.entries(paperData.paperBySize || {})
                .sort(([, a]: any, [, b]: any) => b - a)
                .map(([size, quantity]: any) => {
                  const percentage = (quantity / paperData.totalPaper) * 100;
                  return (
                    <div key={size} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">{size}</span>
                        <span className="text-gray-600">{quantity.toLocaleString()} sheets ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
