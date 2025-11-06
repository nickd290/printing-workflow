'use client';

import { useState, useEffect } from 'react';
import { BradfordSidebar } from '@/components/BradfordSidebar';
import { BradfordMetricsCards } from '@/components/bradford/BradfordMetricsCards';
import { BradfordJobsTab } from '@/components/bradford/BradfordJobsTab';
import { BradfordPOsTab } from '@/components/bradford/BradfordPOsTab';
import { BradfordInvoicesTab } from '@/components/bradford/BradfordInvoicesTab';
import { BradfordPaperTab } from '@/components/bradford/BradfordPaperTab';
import { JobDetailModal } from '@/components/JobDetailModal';
import { jobsAPI, purchaseOrdersAPI, invoicesAPI, reportsAPI } from '@/lib/api-client';
import toast, { Toaster } from 'react-hot-toast';

type TabType = 'jobs' | 'pos' | 'invoices' | 'paper';

export default function BradfordDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [metrics, setMetrics] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsData, jobsData, posData, invoicesData] = await Promise.all([
        reportsAPI.getBradfordDashboardMetrics(),
        jobsAPI.list(),
        purchaseOrdersAPI.list(),
        invoicesAPI.list(),
      ]);

      // Show ALL jobs (filtering happens in BradfordJobsTab based on "Needs PO Only" toggle)
      const bradfordJobs = jobsData.jobs;

      const bradfordPOs = posData.purchaseOrders.filter((po: any) =>
        po.targetCompanyId === 'bradford' || po.originCompanyId === 'bradford'
      );

      const bradfordInvoices = invoicesData.invoices.filter((inv: any) =>
        inv.fromCompanyId === 'bradford' || inv.toCompanyId === 'bradford'
      );

      setMetrics(metricsData);
      setJobs(bradfordJobs);
      setPurchaseOrders(bradfordPOs);
      setInvoices(bradfordInvoices);
      setError(null);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load dashboard data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadPaperMarginsData = async () => {
    try {
      const data = await reportsAPI.getBradfordPaperMargins();
      return data;
    } catch (err) {
      console.error('Failed to load paper/margins data:', err);
      toast.error('Failed to load paper and margins data');
      throw err;
    }
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const result = await reportsAPI.exportBradfordReport();
      if (result.success) {
        toast.success('Report emailed to Steve Gustafson and Nick successfully!');
      } else {
        throw new Error(result.error || 'Failed to email report');
      }
    } catch (err) {
      console.error('Error emailing report:', err);
      toast.error('Failed to email report');
    } finally {
      setDownloading(false);
    }
  };

  const totalPOAmount = purchaseOrders.reduce((sum, po) => sum + Number(po.vendorAmount), 0);
  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

  return (
    <div className="flex h-screen bg-gray-50">
      <BradfordSidebar />
      <Toaster position="top-right" />

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Bradford Dashboard</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage jobs, purchase orders, invoices, and materials
              </p>
            </div>
            <button
              onClick={handleDownloadReport}
              disabled={downloading}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {downloading ? 'Sending...' : 'Email Report'}
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

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading dashboard...</p>
            </div>
          ) : (
            <>
              {/* Metrics Cards */}
              {metrics && (
                <BradfordMetricsCards
                  activeJobsCount={metrics.activeJobsCount}
                  jobsNeedingPOCount={metrics.jobsNeedingPOCount}
                  currentMonthMargin={metrics.currentMonthMargin}
                  currentMonthPaperUsage={metrics.currentMonthPaperUsage}
                  onNeedsPOClick={() => setActiveTab('jobs')}
                />
              )}

              {/* Tabs Navigation */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                <div className="border-b border-gray-200">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab('jobs')}
                      className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                        activeTab === 'jobs'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Jobs ({jobs.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('pos')}
                      className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                        activeTab === 'pos'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Purchase Orders ({purchaseOrders.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('invoices')}
                      className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                        activeTab === 'invoices'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Invoices ({invoices.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('paper')}
                      className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                        activeTab === 'paper'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Paper & Materials
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'jobs' && (
                    <BradfordJobsTab
                      jobs={jobs}
                      onJobClick={(jobId) => setSelectedJobId(jobId)}
                      onRefresh={loadData}
                    />
                  )}

                  {activeTab === 'pos' && (
                    <BradfordPOsTab
                      purchaseOrders={purchaseOrders}
                      jobs={jobs}
                      onRefresh={loadData}
                    />
                  )}

                  {activeTab === 'invoices' && (
                    <BradfordInvoicesTab
                      invoices={invoices}
                      onRefresh={loadData}
                    />
                  )}

                  {activeTab === 'paper' && (
                    <BradfordPaperTab
                      jobs={jobs}
                      onJobClick={(jobId) => setSelectedJobId(jobId)}
                    />
                  )}
                </div>
              </div>
            </>
          )}

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
      </div>
    </div>
  );
}
