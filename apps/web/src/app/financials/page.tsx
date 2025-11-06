'use client';

import { Navigation } from '@/components/navigation';
import { JobFinancialRow } from '@/components/financials/JobFinancialRow';
import toast, { Toaster } from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import { revenueAPI, jobsAPI } from '@/lib/api-client';
import { useUser } from '@/contexts/UserContext';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function FinancialsPage() {
  const { user, isCustomer, isBrokerAdmin, isBradfordAdmin } = useUser();
  const router = useRouter();
  const [metrics, setMetrics] = useState<any>(null);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter jobs based on user role
  const filteredJobs = useMemo(() => {
    if (!user) return allJobs; // Show all jobs if no user (dev mode)
    if (isBrokerAdmin) return allJobs;
    if (isCustomer) {
      return allJobs.filter((job) => {
        const customerId = typeof job.customer === 'string' ? job.customer : job.customer?.id;
        return customerId === user.companyId;
      });
    }
    if (isBradfordAdmin) {
      return allJobs.filter((job) =>
        job.purchaseOrders?.some((po: any) =>
          po.targetCompany?.id === 'bradford' || po.originCompany?.id === 'bradford'
        )
      );
    }
    return allJobs;
  }, [allJobs, user, isCustomer, isBrokerAdmin, isBradfordAdmin]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [metricsData, jobsData] = await Promise.all([
        revenueAPI.getMetrics(),
        jobsAPI.list(),
      ]);
      setMetrics(metricsData);
      setAllJobs(jobsData.jobs);
      setError(null);
    } catch (err) {
      console.error('Failed to load financials:', err);
      setError('Failed to load financial data. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewJob = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  const handleMarkInvoicePaid = async (invoiceId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark invoice as paid');
      }

      toast.success('Invoice marked as paid');
      await loadAllData();
    } catch (error) {
      console.error('Failed to mark invoice paid:', error);
      toast.error('Failed to mark invoice as paid');
    }
  };

  const handleExportCSV = () => {
    window.open(`${API_URL}/api/exports/jobs`, '_blank');
  };

  const handleInvoiceSelectionChange = (invoiceId: string, selected: boolean) => {
    setSelectedInvoiceIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(invoiceId);
      } else {
        newSet.delete(invoiceId);
      }
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedInvoiceIds(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading financial data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isCustomer ? 'My Invoices' : 'Financials'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isCustomer
              ? 'View and track your invoices from Impact Direct'
              : 'Job-by-job financial breakdown with invoices and purchase orders'}
          </p>
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

        {metrics && !isCustomer && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Total Revenue</div>
                <div className="text-3xl font-bold text-green-600">
                  ${metrics.profitMargins.totalRevenue.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Customer payments</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Total Costs</div>
                <div className="text-3xl font-bold text-red-600">
                  ${metrics.profitMargins.totalCosts.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Vendor payments</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Gross Margin</div>
                <div className="text-3xl font-bold text-blue-600">
                  ${metrics.profitMargins.grossProfit.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Total profit</div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm font-medium text-gray-500 mb-1">Margin %</div>
                <div className="text-3xl font-bold text-purple-600">
                  {metrics.profitMargins.profitMargin.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Average margin</div>
              </div>
            </div>

            {/* Jobs List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">All Jobs</h2>
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Export to CSV
                  </button>
                </div>

                {filteredJobs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No jobs found</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {filteredJobs.map((job) => (
                      <JobFinancialRow
                        key={job.id}
                        job={job}
                        onViewJob={handleViewJob}
                        onMarkInvoicePaid={handleMarkInvoicePaid}
                        selectedInvoiceIds={selectedInvoiceIds}
                        onInvoiceSelectionChange={handleInvoiceSelectionChange}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Customer View - Simple Invoice List */}
        {isCustomer && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Invoices</h2>
              {filteredJobs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No invoices found</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {filteredJobs.map((job) => (
                    <JobFinancialRow
                      key={job.id}
                      job={job}
                      onViewJob={handleViewJob}
                      onMarkInvoicePaid={handleMarkInvoicePaid}
                      selectedInvoiceIds={selectedInvoiceIds}
                      onInvoiceSelectionChange={handleInvoiceSelectionChange}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Action Bar for Batch Operations */}
        {selectedInvoiceIds.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-2xl border-t-4 border-blue-500 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                {/* Left: Selection Count */}
                <div className="flex items-center gap-4">
                  <div className="bg-white bg-opacity-20 rounded-full px-4 py-2">
                    <span className="font-bold text-lg">{selectedInvoiceIds.size}</span>
                    <span className="ml-2 text-sm">invoice{selectedInvoiceIds.size !== 1 ? 's' : ''} selected</span>
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClearSelection}
                    className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-md transition-all font-medium text-sm"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Open EntityBatchPaymentModal
                      toast('Batch payment modal coming soon!');
                    }}
                    className="px-6 py-2 bg-white text-blue-700 rounded-md hover:bg-gray-100 transition-all font-bold text-sm shadow-lg flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Batch by Entity
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
