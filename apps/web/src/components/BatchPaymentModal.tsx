'use client';

import { useState } from 'react';

interface BatchPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (transferNumber: string, bradfordCosts: Array<{ invoiceId: string; amount: number }>) => Promise<void>;
  data: {
    customerInvoices: Array<{
      id: string;
      invoiceNo: string;
      amount: number;
      jobNo: string;
      toCompany: string;
    }>;
    totalReceived: number;
    bradfordInvoices: Array<{
      id: string;
      invoiceNo: string;
      amount: number;
      jobNo: string;
      status: string;
      dueAt: Date | null;
    }>;
    totalOwedToBradford: number;
    netProfit: number;
  } | null;
}

export function BatchPaymentModal({ isOpen, onClose, onConfirm, data }: BatchPaymentModalProps) {
  const [transferNumber, setTransferNumber] = useState('');
  const [bradfordCosts, setBradfordCosts] = useState<Array<{ invoiceId: string; amount: number }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !data) return null;

  // Initialize Bradford costs from data if not already set
  if (bradfordCosts.length === 0 && data.bradfordInvoices.length > 0) {
    setBradfordCosts(data.bradfordInvoices.map(inv => ({ invoiceId: inv.id, amount: inv.amount })));
  }

  const handleBradfordCostChange = (invoiceId: string, newAmount: number) => {
    setBradfordCosts(prev => {
      const existing = prev.find(bc => bc.invoiceId === invoiceId);
      if (existing) {
        return prev.map(bc => bc.invoiceId === invoiceId ? { ...bc, amount: newAmount } : bc);
      }
      return [...prev, { invoiceId, amount: newAmount }];
    });
  };

  const getBradfordCost = (invoiceId: string): number => {
    const cost = bradfordCosts.find(bc => bc.invoiceId === invoiceId);
    return cost?.amount ?? data.bradfordInvoices.find(inv => inv.id === invoiceId)?.amount ?? 0;
  };

  // Calculate totals with manual overrides
  const totalOwedToBradford = data.bradfordInvoices.reduce((sum, inv) => sum + getBradfordCost(inv.id), 0);
  const netProfit = data.totalReceived - totalOwedToBradford;

  const handleConfirm = async () => {
    if (!transferNumber.trim()) {
      alert('Please enter a wire/ACH transfer number');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(transferNumber, bradfordCosts);
      // Reset state after successful confirmation
      setTransferNumber('');
      setBradfordCosts([]);
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Failed to confirm payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTransferNumber('');
      setBradfordCosts([]);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Confirm Batch Payment</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Wire Transfer Number Input */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label htmlFor="transferNumber" className="block text-sm font-semibold text-gray-900 mb-2">
              Wire/ACH Transfer Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="transferNumber"
              value={transferNumber}
              onChange={(e) => setTransferNumber(e.target.value)}
              placeholder="Enter wire or ACH transfer number"
              className="w-full px-4 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-gray-600 mt-1">
              This transfer number will be included in the email notification to Bradford.
            </p>
          </div>

          {/* Customer Payments */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer Payments Received</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-600">
                    <th className="pb-2">Invoice</th>
                    <th className="pb-2">Job</th>
                    <th className="pb-2">Customer</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.customerInvoices.map((inv, idx) => (
                    <tr key={idx} className="border-t border-gray-200">
                      <td className="py-2 text-blue-600 font-medium">{inv.invoiceNo}</td>
                      <td className="py-2 text-gray-700">{inv.jobNo}</td>
                      <td className="py-2 text-gray-700">{inv.toCompany}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">
                        ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-400">
                    <td colSpan={3} className="py-2 font-bold text-gray-900">Total Received:</td>
                    <td className="py-2 text-right font-bold text-green-600 text-lg">
                      ${data.totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bradford Invoices to Pay (Editable) */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Bradford Invoices to Pay
              <span className="text-sm font-normal text-gray-600 ml-2">(amounts are editable)</span>
            </h3>
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              {data.bradfordInvoices.length === 0 ? (
                <p className="text-orange-800 text-sm">No Bradford invoices found for these jobs.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-600">
                      <th className="pb-2">Invoice</th>
                      <th className="pb-2">Job</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Due Date</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {data.bradfordInvoices.map((inv, idx) => (
                      <tr key={idx} className="border-t border-orange-200">
                        <td className="py-2 text-blue-600 font-medium">{inv.invoiceNo}</td>
                        <td className="py-2 text-gray-700">{inv.jobNo}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            inv.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            inv.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-700">
                          {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={getBradfordCost(inv.id)}
                            onChange={(e) => handleBradfordCostChange(inv.id, parseFloat(e.target.value) || 0)}
                            className="w-28 px-2 py-1 text-right border border-orange-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-semibold"
                            disabled={isSubmitting}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-orange-400">
                      <td colSpan={4} className="py-2 font-bold text-gray-900">Total Owed to Bradford:</td>
                      <td className="py-2 text-right font-bold text-orange-600 text-lg">
                        ${totalOwedToBradford.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Net Profit Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">Net Profit:</span>
              <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                ${Math.abs(netProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              This is the profit margin after paying Bradford for these jobs.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || !transferNumber.trim()}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md hover:from-blue-700 hover:to-blue-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confirm Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
