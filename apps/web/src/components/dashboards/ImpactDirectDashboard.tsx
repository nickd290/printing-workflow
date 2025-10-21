'use client';

import { useState, useEffect } from 'react';
import { revenueAPI, jobsAPI, type POFlowMetrics } from '@/lib/api-client';
import { JobDetailModal } from '@/components/JobDetailModal';
import { MetricCard } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GenericError } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { CurrencyDollarIcon, TrendingUpIcon, ChartBarIcon, ReceiptIcon, DocumentIcon } from '@/components/ui/Icons';
import { POFlowChart } from './POFlowChart';

export function ImpactDirectDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [poFlowData, setPoFlowData] = useState<POFlowMetrics | null>(null);
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground">
                    ${Number(job.customerTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-success">
                    ${job.impactMargin ? Number(job.impactMargin).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">
                    ${job.bradfordTotal ? Number(job.bradfordTotal).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
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
    </div>
  );
}
