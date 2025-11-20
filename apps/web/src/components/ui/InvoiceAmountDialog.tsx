'use client';

import { useState, useEffect } from 'react';

interface InvoiceAmountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  title: string;
  suggestedAmount: number;
  isLoading?: boolean;
}

export function InvoiceAmountDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  suggestedAmount,
  isLoading = false,
}: InvoiceAmountDialogProps) {
  const [amount, setAmount] = useState(suggestedAmount.toString());
  const [error, setError] = useState('');

  // Update amount when suggestedAmount changes
  useEffect(() => {
    setAmount(suggestedAmount.toString());
    setError('');
  }, [suggestedAmount, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount)) {
      setError('Please enter a valid number');
      return;
    }

    if (parsedAmount < 0) {
      setError('Amount must be positive');
      return;
    }

    onConfirm(parsedAmount);
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-700 mb-4">Please confirm the invoice amount:</p>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={isLoading}
                className={`w-full pl-8 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
            </div>
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Suggested amount: ${suggestedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
