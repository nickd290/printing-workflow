'use client';

import { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { JobFormFields } from './JobFormFields';

interface ParsedPOData {
  description: string | null;
  paper: string | null;
  flatSize: string | null;
  foldedSize: string | null;
  colors: string | null;
  finishing: string | null;
  total: number | null;
  poNumber: string | null;
  deliveryDate: string | null;
  samples: string | null;
  requiredArtworkCount: number;
  requiredDataFileCount: number;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface POReviewFormProps {
  parsedData: ParsedPOData;
  customers: Customer[];
  selectedCustomerId: string;
  onCustomerChange: (customerId: string) => void;
  onConfirm: (data: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function POReviewForm({
  parsedData,
  customers,
  selectedCustomerId,
  onCustomerChange,
  onConfirm,
  onCancel,
  loading = false
}: POReviewFormProps) {
  const { isBrokerAdmin } = useUser();
  const [formData, setFormData] = useState({
    description: parsedData.description || '',
    paper: parsedData.paper || '',
    flatSize: parsedData.flatSize || '',
    foldedSize: parsedData.foldedSize || '',
    colors: parsedData.colors || '',
    finishing: parsedData.finishing || '',
    total: parsedData.total?.toString() || '',
    poNumber: parsedData.poNumber || '',
    deliveryDate: parsedData.deliveryDate || '',
    samples: parsedData.samples || '',
    requiredArtworkCount: parsedData.requiredArtworkCount || 1,
    requiredDataFileCount: parsedData.requiredDataFileCount || 0,
    // Routing fields (admin only)
    routingType: 'BRADFORD_JD' as const,
    vendorId: '',
    vendorAmount: '',
    bradfordCut: '',
  });

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    // Validate third-party vendor fields if selected
    if (formData.routingType === 'THIRD_PARTY_VENDOR') {
      if (!formData.vendorId) {
        alert('Please select a vendor');
        return;
      }
      if (!formData.vendorAmount || parseFloat(formData.vendorAmount) <= 0) {
        alert('Please enter a valid vendor amount');
        return;
      }
      if (!formData.bradfordCut || parseFloat(formData.bradfordCut) < 0) {
        alert('Please enter a valid Bradford cut amount');
        return;
      }
    }

    // Convert routing fields to proper types if third-party vendor
    const submitData = { ...formData };
    if (isBrokerAdmin && formData.routingType === 'THIRD_PARTY_VENDOR') {
      submitData.vendorAmount = parseFloat(formData.vendorAmount);
      submitData.bradfordCut = parseFloat(formData.bradfordCut);
    }

    onConfirm(submitData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex">
          <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              AI Extracted Data - Please Review
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                We've automatically extracted the following information from your Purchase Order.
                Please review and edit any fields as needed before creating your job.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Selection */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Customer <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedCustomerId}
          onChange={(e) => onCustomerChange(e.target.value)}
          disabled={loading}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">-- Select a customer --</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
              {customer.email && ` (${customer.email})`}
            </option>
          ))}
        </select>
        {!selectedCustomerId && (
          <p className="mt-2 text-sm text-red-600">
            Please select a customer to create the job
          </p>
        )}
      </div>

      {/* Form */}
      <JobFormFields
        data={formData}
        onChange={handleFieldChange}
        disabled={loading}
        showFileRequirements={true}
        showRoutingOptions={isBrokerAdmin}
      />

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading || !formData.description}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Creating Job...
            </>
          ) : (
            'Create Job & Continue'
          )}
        </button>
      </div>
    </div>
  );
}
