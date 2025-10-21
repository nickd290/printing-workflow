'use client';

import { useState } from 'react';
import { InvoiceStatus } from '@printing-workflow/db';
import { COMPANY_IDS } from '@printing-workflow/shared';

interface Company {
  id: string;
  name: string;
}

interface InvoiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InvoiceFormData) => Promise<void>;
  jobId?: string;
  companies?: Company[];
}

export interface InvoiceFormData {
  jobId?: string;
  fromCompanyId: string;
  toCompanyId: string;
  amount: number;
  status: InvoiceStatus;
  dueAt?: string;
  issuedAt?: string;
  pdfFile?: File;
}

const INVOICE_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// Default companies using COMPANY_IDS constants
const DEFAULT_COMPANIES = [
  { id: COMPANY_IDS.IMPACT_DIRECT, name: 'Impact Direct' },
  { id: COMPANY_IDS.BRADFORD, name: 'Bradford & Company' },
  { id: COMPANY_IDS.JD_GRAPHIC, name: 'JD Graphic' },
  { id: COMPANY_IDS.JJSA, name: 'JJSA' },
  { id: COMPANY_IDS.BALLANTINE, name: 'Ballantine' },
];

export function InvoiceFormModal({
  isOpen,
  onClose,
  onSubmit,
  jobId,
  companies = DEFAULT_COMPANIES,
}: InvoiceFormModalProps) {
  const [formData, setFormData] = useState<InvoiceFormData>({
    jobId,
    fromCompanyId: '',
    toCompanyId: '',
    amount: 0,
    status: 'DRAFT' as InvoiceStatus,
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const submitData = { ...formData };
      if (pdfFile) {
        submitData.pdfFile = pdfFile;
      }
      await onSubmit(submitData);
      handleClose();
    } catch (error) {
      console.error('Error creating invoice:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      jobId,
      fromCompanyId: '',
      toCompanyId: '',
      amount: 0,
      status: 'DRAFT' as InvoiceStatus,
    });
    setPdfFile(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Create Invoice</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            type="button"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* From Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Company (Issuer) *
            </label>
            <select
              required
              value={formData.fromCompanyId}
              onChange={(e) => setFormData({ ...formData, fromCompanyId: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select company...</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          {/* To Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Company (Recipient) *
            </label>
            <select
              required
              value={formData.toCompanyId}
              onChange={(e) => setFormData({ ...formData, toCompanyId: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select company...</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as InvoiceStatus })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {INVOICE_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Issue Date
              </label>
              <input
                type="date"
                value={formData.issuedAt || ''}
                onChange={(e) => setFormData({ ...formData, issuedAt: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueAt || ''}
                onChange={(e) => setFormData({ ...formData, dueAt: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* PDF Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload PDF (Optional)
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {pdfFile && (
              <p className="mt-1 text-sm text-gray-500">Selected: {pdfFile.name}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
