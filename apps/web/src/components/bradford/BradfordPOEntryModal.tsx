'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { purchaseOrdersAPI } from '@/lib/api-client';

interface Job {
  id: string;
  jobNo: string;
  customerPONumber?: string;
  jdTotal?: number;
  purchaseOrders?: Array<{
    id: string;
    originCompanyId: string;
    targetCompanyId: string;
    vendorAmount: number;
  }>;
}

interface BradfordPOEntryModalProps {
  jobs: Job[];
  preselectedJobId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function BradfordPOEntryModal({ jobs, preselectedJobId, onClose, onSuccess }: BradfordPOEntryModalProps) {
  const [selectedJobId, setSelectedJobId] = useState(preselectedJobId || '');
  const [bradfordPONumber, setBradfordPONumber] = useState('');
  const [vendorAmount, setVendorAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Update selectedJobId if preselectedJobId changes
  useEffect(() => {
    if (preselectedJobId) {
      setSelectedJobId(preselectedJobId);
    }
  }, [preselectedJobId]);

  // Filter jobs to only show those that:
  // 1. Have an incoming PO from Impact Direct to Bradford
  // 2. DON'T have an outgoing PO from Bradford to JD Graphic
  const availableJobs = jobs.filter((job) => {
    const hasIncomingPO = job.purchaseOrders?.some(
      (po) => po.targetCompanyId === 'bradford'
    );
    const hasOutgoingPO = job.purchaseOrders?.some(
      (po) => po.originCompanyId === 'bradford'
    );
    return hasIncomingPO && !hasOutgoingPO;
  });

  // Filter jobs based on search term
  const filteredJobs = availableJobs.filter((job) => {
    const term = searchTerm.toLowerCase();
    return (
      job.jobNo.toLowerCase().includes(term) ||
      job.customerPONumber?.toLowerCase().includes(term) ||
      ''
    );
  });

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const incomingPO = selectedJob?.purchaseOrders?.find((po) => po.targetCompanyId === 'bradford');
  const originalAmount = incomingPO ? Number(incomingPO.vendorAmount) : 0;
  const outgoingAmount = vendorAmount ? parseFloat(vendorAmount) : 0;
  const margin = originalAmount - outgoingAmount;

  const handleSubmit = async () => {
    if (!selectedJobId) {
      toast.error('Please select a job');
      return;
    }

    if (!bradfordPONumber.trim()) {
      toast.error('Please enter the Bradford PO number');
      return;
    }

    if (!vendorAmount || parseFloat(vendorAmount) <= 0) {
      toast.error('Please enter a valid vendor amount');
      return;
    }

    setSaving(true);
    try {
      await purchaseOrdersAPI.create({
        originCompanyId: 'bradford',
        targetCompanyId: 'jd-graphic',
        jobId: selectedJobId,
        originalAmount,
        vendorAmount: parseFloat(vendorAmount),
        marginAmount: margin,
        externalRef: bradfordPONumber,
      });

      toast.success('Bradford→JD Graphic PO created successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to create PO:', error);
      toast.error(error.message || 'Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-green-600 to-green-700">
          <h2 className="text-xl font-bold text-white">Create Bradford→JD Graphic PO</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Job Search/Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search & Select Job <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by job# or customer PO#..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
            />
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">-- Select a job --</option>
              {filteredJobs.map((job) => {
                const incomingPO = job.purchaseOrders?.find((po) => po.targetCompanyId === 'bradford');
                return (
                  <option key={job.id} value={job.id}>
                    Job #{job.jobNo} {job.customerPONumber ? `| PO: ${job.customerPONumber}` : ''} - $
                    {incomingPO ? Number(incomingPO.vendorAmount).toLocaleString() : 'N/A'}
                  </option>
                );
              })}
            </select>
            {availableJobs.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">No jobs available for PO creation. All jobs either have POs or lack incoming POs.</p>
            )}
            {filteredJobs.length === 0 && searchTerm && availableJobs.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">No jobs match your search.</p>
            )}
          </div>

          {/* Bradford PO Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bradford PO Number <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={bradfordPONumber}
              onChange={(e) => setBradfordPONumber(e.target.value)}
              placeholder="Enter Bradford PO# (e.g., BFD-12345)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">This will be used to track the PO to JD Graphic</p>
          </div>

          {/* Vendor Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Amount (to JD Graphic) <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={vendorAmount}
                onChange={(e) => setVendorAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Margin Calculation */}
          {selectedJobId && vendorAmount && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">Margin Calculation</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Incoming (Impact→Bradford)</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Outgoing (Bradford→JD)</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${outgoingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Bradford Margin</p>
                  <p className={`text-lg font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  {margin < 0 && (
                    <p className="text-xs text-red-600 mt-1">Warning: Negative margin!</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedJobId || !bradfordPONumber.trim() || !vendorAmount}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating...' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  );
}
