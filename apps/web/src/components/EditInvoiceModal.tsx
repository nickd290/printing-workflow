'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoiceNo: string;
    amount: string | number;
    issuedAt: string | null;
    dueAt: string | null;
    jobId: string | null;
  };
  job?: {
    id: string;
    quantity: number | null;
    customerCPM: string | number | null;
    impactMarginCPM: string | number | null;
    bradfordTotalCPM: string | number | null;
    bradfordPrintMarginCPM: string | number | null;
    bradfordPaperMarginCPM: string | number | null;
    bradfordTotalMarginCPM: string | number | null;
    printCPM: string | number | null;
    paperCostCPM: string | number | null;
    paperChargedCPM: string | number | null;
  } | null;
  onSaved: () => void;
}

export function EditInvoiceModal({
  isOpen,
  onClose,
  invoice,
  job,
  onSaved,
}: EditInvoiceModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showCPMFields, setShowCPMFields] = useState(false);

  // Invoice fields
  const [amount, setAmount] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [dueAt, setDueAt] = useState('');

  // Job fields
  const [quantity, setQuantity] = useState('');
  const [customerCPM, setCustomerCPM] = useState('');
  const [impactMarginCPM, setImpactMarginCPM] = useState('');
  const [bradfordTotalCPM, setBradfordTotalCPM] = useState('');
  const [bradfordPrintMarginCPM, setBradfordPrintMarginCPM] = useState('');
  const [bradfordPaperMarginCPM, setBradfordPaperMarginCPM] = useState('');
  const [bradfordTotalMarginCPM, setBradfordTotalMarginCPM] = useState('');
  const [printCPM, setPrintCPM] = useState('');
  const [paperCostCPM, setPaperCostCPM] = useState('');
  const [paperChargedCPM, setPaperChargedCPM] = useState('');

  // Initialize form values when modal opens
  useEffect(() => {
    if (isOpen) {
      // Invoice fields
      setAmount(invoice.amount.toString());
      setIssuedAt(invoice.issuedAt ? invoice.issuedAt.split('T')[0] : '');
      setDueAt(invoice.dueAt ? invoice.dueAt.split('T')[0] : '');

      // Job fields (if available)
      if (job) {
        setQuantity(job.quantity?.toString() || '');
        setCustomerCPM(job.customerCPM?.toString() || '');
        setImpactMarginCPM(job.impactMarginCPM?.toString() || '');
        setBradfordTotalCPM(job.bradfordTotalCPM?.toString() || '');
        setBradfordPrintMarginCPM(job.bradfordPrintMarginCPM?.toString() || '');
        setBradfordPaperMarginCPM(job.bradfordPaperMarginCPM?.toString() || '');
        setBradfordTotalMarginCPM(job.bradfordTotalMarginCPM?.toString() || '');
        setPrintCPM(job.printCPM?.toString() || '');
        setPaperCostCPM(job.paperCostCPM?.toString() || '');
        setPaperChargedCPM(job.paperChargedCPM?.toString() || '');
      }
    }
  }, [isOpen, invoice, job]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      toast.loading('Updating invoice...', { id: 'edit-invoice' });

      // Update invoice
      const invoiceResponse = await fetch(`${API_URL}/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          issuedAt: issuedAt || undefined,
          dueAt: dueAt || undefined,
        }),
      });

      if (!invoiceResponse.ok) {
        throw new Error('Failed to update invoice');
      }

      // Update job if job data exists
      if (job && invoice.jobId) {
        const jobResponse = await fetch(`${API_URL}/api/jobs/${invoice.jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: quantity ? parseInt(quantity) : undefined,
            customerCPM: customerCPM ? parseFloat(customerCPM) : undefined,
            impactMarginCPM: impactMarginCPM ? parseFloat(impactMarginCPM) : undefined,
            bradfordTotalCPM: bradfordTotalCPM ? parseFloat(bradfordTotalCPM) : undefined,
            bradfordPrintMarginCPM: bradfordPrintMarginCPM ? parseFloat(bradfordPrintMarginCPM) : undefined,
            bradfordPaperMarginCPM: bradfordPaperMarginCPM ? parseFloat(bradfordPaperMarginCPM) : undefined,
            bradfordTotalMarginCPM: bradfordTotalMarginCPM ? parseFloat(bradfordTotalMarginCPM) : undefined,
            printCPM: printCPM ? parseFloat(printCPM) : undefined,
            paperCostCPM: paperCostCPM ? parseFloat(paperCostCPM) : undefined,
            paperChargedCPM: paperChargedCPM ? parseFloat(paperChargedCPM) : undefined,
            changedBy: 'Admin',
            changedByRole: 'BROKER_ADMIN',
          }),
        });

        if (!jobResponse.ok) {
          throw new Error('Failed to update job');
        }
      }

      toast.success('Invoice updated successfully', { id: 'edit-invoice' });
      onSaved();
      onClose();
    } catch (error) {
      console.error('Failed to update invoice:', error);
      toast.error('Failed to update invoice', { id: 'edit-invoice' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Background overlay */}
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Edit Invoice</h3>
                <p className="text-sm text-gray-600 mt-1">Invoice #{invoice.invoiceNo}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              {/* Invoice Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4">Invoice Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Issued Date
                    </label>
                    <input
                      type="date"
                      value={issuedAt}
                      onChange={(e) => setIssuedAt(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              {/* Job Section (if job exists) */}
              {job && invoice.jobId && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Job Pricing</h4>
                  <div className="space-y-4">
                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={submitting}
                      />
                    </div>

                    {/* CPM Fields - Collapsible */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowCPMFields(!showCPMFields)}
                        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${showCPMFields ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {showCPMFields ? 'Hide' : 'Show'} CPM Fields
                      </button>

                      {showCPMFields && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Customer CPM
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={customerCPM}
                              onChange={(e) => setCustomerCPM(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={submitting}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Impact Margin CPM
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={impactMarginCPM}
                              onChange={(e) => setImpactMarginCPM(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={submitting}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Bradford Total CPM
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={bradfordTotalCPM}
                              onChange={(e) => setBradfordTotalCPM(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={submitting}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Bradford Print Margin CPM
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={bradfordPrintMarginCPM}
                              onChange={(e) => setBradfordPrintMarginCPM(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={submitting}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Bradford Paper Margin CPM
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={bradfordPaperMarginCPM}
                              onChange={(e) => setBradfordPaperMarginCPM(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={submitting}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Bradford Total Margin CPM
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={bradfordTotalMarginCPM}
                              onChange={(e) => setBradfordTotalMarginCPM(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={submitting}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Print CPM
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={printCPM}
                              onChange={(e) => setPrintCPM(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={submitting}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Paper Cost CPM
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={paperCostCPM}
                              onChange={(e) => setPaperCostCPM(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={submitting}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Paper Charged CPM
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={paperChargedCPM}
                              onChange={(e) => setPaperChargedCPM(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={submitting}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
