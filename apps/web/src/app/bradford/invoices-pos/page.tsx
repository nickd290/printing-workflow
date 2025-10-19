'use client';

import { BradfordSidebar } from '@/components/BradfordSidebar';
import { useState, useEffect } from 'react';
import { purchaseOrdersAPI, invoicesAPI } from '@/lib/api-client';

export default function InvoicesPOsPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'pos'>('invoices');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [posData, invoicesData] = await Promise.all([
        purchaseOrdersAPI.list(),
        invoicesAPI.list(),
      ]);

      // Filter Bradford POs
      const bradfordPOs = posData.purchaseOrders.filter((po: any) =>
        po.targetCompany?.id === 'bradford' || po.originCompany?.id === 'bradford'
      );

      // Filter Bradford invoices
      const bradfordInvoices = invoicesData.invoices.filter((inv: any) =>
        inv.fromCompany?.id === 'bradford' || inv.toCompany?.id === 'bradford'
      );

      setPurchaseOrders(bradfordPOs);
      setInvoices(bradfordInvoices);
      setError(null);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load invoices and POs. Make sure the API is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const totalPOAmount = purchaseOrders.reduce((sum, po) => sum + Number(po.vendorAmount), 0);
  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');
  const unpaidInvoices = invoices.filter((inv) => inv.status !== 'PAID');

  return (
    <div className="flex h-screen bg-gray-50">
      <BradfordSidebar />

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Invoices & Purchase Orders</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track all financial documents
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

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading data...</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Invoices</p>
                      <p className="text-3xl font-bold text-indigo-600 mt-2">{invoices.length}</p>
                      <p className="text-sm text-gray-600 mt-2">
                        ${totalInvoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex gap-4 mt-2">
                        <p className="text-xs text-green-600">{paidInvoices.length} paid</p>
                        <p className="text-xs text-yellow-600">{unpaidInvoices.length} unpaid</p>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Purchase Orders</p>
                      <p className="text-3xl font-bold text-yellow-600 mt-2">{purchaseOrders.length}</p>
                      <p className="text-sm text-gray-600 mt-2">
                        ${totalPOAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                  <div className="flex">
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
                      onClick={() => setActiveTab('pos')}
                      className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                        activeTab === 'pos'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Purchase Orders ({purchaseOrders.length})
                    </button>
                  </div>
                </div>

                {/* Invoices Table */}
                {activeTab === 'invoices' && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job #</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {invoices.map((invoice) => {
                          const statusColor =
                            invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800';

                          return (
                            <tr key={invoice.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                {invoice.invoiceNo}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {invoice.job?.jobNo || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {invoice.fromCompany?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {invoice.toCompany?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                ${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                  {invoice.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(invoice.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {invoices.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <p>No invoices found</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Purchase Orders Table */}
                {activeTab === 'pos' && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO #</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {purchaseOrders.map((po) => {
                          const originalAmount = Number(po.originalAmount || 0);
                          const vendorAmount = Number(po.vendorAmount);
                          const margin = originalAmount - vendorAmount;

                          return (
                            <tr key={po.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                PO-{po.id.slice(0, 8)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {po.originCompany?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {po.targetCompany?.name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ${originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                ${vendorAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                ${margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {po.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(po.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {purchaseOrders.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <p>No purchase orders found</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
