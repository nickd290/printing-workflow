'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

interface SampleRecipient {
  quantity: number;
  recipientName: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface ParsedPOData {
  description?: string;
  paper?: string;
  flatSize?: string;
  foldedSize?: string;
  colors?: string;
  finishing?: string;
  total?: number;
  poNumber?: string;
  orderDate?: string;
  deliveryDate?: string;
  pickupDate?: string;
  poolDate?: string;
  samples?: string;
  sampleInstructions?: string;
  sampleRecipients?: SampleRecipient[];
  quantity?: number;
  requiredArtworkCount?: number;
  requiredDataFileCount?: number;
  notes?: string;
}

interface POReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedData: ParsedPOData;
  onConfirm: (editedData: ParsedPOData) => void;
  loading?: boolean;
}

export function POReviewModal({ isOpen, onClose, parsedData, onConfirm, loading }: POReviewModalProps) {
  const [formData, setFormData] = useState<ParsedPOData>(parsedData);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.description || formData.description.trim() === '') {
      toast.error('Description is required');
      return;
    }

    onConfirm(formData);
  };

  const handleChange = (field: keyof ParsedPOData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRecipientChange = (index: number, field: keyof SampleRecipient, value: string | number) => {
    setFormData(prev => {
      const updatedRecipients = [...(prev.sampleRecipients || [])];
      updatedRecipients[index] = {
        ...updatedRecipients[index],
        [field]: value,
      };
      return { ...prev, sampleRecipients: updatedRecipients };
    });
  };

  const handleAddRecipient = () => {
    setFormData(prev => ({
      ...prev,
      sampleRecipients: [
        ...(prev.sampleRecipients || []),
        { quantity: 0, recipientName: '', address: '', city: '', state: '', zip: '' }
      ],
    }));
  };

  const handleRemoveRecipient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sampleRecipients: prev.sampleRecipients?.filter((_, i) => i !== index) || [],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Review Your Order Details</h2>
                <p className="text-blue-100 mt-1">Please review and confirm the information extracted from your PO</p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter job description..."
                />
              </div>

              {/* PO Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PO Number
                </label>
                <input
                  type="text"
                  value={formData.poNumber || ''}
                  onChange={(e) => handleChange('poNumber', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="PO-2025-001"
                />
              </div>

              {/* Total - Enhanced UI for price verification */}
              <div className="md:col-span-2">
                <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-base font-bold text-gray-900 flex items-center">
                      <span className="mr-2">💰</span>
                      Total Amount (Verify This!)
                    </label>
                    {formData.total && formData.quantity && (
                      <span className="text-sm text-gray-600">
                        ${(formData.total / formData.quantity).toFixed(4)} per unit
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-700">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.total || ''}
                      onChange={(e) => handleChange('total', parseFloat(e.target.value))}
                      className="flex-1 px-4 py-3 text-xl font-semibold border-2 border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                      placeholder="1250.00"
                      required
                    />
                  </div>
                  <p className="text-xs text-amber-800 mt-2 font-medium">
                    ⚠️ Please verify this is the GRAND TOTAL from the PO (not unit price or $/M)
                  </p>
                  {formData.total && formData.quantity && formData.total / formData.quantity < 0.01 && (
                    <p className="text-xs text-red-600 mt-2 font-bold">
                      🚨 Warning: Price per unit seems very low. This might be incorrect!
                    </p>
                  )}
                </div>
              </div>

              {/* Order Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Date
                </label>
                <input
                  type="date"
                  value={formData.orderDate || ''}
                  onChange={(e) => handleChange('orderDate', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={formData.quantity || ''}
                  onChange={(e) => handleChange('quantity', parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="5000"
                />
              </div>

              {/* Paper */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paper Type
                </label>
                <input
                  type="text"
                  value={formData.paper || ''}
                  onChange={(e) => handleChange('paper', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="100lb Gloss Text"
                />
              </div>

              {/* Flat Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flat Size
                </label>
                <input
                  type="text"
                  value={formData.flatSize || ''}
                  onChange={(e) => handleChange('flatSize', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="8.5 x 11"
                />
              </div>

              {/* Folded Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folded Size
                </label>
                <input
                  type="text"
                  value={formData.foldedSize || ''}
                  onChange={(e) => handleChange('foldedSize', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="4.25 x 5.5"
                />
              </div>

              {/* Colors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Colors
                </label>
                <input
                  type="text"
                  value={formData.colors || ''}
                  onChange={(e) => handleChange('colors', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="4/4"
                />
              </div>

              {/* Finishing */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Finishing
                </label>
                <input
                  type="text"
                  value={formData.finishing || ''}
                  onChange={(e) => handleChange('finishing', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="UV Coating"
                />
              </div>

              {/* Delivery Schedule Section */}
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Delivery Schedule
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Pickup Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pickup Date
                    </label>
                    <input
                      type="date"
                      value={formData.pickupDate || ''}
                      onChange={(e) => handleChange('pickupDate', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">ALG pick up</p>
                  </div>

                  {/* Pool Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pool Date
                    </label>
                    <input
                      type="date"
                      value={formData.poolDate || ''}
                      onChange={(e) => handleChange('poolDate', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">ALG pool / final delivery</p>
                  </div>

                  {/* Delivery Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Date
                    </label>
                    <input
                      type="date"
                      value={formData.deliveryDate || ''}
                      onChange={(e) => handleChange('deliveryDate', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sample Information Section */}
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Sample Distribution
                </h3>

                {/* Sample Instructions */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sample Instructions
                  </label>
                  <textarea
                    value={formData.sampleInstructions || ''}
                    onChange={(e) => handleChange('sampleInstructions', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Special instructions for sample distribution..."
                  />
                </div>

                {/* Sample Recipients Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Qty</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Recipient Name</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Address</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">City</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">State</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Zip</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {formData.sampleRecipients && formData.sampleRecipients.length > 0 ? (
                          formData.sampleRecipients.map((recipient, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={recipient.quantity}
                                  onChange={(e) => handleRecipientChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={recipient.recipientName}
                                  onChange={(e) => handleRecipientChange(index, 'recipientName', e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Name"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={recipient.address}
                                  onChange={(e) => handleRecipientChange(index, 'address', e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Street address"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={recipient.city || ''}
                                  onChange={(e) => handleRecipientChange(index, 'city', e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="City"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={recipient.state || ''}
                                  onChange={(e) => handleRecipientChange(index, 'state', e.target.value)}
                                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="ST"
                                  maxLength={2}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={recipient.zip || ''}
                                  onChange={(e) => handleRecipientChange(index, 'zip', e.target.value)}
                                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Zip"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecipient(index)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                  title="Remove recipient"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500">
                              No sample recipients added. Click "Add Recipient" to add one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleAddRecipient}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Recipient
                    </button>
                  </div>
                </div>
              </div>

              {/* File Requirements */}
              <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  File Upload Requirements
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Artwork Files Needed
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.requiredArtworkCount || 1}
                      onChange={(e) => handleChange('requiredArtworkCount', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Files Needed
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.requiredDataFileCount || 0}
                      onChange={(e) => handleChange('requiredDataFileCount', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notes / Special Instructions */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Additional Notes / Special Instructions
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={4}
                  placeholder="e.g., Artwork delayed until 11/15, Ship via FedEx overnight, Customer will provide updated file on Monday, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Add any special notes or instructions that weren't captured in the PO
                </p>
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="bg-gray-50 px-8 py-4 flex items-center justify-between border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Order...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm & Create Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
