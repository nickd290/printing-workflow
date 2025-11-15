'use client';

import { Job } from '@printing-workflow/db';

interface BradfordOwedBreakdownModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
}

export function BradfordOwedBreakdownModal({ job, isOpen, onClose }: BradfordOwedBreakdownModalProps) {
  if (!isOpen) return null;

  const paperCost = Number(job.paperCostTotal || 0);
  const paperMarkup = Number(job.bradfordPaperMargin || 0);
  const paperBilled = Number(job.paperChargedTotal || 0);
  const jdProduction = Number(job.jdTotal || 0);
  const bradfordShare = Number(job.bradfordPrintMargin || 0);
  const impactShare = Number(job.impactMargin || 0);
  const customerTotal = Number(job.customerTotal || 0);
  const totalCosts = paperBilled + jdProduction;
  const residualMargin = bradfordShare + impactShare;
  const bradfordTotal = Number(job.bradfordTotal || 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Payment Breakdown</h2>
            <p className="text-sm text-gray-600 mt-1">Job {job.jobNo}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Total Owed Header */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-sm font-medium text-blue-900">Owed to Bradford</div>
            <div className="text-3xl font-bold text-blue-600 mt-1">{formatCurrency(bradfordTotal)}</div>
          </div>

          {/* Breakdown Header */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Breakdown of This Payment</h3>
          </div>

          {/* Paper Section */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📦</span>
              <h4 className="font-semibold text-gray-900">Paper (Bradford owns & supplies)</h4>
            </div>
            <div className="ml-8 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Paper cost:</span>
                <span className="font-medium">{formatCurrency(paperCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paper markup:</span>
                <span className="font-medium">{formatCurrency(paperMarkup)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold text-gray-900">Paper billed to Impact:</span>
                <span className="font-semibold text-blue-600">{formatCurrency(paperBilled)}</span>
              </div>
            </div>
          </div>

          {/* Production Section */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏭</span>
              <h4 className="font-semibold text-gray-900">Production (Pass-through to JD)</h4>
            </div>
            <div className="ml-8 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">JD manufacturing cost:</span>
                <span className="font-semibold text-blue-600">{formatCurrency(jdProduction)}</span>
              </div>
              <p className="text-xs text-gray-500 italic">
                (Bradford simply forwards this to JD. No markup.)
              </p>
            </div>
          </div>

          {/* Margin Split Section */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <h4 className="font-semibold text-gray-900">Margin Split (50/50)</h4>
            </div>
            <div className="ml-8 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Customer paid:</span>
                <span className="font-medium">{formatCurrency(customerTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total costs:</span>
                <span className="font-medium">{formatCurrency(totalCosts)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold text-gray-900">Residual margin:</span>
                <span className="font-semibold">{formatCurrency(residualMargin)}</span>
              </div>
              <div className="mt-3 pt-3 border-t space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bradford share (50%):</span>
                  <span className="font-medium text-green-600">{formatCurrency(bradfordShare)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Impact share (50%):</span>
                  <span className="font-medium text-green-600">{formatCurrency(impactShare)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Section */}
          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📘</span>
              <h4 className="font-semibold text-gray-900">Total Owed to Bradford</h4>
            </div>
            <div className="ml-8 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Paper billed:</span>
                <span className="font-medium">{formatCurrency(paperBilled)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">JD production:</span>
                <span className="font-medium">{formatCurrency(jdProduction)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bradford's 50% share:</span>
                <span className="font-medium">{formatCurrency(bradfordShare)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t-2 border-blue-300">
                <span className="text-lg font-bold text-gray-900">Total:</span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(bradfordTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white rounded-lg py-2 px-4 hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
