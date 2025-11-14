'use client';

import React, { useState, useEffect } from 'react';
import { revenueAPI, jobsAPI } from '@/lib/api-client';
import { JobDetailModal } from '@/components/JobDetailModal';

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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsData, jobsData] = await Promise.all([
        revenueAPI.getBradfordMetrics(),
        jobsAPI.list(),
      ]);
      setMetrics(metricsData);

      // Filter Bradford jobs
      const bradfordJobs = jobsData.jobs.filter((job: any) =>
        job.purchaseOrders?.some(
          (po: any) => po.targetCompany?.id === 'bradford' || po.originCompany?.id === 'bradford'
        )
      );
      setJobs(bradfordJobs);
      setError(null);
    } catch (err) {
      console.error('Failed to load Bradford metrics:', err);
      setError('Failed to load dashboard metrics. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate incoming vs outgoing PO metrics
  const incomingPOs = jobs.flatMap(job =>
    (job.purchaseOrders || []).filter((po: any) => po.targetCompany?.id === 'bradford')
  );
  const outgoingPOs = jobs.flatMap(job =>
    (job.purchaseOrders || []).filter((po: any) => po.originCompany?.id === 'bradford')
  );

  const incomingPOTotal = incomingPOs.reduce((sum, po) => sum + Number(po.vendorAmount || 0), 0);
  const outgoingPOTotal = outgoingPOs.reduce((sum, po) => sum + Number(po.vendorAmount || 0), 0);
  const poMargin = incomingPOTotal - outgoingPOTotal;
  const poMarginPercent = incomingPOTotal > 0 ? (poMargin / incomingPOTotal) * 100 : 0;

  // Group jobs by customer
  const groupedJobs = jobs.reduce((acc, job) => {
    const customerName = typeof job.customer === 'string' ? job.customer : job.customer?.name || 'Unknown';
    if (!acc[customerName]) {
      acc[customerName] = [];
    }
    acc[customerName].push(job);
    return acc;
  }, {} as Record<string, any[]>);

  // Calculate totals per customer
  const customerTotals = (Object.entries(groupedJobs) as [string, any[]][]).map(([customerName, customerJobs]) => ({
    name: customerName,
    jobCount: customerJobs.length,
    totalRevenue: customerJobs.reduce((sum, job) => sum + Number(job.bradfordTotal || 0), 0),
    totalCustomerRevenue: customerJobs.reduce((sum, job) => sum + Number(job.customerTotal || 0), 0),
    jobs: customerJobs,
  }));

  // Toggle customer expansion
  const toggleCustomer = (customerName: string) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerName)) {
        newSet.delete(customerName);
      } else {
        newSet.add(customerName);
      }
      return newSet;
    });
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
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Jobs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Jobs</p>
              <p className="text-4xl font-bold text-gray-900 mt-2">{metrics.jobs.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              {Object.entries(metrics.jobs.byStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between py-1">
                  <span className="capitalize">{status.replace(/_/g, ' ').toLowerCase()}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="text-4xl font-bold text-green-600 mt-2">
                ${metrics.revenue.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">From all Bradford jobs</p>
          </div>
        </div>

        {/* Total Margin */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Margin</p>
              <p className="text-4xl font-bold text-purple-600 mt-2">
                ${metrics.revenue.totalMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Margin: {metrics.revenue.marginPercent.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Incoming POs (from Impact Direct) */}
        <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Incoming POs</p>
              <p className="text-xs text-blue-600 mb-2">← From Impact Direct</p>
              <p className="text-4xl font-bold text-blue-600 mt-2">{incomingPOs.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-lg font-semibold text-gray-900">
              ${incomingPOTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Outgoing POs (to JD Graphic) */}
        <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Outgoing POs</p>
              <p className="text-xs text-orange-600 mb-2">→ To JD Graphic</p>
              <p className="text-4xl font-bold text-orange-600 mt-2">{outgoingPOs.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-lg font-semibold text-gray-900">
              ${outgoingPOTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* PO Margin */}
        <div className={`bg-white rounded-lg shadow-sm border p-6 ${poMargin >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">PO Margin</p>
              <p className="text-xs text-gray-500 mb-2">Incoming - Outgoing</p>
              <p className={`text-4xl font-bold mt-2 ${poMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(poMargin).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${poMargin >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <svg className={`w-6 h-6 ${poMargin >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={poMargin >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className={`text-sm font-medium ${poMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {poMargin >= 0 ? '↑' : '↓'} {poMarginPercent.toFixed(1)}% margin
            </p>
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Invoices</p>
              <p className="text-4xl font-bold text-gray-900 mt-2">{metrics.invoices.total}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Total: ${metrics.invoices.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Paper Usage */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Paper Usage</p>
              <p className="text-4xl font-bold text-gray-900 mt-2">
                {metrics.paperUsage.totalWeight.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">lbs</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Tracked in {metrics.paperUsage.jobCount} jobs
            </p>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
          <p className="text-sm text-gray-500 mt-1">Click any row to view details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer PO#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice to Impact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">JD Print Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paper Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paper (lbs)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {customerTotals.map((customer) => {
                const isExpanded = expandedCustomers.has(customer.name);
                return (
                  <React.Fragment key={customer.name}>
                    {/* Customer Header Row */}
                    <tr
                      onClick={() => toggleCustomer(customer.name)}
                      className="bg-gray-100 hover:bg-gray-200 cursor-pointer border-t-2 border-gray-300 sticky top-0 z-10"
                    >
                      <td colSpan={9} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <svg
                              className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-base font-bold text-gray-900">{customer.name}</span>
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {customer.jobCount} {customer.jobCount === 1 ? 'job' : 'jobs'}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-gray-700">
                            <div className="text-blue-600">Customer Revenue: ${customer.totalCustomerRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            <div className="text-green-600">Bradford Invoice: ${customer.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Job Rows (only visible when expanded) */}
                    {isExpanded && customer.jobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJobId(job.id);
                        }}
                        className="hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-200"
                      >
                        <td className="px-6 py-3 pl-12 whitespace-nowrap">
                          <div className="text-sm font-bold text-blue-600">{job.customerPONumber || '—'}</div>
                          <div className="text-xs text-gray-500">Job: {job.jobNo}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {job.sizeName || '—'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {job.quantity ? Number(job.quantity).toLocaleString('en-US') : '—'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-blue-600">
                          <div className="flex flex-col">
                            <span>${job.customerTotal ? Number(job.customerTotal).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                            {job.customerCPM && (
                              <span className="text-xs text-gray-500 font-normal">
                                ${Number(job.customerCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-green-600">
                          <div className="flex flex-col">
                            <span>${job.bradfordTotal ? Number(job.bradfordTotal).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                            {job.bradfordTotalCPM && (
                              <span className="text-xs text-gray-500 font-normal">
                                ${Number(job.bradfordTotalCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-orange-600">
                          <div className="flex flex-col">
                            <span>${job.jdTotal ? Number(job.jdTotal).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                            {job.printCPM && (
                              <span className="text-xs text-gray-500 font-normal">
                                ${Number(job.printCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-red-600">
                          <div className="flex flex-col">
                            <span>${job.paperCostTotal ? Number(job.paperCostTotal).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</span>
                            {job.paperCostCPM && (
                              <span className="text-xs text-gray-500 font-normal">
                                ${Number(job.paperCostCPM).toLocaleString('en-US', { minimumFractionDigits: 2 })}/M
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {job.paperWeightTotal ? Number(job.paperWeightTotal).toLocaleString('en-US', { minimumFractionDigits: 0 }) : '—'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-purple-600">
                          ${job.bradfordTotalMargin ? Number(job.bradfordTotalMargin).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
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
