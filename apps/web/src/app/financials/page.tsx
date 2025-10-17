'use client';

import { Navigation } from '@/components/navigation';
import { useState, useEffect, useMemo } from 'react';
import { revenueAPI, jobsAPI, purchaseOrdersAPI, invoicesAPI } from '@/lib/api-client';
import { useUser } from '@/contexts/UserContext';

export default function FinancialsPage() {
  const { user, isCustomer, isBrokerAdmin, isManager, isBradfordAdmin } = useUser();
  const [metrics, setMetrics] = useState<any>(null);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [allPurchaseOrders, setAllPurchaseOrders] = useState<any[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'jobs' | 'pos' | 'invoices'>('jobs');

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter data based on user role
  const filteredJobs = useMemo(() => {
    if (!user) return [];
    if (isBrokerAdmin || isManager) return allJobs;
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
  }, [allJobs, user, isCustomer, isBrokerAdmin, isManager, isBradfordAdmin]);

  const filteredPurchaseOrders = useMemo(() => {
    if (!user) return [];
    if (isBrokerAdmin || isManager) return allPurchaseOrders;
    if (isCustomer) {
      // Customers don't see POs
      return [];
    }
    if (isBradfordAdmin) {
      return allPurchaseOrders.filter((po) =>
        po.targetCompany?.id === 'bradford' || po.originCompany?.id === 'bradford'
      );
    }
    return allPurchaseOrders;
  }, [allPurchaseOrders, user, isCustomer, isBrokerAdmin, isManager, isBradfordAdmin]);

  const filteredInvoices = useMemo(() => {
    if (!user) return [];
    if (isBrokerAdmin || isManager) return allInvoices;
    if (isCustomer) {
      // Customers see only invoices to them
      return allInvoices.filter((inv) => inv.toCompany?.id === user.companyId);
    }
    if (isBradfordAdmin) {
      // Bradford sees invoices from/to Bradford
      return allInvoices.filter((inv) =>
        inv.fromCompany?.id === 'bradford' || inv.toCompany?.id === 'bradford'
      );
    }
    return allInvoices;
  }, [allInvoices, user, isCustomer, isBrokerAdmin, isManager, isBradfordAdmin]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [metricsData, jobsData, posData, invoicesData] = await Promise.all([
        revenueAPI.getMetrics(),
        jobsAPI.list(),
        purchaseOrdersAPI.list(),
        invoicesAPI.list(),
      ]);
      setMetrics(metricsData);
      setAllJobs(jobsData.jobs);
      setAllPurchaseOrders(posData.purchaseOrders);
      setAllInvoices(invoicesData.invoices);
      setError(null);
    } catch (err) {
      console.error('Failed to load financials:', err);
      setError('Failed to load financial data. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    // Simple CSV export - you can enhance this as needed
    const headers = Object.keys(data[0] || {});
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h])).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getCustomerName = (customer: any): string => {
    if (typeof customer === 'string') return customer;
    return customer?.name || 'Unknown';
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isCustomer ? 'My Invoices' : 'Financials'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isCustomer
              ? 'View and track your invoices from Impact Direct'
              : 'Complete financial overview with revenue, costs, and margins'}
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
            {/* Summary Cards - Hidden for customers */}
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

            {/* View Tabs - Simplified for customers */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              {!isCustomer && (
                <div className="border-b border-gray-200">
                  <div className="flex">
                    <button
                      onClick={() => setActiveView('jobs')}
                      className={`px-6 py-3 font-medium text-sm border-b-2 ${
                        activeView === 'jobs'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Jobs Financial Breakdown
                    </button>
                    <button
                      onClick={() => setActiveView('pos')}
                      className={`px-6 py-3 font-medium text-sm border-b-2 ${
                        activeView === 'pos'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Purchase Orders
                    </button>
                    <button
                      onClick={() => setActiveView('invoices')}
                      className={`px-6 py-3 font-medium text-sm border-b-2 ${
                        activeView === 'invoices'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Invoices
                    </button>
                  </div>
                </div>
              )}

              {/* Jobs Table - Hidden for customers */}
              {!isCustomer && activeView === 'jobs' && (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Complete Job Financials</h2>
                    <button
                      onClick={() => exportToCSV(filteredJobs.map(job => ({
                        jobNo: job.jobNo,
                        customer: getCustomerName(job.customer),
                        customerTotal: job.customerTotal,
                        bradfordCost: job.customerTotal * 0.8,
                        margin: job.customerTotal * 0.2,
                        marginPercent: '20%',
                        status: job.status,
                        date: new Date(job.createdAt).toLocaleDateString(),
                      })), 'job-financials.csv')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Export to CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Total</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bradford Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin %</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredJobs.map((job) => {
                          const customerTotal = Number(job.customerTotal);
                          const bradfordCost = customerTotal * 0.8;
                          const margin = customerTotal * 0.2;
                          const marginPercent = 20;

                          return (
                            <tr key={job.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 text-sm font-medium text-blue-600">{job.jobNo}</td>
                              <td className="px-4 py-4 text-sm text-gray-900">{getCustomerName(job.customer)}</td>
                              <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                                ${customerTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-4 text-sm text-red-600">
                                ${bradfordCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-4 text-sm font-medium text-green-600">
                                ${margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-900">{marginPercent}%</td>
                              <td className="px-4 py-4">
                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {job.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-500">
                                {new Date(job.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-gray-50 font-bold">
                          <td colSpan={2} className="px-4 py-4 text-sm text-gray-900">TOTALS</td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            ${filteredJobs.reduce((sum, job) => sum + Number(job.customerTotal), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-4 text-sm text-red-600">
                            ${filteredJobs.reduce((sum, job) => sum + (Number(job.customerTotal) * 0.8), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-4 text-sm text-green-600">
                            ${filteredJobs.reduce((sum, job) => sum + (Number(job.customerTotal) * 0.2), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Purchase Orders Table - Hidden for customers */}
              {!isCustomer && activeView === 'pos' && (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">All Purchase Orders</h2>
                    <button
                      onClick={() => exportToCSV(filteredPurchaseOrders.map(po => ({
                        poNumber: po.id,
                        from: po.originCompany.name,
                        to: po.targetCompany.name,
                        originalAmount: po.originalAmount,
                        vendorAmount: po.vendorAmount,
                        margin: (po.originalAmount || 0) - po.vendorAmount,
                        status: po.status,
                        date: new Date(po.createdAt).toLocaleDateString(),
                      })), 'purchase-orders.csv')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Export to CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredPurchaseOrders.map((po) => {
                          const originalAmount = Number(po.originalAmount || 0);
                          const vendorAmount = Number(po.vendorAmount);
                          const margin = originalAmount - vendorAmount;

                          return (
                            <tr key={po.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 text-sm font-medium text-gray-900">PO-{po.id.slice(0, 8)}</td>
                              <td className="px-4 py-4 text-sm text-gray-900">{po.originCompany.name}</td>
                              <td className="px-4 py-4 text-sm text-gray-900">{po.targetCompany.name}</td>
                              <td className="px-4 py-4 text-sm text-gray-900">
                                ${originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                                ${vendorAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-4 text-sm font-medium text-green-600">
                                ${margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-4">
                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {po.status}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-500">
                                {new Date(po.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Invoices Table */}
              {(isCustomer || activeView === 'invoices') && (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {isCustomer ? 'Your Invoices' : 'All Invoices'}
                    </h2>
                    <button
                      onClick={() => exportToCSV(filteredInvoices.map(inv => ({
                        invoiceNo: inv.invoiceNo,
                        jobNo: inv.job?.jobNo || 'N/A',
                        from: inv.fromCompany.name,
                        to: inv.toCompany?.name || 'Customer',
                        amount: inv.amount,
                        status: inv.status,
                        date: new Date(inv.createdAt).toLocaleDateString(),
                      })), 'invoices.csv')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Export to CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                          {!isCustomer && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>}
                          {!isCustomer && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PDF</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredInvoices.map((invoice) => {
                          const amount = Number(invoice.amount);
                          const statusColor =
                            invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800';

                          return (
                            <tr key={invoice.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 text-sm font-medium text-blue-600">{invoice.invoiceNo}</td>
                              <td className="px-4 py-4 text-sm text-gray-900">{invoice.job?.jobNo || 'N/A'}</td>
                              {!isCustomer && <td className="px-4 py-4 text-sm text-gray-900">{invoice.fromCompany.name}</td>}
                              {!isCustomer && <td className="px-4 py-4 text-sm text-gray-900">{invoice.toCompany?.name || 'Customer'}</td>}
                              <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                                ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                  {invoice.status}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-500">
                                {new Date(invoice.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-4 text-sm">
                                {invoice.pdfUrl ? (
                                  <button className="text-blue-600 hover:text-blue-800 font-medium">
                                    Download
                                  </button>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
