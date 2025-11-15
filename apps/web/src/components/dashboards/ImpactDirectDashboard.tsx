'use client';

import { useState, useEffect } from 'react';
import { revenueAPI, jobsAPI, reportsAPI, type POFlowMetrics } from '@/lib/api-client';
import { JobDetailModal } from '@/components/JobDetailModal';
import { JobApprovalSection } from '@/components/JobApprovalSection';
import { MetricCard } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GenericError } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { CurrencyDollarIcon, TrendingUpIcon, ChartBarIcon, ReceiptIcon, DocumentIcon } from '@/components/ui/Icons';
import { POFlowChart } from './POFlowChart';
import { BradfordOwedBreakdownModal } from '@/components/BradfordOwedBreakdownModal';

export function ImpactDirectDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [poFlowData, setPoFlowData] = useState<POFlowMetrics | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [breakdownJob, setBreakdownJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsData, jobsData, poFlowMetrics] = await Promise.all([
        revenueAPI.getMetrics(),
        jobsAPI.list(),
        revenueAPI.getPOFlowMetrics(),
      ]);
      setMetrics(metricsData);
      setJobs(jobsData.jobs);
      setPoFlowData(poFlowMetrics);
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load dashboard data. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      setDownloadingReport(true);
      await reportsAPI.downloadDailySummary();
    } catch (err) {
      console.error('Failed to download report:', err);
      alert('Failed to download report. Please try again.');
    } finally {
      setDownloadingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return <GenericError onRetry={loadData} description={error} />;
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Impact Direct Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete operations overview
          </p>
        </div>
        <button
          onClick={handleDownloadReport}
          disabled={downloadingReport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {downloadingReport ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <DocumentIcon className="w-5 h-5" />
              <span>Download Daily Report</span>
            </>
          )}
        </button>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Revenue"
          value={`$${metrics.profitMargins.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          variant="success"
          icon={
            <div className="w-12 h-12 rounded-full bg-success-light flex items-center justify-center">
              <CurrencyDollarIcon className="w-6 h-6 text-success" />
            </div>
          }
        />
        <MetricCard
          title="Costs"
          value={`$${metrics.profitMargins.totalCosts.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          variant="danger"
          icon={
            <div className="w-12 h-12 rounded-full bg-danger-light flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-danger" />
            </div>
          }
        />
        <MetricCard
          title="Profit"
          value={`$${metrics.profitMargins.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          variant="info"
          icon={
            <div className="w-12 h-12 rounded-full bg-info-light flex items-center justify-center">
              <TrendingUpIcon className="w-6 h-6 text-info" />
            </div>
          }
        />
        <MetricCard
          title="Margin"
          value={`${metrics.profitMargins.profitMargin.toFixed(1)}%`}
          variant="default"
          icon={
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-foreground" />
            </div>
          }
        />
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Total Jobs"
          value={jobs.length}
          icon={
            <div className="w-12 h-12 rounded-full bg-info-light flex items-center justify-center">
              <DocumentIcon className="w-6 h-6 text-info" />
            </div>
          }
        />
        <MetricCard
          title="Pending Proofs"
          value={jobs.filter(job => job.proofs?.some((proof: any) => proof.status === 'PENDING')).length}
          description="Awaiting customer approval"
          icon={
            <div className="w-12 h-12 rounded-full bg-warning-light flex items-center justify-center">
              <DocumentIcon className="w-6 h-6 text-warning" />
            </div>
          }
        />
        <MetricCard
          title="In Production"
          value={jobs.filter(job => job.status === 'IN_PRODUCTION').length}
          description="Currently being produced"
          icon={
            <div className="w-12 h-12 rounded-full bg-info-light flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-info" />
            </div>
          }
        />
        <MetricCard
          title="Revenue MTD"
          value={`$${metrics.profitMargins.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          description="Month to date"
          variant="success"
          icon={
            <div className="w-12 h-12 rounded-full bg-success-light flex items-center justify-center">
              <TrendingUpIcon className="w-6 h-6 text-success" />
            </div>
          }
        />
      </div>

      {/* Jobs Requiring Approval */}
      <JobApprovalSection onJobUpdated={loadData} />

      {/* PO Flow Chart */}
      {poFlowData && <POFlowChart data={poFlowData} />}

      {/* Jobs Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Recent Jobs</h2>
          <p className="text-sm text-muted-foreground mt-1">Click any row to view details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer PO#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Job #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Margin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Owed to Bradford</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {jobs.slice(0, 20).map((job) => (
                <tr
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className="table-row cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                    {job.customerPONumber || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.jobNo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {typeof job.customer === 'string' ? job.customer : job.customer?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {job.sizeName || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {job.quantity ? Number(job.quantity).toLocaleString('en-US') : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground">
                    <div className="flex flex-col">
                      <span>${Number(job.customerTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      {job.customerCPM && (
                        <span className="text-xs text-gray-500 font-normal">
                          ${Number(job.customerCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-success">
                    <div className="flex flex-col">
                      <span>${job.impactMargin ? Number(job.impactMargin).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                      {job.impactMarginCPM && (
                        <span className="text-xs text-gray-500 font-normal">
                          ${Number(job.impactMarginCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600 cursor-help hover:bg-orange-50 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBreakdownJob(job);
                    }}
                    title="Click to see breakdown"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span>${job.bradfordTotal ? Number(job.bradfordTotal).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                        <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      {job.bradfordTotalCPM && (
                        <span className="text-xs text-gray-500 font-normal">
                          ${Number(job.bradfordTotalCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length === 0 && (
            <div className="empty-state">
              <p className="text-muted-foreground">No jobs found</p>
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

      {/* Bradford Owed Breakdown Modal */}
      {breakdownJob && (
        <BradfordOwedBreakdownModal
          job={breakdownJob}
          isOpen={true}
          onClose={() => setBreakdownJob(null)}
        />
      )}
    </div>
  );
}
