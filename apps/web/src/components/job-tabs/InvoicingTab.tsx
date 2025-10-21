'use client';

import { useState } from 'react';
import { InvoiceFormModal, InvoiceFormData } from '../modals/InvoiceFormModal';

interface PurchaseOrder {
  id: string;
  originCompany: { name: string };
  targetCompany: { name: string };
  vendorAmount: number;
  status: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  fromCompany: { name: string };
  toCompany: { name: string };
  amount: number;
  status: string;
  createdAt: string;
}

interface InvoicingTabProps {
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  customerTotal: number;
  isInternalTeam?: boolean;
  jobId?: string;
  onRefresh?: () => void;
}

export function InvoicingTab({
  purchaseOrders,
  invoices,
  customerTotal,
  isInternalTeam = false,
  jobId,
  onRefresh,
}: InvoicingTabProps) {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const handleCreateInvoice = async (data: InvoiceFormData) => {
    try {
      const response = await fetch('http://localhost:3001/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          jobId: data.jobId || jobId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create invoice');

      // Upload PDF if provided
      if (data.pdfFile) {
        const invoice = await response.json();
        const formData = new FormData();
        formData.append('file', data.pdfFile);

        await fetch(`http://localhost:3001/api/invoices/${invoice.id}/upload-pdf`, {
          method: 'POST',
          body: formData,
        });
      }

      onRefresh?.();
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  };

  const handleCreatePO = async () => {
    // Placeholder - will implement PO modal similarly
    console.log('Create PO clicked');
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateMargin = (customerAmount: number, vendorAmount: number) => {
    const margin = customerAmount - vendorAmount;
    const marginPercent = ((margin / customerAmount) * 100).toFixed(1);
    return { margin, marginPercent };
  };

  return (
    <div className="space-y-8">
      {/* Purchase Order Chain */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Purchase Order Chain</h3>
          {isInternalTeam && (
            <button
              onClick={handleCreatePO}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 font-medium text-sm"
            >
              + Create Purchase Order
            </button>
          )}
        </div>

        {purchaseOrders.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No purchase orders yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Customer → First Company */}
            <div className="relative">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Customer Purchase Order</p>
                          <p className="text-xs text-gray-500">Original order from customer</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-900">${Number(customerTotal).toFixed(2)}</p>
                    <p className="text-xs text-gray-600 mt-1">Customer Total</p>
                  </div>
                </div>
              </div>

              {/* Arrow down */}
              <div className="flex justify-center py-2">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            {/* Purchase Orders in Chain */}
            {purchaseOrders.map((po, index) => {
              const vendorAmount = Number(po.vendorAmount);
              const { margin, marginPercent } = calculateMargin(customerTotal, vendorAmount);

              return (
                <div key={po.id} className="relative">
                  <div className="bg-white border-2 border-gray-300 rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-gray-900">
                              {po.originCompany.name} → {po.targetCompany.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Created {new Date(po.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="ml-13 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(po.status)}`}>
                              {po.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">${vendorAmount.toFixed(2)}</p>
                        <p className="text-xs text-gray-600 mt-1">Vendor Amount</p>

                        {/* Margin Display */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-lg font-semibold text-green-600">${margin.toFixed(2)}</p>
                          <p className="text-xs text-gray-600">Margin ({marginPercent}%)</p>
                        </div>
                      </div>
                    </div>

                    {/* PO Details Grid */}
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-gray-500">From</p>
                        <p className="text-sm font-semibold text-gray-900">{po.originCompany.name}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-gray-500">To</p>
                        <p className="text-sm font-semibold text-gray-900">{po.targetCompany.name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Arrow down (if not last) */}
                  {index < purchaseOrders.length - 1 && (
                    <div className="flex justify-center py-2">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoices Section */}
      <div className="border-t border-gray-200 pt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
          {isInternalTeam && (
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium text-sm"
            >
              + Create Invoice
            </button>
          )}
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No invoices generated yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                      <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                    </div>

                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-lg font-bold text-gray-900">{invoice.invoiceNo}</p>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                          {invoice.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {invoice.fromCompany.name} → {invoice.toCompany.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created {new Date(invoice.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">${Number(invoice.amount).toFixed(2)}</p>
                    <button className="mt-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors">
                      Download Invoice
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Card */}
      {purchaseOrders.length > 0 && (
        <div className="border-t border-gray-200 pt-8">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-sm font-medium text-gray-600 mb-1">Customer Total</p>
                <p className="text-2xl font-bold text-blue-600">${Number(customerTotal).toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-sm font-medium text-gray-600 mb-1">Vendor Cost</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${purchaseOrders.length > 0 ? Number(purchaseOrders[purchaseOrders.length - 1].vendorAmount).toFixed(2) : '0.00'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-sm font-medium text-gray-600 mb-1">Total Margin</p>
                <p className="text-2xl font-bold text-green-600">
                  ${purchaseOrders.length > 0
                    ? (customerTotal - Number(purchaseOrders[purchaseOrders.length - 1].vendorAmount)).toFixed(2)
                    : '0.00'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Form Modal */}
      <InvoiceFormModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onSubmit={handleCreateInvoice}
        jobId={jobId}
      />
    </div>
  );
}
