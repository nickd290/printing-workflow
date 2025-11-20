'use client';

import React, { useState, useEffect } from 'react';
import { revenueAPI, jobsAPI, purchaseOrdersAPI, invoicesAPI, reportsAPI } from '@/lib/api-client';
import { JobDetailModal } from '@/components/JobDetailModal';
import { StatsBar, type Stat } from '@/components/ui/StatsBar';
import { BradfordJobsTab } from '@/components/bradford/BradfordJobsTab';
import { BradfordPrioritySection } from '@/components/bradford/BradfordPrioritySection';
import { BradfordPOEntryModal } from '@/components/bradford/BradfordPOEntryModal';
import toast, { Toaster } from 'react-hot-toast';
import {
  ClipboardListIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  FileTextIcon,
  FileIcon,
  MailIcon
} from 'lucide-react';

interface BradfordMetrics {
  jobs: {
    total: number;
    byStatus: Record<string, number>;
  };
  revenue: {
    totalRevenue: number;
    totalMargin: number;
    marginPercent: number;
  };
  purchaseOrders: {
    total: number;
    totalAmount: number;
  };
  invoices: {
    total: number;
    totalAmount: number;
  };
  paperUsage: {
    totalWeight: number;
    jobCount: number;
  };
}

export function BradfordDashboard() {
  const [metrics, setMetrics] = useState<BradfordMetrics | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [selectedJobForPO, setSelectedJobForPO] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsData, jobsData, posData, invoicesData] = await Promise.all([
        revenueAPI.getBradfordMetrics(),
        jobsAPI.list(),
        purchaseOrdersAPI.list(),
        invoicesAPI.list(),
      ]);
      setMetrics(metricsData);

      // Show ALL jobs
      setJobs(jobsData.jobs);

      // Filter Bradford POs
      const bradfordPOs = posData.purchaseOrders.filter((po: any) =>
        po.targetCompanyId === 'bradford' || po.originCompanyId === 'bradford'
      );
      setPurchaseOrders(bradfordPOs);

      // Filter Bradford invoices
      const bradfordInvoices = invoicesData.invoices.filter((inv: any) =>
        inv.fromCompanyId === 'bradford' || inv.toCompanyId === 'bradford'
      );
      setInvoices(bradfordInvoices);

      setError(null);
    } catch (err) {
      console.error('Failed to load Bradford metrics:', err);
      setError('Failed to load dashboard metrics. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
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

  const handleCreatePO = (jobId: string) => {
    setSelectedJobForPO(jobId);
    setShowCreatePO(true);
  };

  // Calculate incoming vs outgoing PO metrics for stats bar
  const incomingPOs = purchaseOrders.filter((po: any) => po.targetCompanyId === 'bradford');
  const outgoingPOs = purchaseOrders.filter((po: any) => po.originCompanyId === 'bradford');
  const incomingPOTotal = incomingPOs.reduce((sum, po) => sum + Number(po.vendorAmount || 0), 0);
  const outgoingPOTotal = outgoingPOs.reduce((sum, po) => sum + Number(po.vendorAmount || 0), 0);
  const poMargin = incomingPOTotal - outgoingPOTotal;
  const poMarginPercent = incomingPOTotal > 0 ? (poMargin / incomingPOTotal) * 100 : 0;

  if (loading && !metrics) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  // Prepare stats for horizontal bar
  const stats: Stat[] = [
    {
      label: 'Total Jobs',
      value: metrics.jobs.total.toString(),
      icon: <ClipboardListIcon className="h-4 w-4" />,
    },
    {
      label: 'Total Revenue',
      value: `$${metrics.revenue.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      valueClassName: 'text-success',
    },
    {
      label: 'Total Margin',
      value: `$${metrics.revenue.totalMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      delta: {
        value: `${metrics.revenue.marginPercent.toFixed(1)}%`,
        type: 'neutral',
      },
    },
    {
      label: 'Incoming POs',
      value: `${incomingPOs.length} ($${(incomingPOTotal / 1000).toFixed(1)}K)`,
      icon: <ArrowLeftIcon className="h-4 w-4" />,
    },
    {
      label: 'Outgoing POs',
      value: `${outgoingPOs.length} ($${(outgoingPOTotal / 1000).toFixed(1)}K)`,
      icon: <ArrowRightIcon className="h-4 w-4" />,
    },
    {
      label: 'PO Margin',
      value: `$${Math.abs(poMargin).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      valueClassName: poMargin >= 0 ? 'text-success' : 'text-danger',
      delta: {
        value: `${poMarginPercent.toFixed(1)}%`,
        type: poMargin >= 0 ? 'positive' : 'negative',
      },
    },
    {
      label: 'Invoices',
      value: `${metrics.invoices.total} ($${(metrics.invoices.totalAmount / 1000).toFixed(1)}K)`,
      icon: <FileTextIcon className="h-4 w-4" />,
    },
    {
      label: 'Paper Usage',
      value: `${metrics.paperUsage.totalWeight.toLocaleString('en-US', { maximumFractionDigits: 0 })} lbs`,
      icon: <FileIcon className="h-4 w-4" />,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Toaster position="top-right" />

      {/* Horizontal Stats Bar */}
      <StatsBar stats={stats} />

      {/* Header with Email Report Button */}
      <div className="mt-8 px-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bradford Dashboard</h2>
          <p className="mt-1 text-sm text-gray-600">Manage jobs, purchase orders, invoices, and materials</p>
        </div>
        <button
          onClick={handleDownloadReport}
          disabled={downloading}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <MailIcon className="h-4 w-4" />
          {downloading ? 'Sending...' : 'Email Report'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 mx-8 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* Priority Section - Jobs Needing PO */}
      <div className="mt-6 mx-8">
        <BradfordPrioritySection
          jobs={jobs}
          onCreatePO={handleCreatePO}
        />

        {/* All Jobs Section */}
        <div className="mt-6">
          <h2 className="text-2xl font-bold mb-4">All Jobs ({jobs.length})</h2>
          <BradfordJobsTab
            jobs={jobs}
            onJobClick={(jobId) => setSelectedJobId(jobId)}
            onRefresh={loadData}
          />
        </div>
      </div>

      {/* Create PO Modal */}
      {showCreatePO && (
        <BradfordPOEntryModal
          jobs={jobs}
          preselectedJobId={selectedJobForPO}
          onClose={() => {
            setShowCreatePO(false);
            setSelectedJobForPO(null);
          }}
          onSuccess={() => {
            setShowCreatePO(false);
            setSelectedJobForPO(null);
            loadData();
            toast.success('Purchase order created successfully!');
          }}
        />
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
  );
}
