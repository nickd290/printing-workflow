'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { revenueAPI, jobsAPI, reportsAPI, type POFlowMetrics } from '@/lib/api-client';
import { JobDetailModal } from '@/components/JobDetailModal';
import { JobApprovalSection } from '@/components/JobApprovalSection';
import { StatsBar, type Stat } from '@/components/ui/StatsBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GenericError } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import {
  CurrencyDollarIcon,
  TrendingUpIcon,
  ChartBarIcon,
  DocumentIcon,
  ReceiptIcon
} from '@/components/ui/Icons';
import { ClipboardList as ClipboardListIcon, FileText as FileTextIcon } from 'lucide-react';
import { POFlowChart } from './POFlowChart';
import { BradfordOwedBreakdownModal } from '@/components/BradfordOwedBreakdownModal';

export function ImpactDirectDashboard() {
  const router = useRouter();
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

  // Prepare stats for horizontal bar
  const pendingProofs = jobs.filter(job => job.proofs?.some((proof: any) => proof.status === 'PENDING')).length;
  const inProduction = jobs.filter(job => job.status === 'IN_PRODUCTION').length;

  const stats: Stat[] = [
    {
      label: 'Revenue',
      value: `$${metrics.profitMargins.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: <CurrencyDollarIcon className="h-4 w-4" />,
      valueClassName: 'text-success',
    },
    {
      label: 'Costs',
      value: `$${metrics.profitMargins.totalCosts.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: <ChartBarIcon className="h-4 w-4" />,
      valueClassName: 'text-danger',
    },
    {
      label: 'Profit',
      value: `$${metrics.profitMargins.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: <TrendingUpIcon className="h-4 w-4" />,
      valueClassName: 'text-info',
    },
    {
      label: 'Margin',
      value: `${metrics.profitMargins.profitMargin.toFixed(1)}%`,
      icon: <ChartBarIcon className="h-4 w-4" />,
      delta: {
        value: metrics.profitMargins.profitMargin >= 20 ? 'Healthy' : 'Monitor',
        type: metrics.profitMargins.profitMargin >= 20 ? 'positive' : 'neutral',
      },
    },
    {
      label: 'Total Jobs',
      value: jobs.length.toString(),
      icon: <ClipboardListIcon className="h-4 w-4" />,
    },
    {
      label: 'Pending Proofs',
      value: pendingProofs.toString(),
      icon: <FileTextIcon className="h-4 w-4" />,
      valueClassName: pendingProofs > 0 ? 'text-warning' : '',
    },
    {
      label: 'In Production',
      value: inProduction.toString(),
      icon: <ChartBarIcon className="h-4 w-4" />,
      valueClassName: 'text-info',
    },
    {
      label: 'Revenue MTD',
      value: `$${(metrics.profitMargins.totalRevenue / 1000).toFixed(1)}K`,
      icon: <TrendingUpIcon className="h-4 w-4" />,
      valueClassName: 'text-success',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page Header */}
      <PageHeader
        title="Impact Direct Dashboard"
        subtitle="Complete operations overview"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/jobs/create')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create New Job</span>
            </button>
            <button
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {downloadingReport ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <DocumentIcon className="w-4 h-4" />
                  <span>Download Daily Report</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Horizontal Stats Bar */}
      <StatsBar stats={stats} />

      {/* Jobs Requiring Approval */}
      <JobApprovalSection onJobUpdated={loadData} />

      {/* PO Flow Chart */}
      {poFlowData && <POFlowChart data={poFlowData} />}

      {/* Recent Jobs Table */}
      <div className="mt-8 px-8">
        <div className="section-header">
          <h2 className="section-title">Recent Jobs</h2>
          <p className="text-sm text-muted-foreground">Click any row to view details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="minimal-table">
            <thead>
              <tr>
                <th>Customer PO#</th>
                <th>Job #</th>
                <th>Customer</th>
                <th>Size</th>
                <th>Quantity</th>
                <th>Total</th>
                <th>Margin</th>
                <th>Owed to Bradford</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {jobs.slice(0, 20).map((job) => (
                <tr
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className="hover:bg-[#FAFAFC] cursor-pointer transition-colors border-b border-border"
                >
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-primary">
                    {job.customerPONumber || '—'}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-foreground font-semibold">
                    {job.jobNo}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-foreground">
                    {typeof job.customer === 'string' ? job.customer : job.customer?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-foreground">
                    {job.sizeName || '—'}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-foreground">
                    {job.quantity ? Number(job.quantity).toLocaleString('en-US') : '—'}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                    <div className="flex flex-col">
                      <span>${Number(job.customerTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      {job.customerCPM && (
                        <span className="text-sm text-data-label font-normal">
                          ${Number(job.customerCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-success">
                    <div className="flex flex-col">
                      <span>${job.impactMargin ? Number(job.impactMargin).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                      {job.impactMarginCPM && (
                        <span className="text-sm text-data-label font-normal">
                          ${Number(job.impactMarginCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="px-6 py-3 whitespace-nowrap text-sm font-medium text-warning cursor-help hover:bg-warning/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBreakdownJob(job);
                    }}
                    title="Click to see breakdown"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span>${job.bradfordTotal ? Number(job.bradfordTotal).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                        <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      {job.bradfordTotalCPM && (
                        <span className="text-sm text-data-label font-normal">
                          ${Number(job.bradfordTotalCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-foreground">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
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
