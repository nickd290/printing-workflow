'use client';

import { PaperInventory } from '@/lib/api-client';
import { useState } from 'react';

interface InventoryCardProps {
  inventory: PaperInventory;
  onAdjust: (rollType: string, quantity: number, notes?: string) => Promise<void>;
  onRefresh: () => void;
}

export function InventoryCard({ inventory, onAdjust, onRefresh }: InventoryCardProps) {
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isLowStock = inventory.reorderPoint !== null && inventory.quantity <= inventory.reorderPoint;

  const handleQuickAdjust = async (amount: number) => {
    try {
      setIsLoading(true);
      await onAdjust(inventory.rollType, amount);
      onRefresh();
    } catch (error) {
      console.error('Failed to adjust inventory:', error);
      alert('Failed to adjust inventory. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomAdjust = async () => {
    const amount = parseInt(adjustAmount);
    if (isNaN(amount) || amount === 0) {
      alert('Please enter a valid quantity');
      return;
    }

    try {
      setIsLoading(true);
      await onAdjust(inventory.rollType, amount, adjustNotes || undefined);
      setShowAdjust(false);
      setAdjustAmount('');
      setAdjustNotes('');
      onRefresh();
    } catch (error) {
      console.error('Failed to adjust inventory:', error);
      alert('Failed to adjust inventory. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRollDisplayName = () => {
    if (inventory.rollType === '20_9pt') {
      return `${inventory.rollWidth}" - ${inventory.paperPoint}pt (Postcards)`;
    }
    return `${inventory.rollWidth}" - ${inventory.paperPoint}pt ${inventory.paperType}`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border-2 ${isLowStock ? 'border-red-300 bg-red-50' : 'border-gray-200'} p-6 transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{getRollDisplayName()}</h3>
          <p className="text-sm text-gray-500 mt-1">Roll Type: {inventory.rollType}</p>
        </div>
        {isLowStock && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Low Stock
          </span>
        )}
      </div>

      {/* Current Quantity */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-orange-600">{inventory.quantity}</span>
          <span className="text-lg text-gray-500">rolls</span>
        </div>
        {inventory.reorderPoint !== null && (
          <p className="text-sm text-gray-500 mt-1">
            Reorder at: <span className="font-medium">{inventory.reorderPoint} rolls</span>
          </p>
        )}
        {inventory.weightPerRoll && (
          <p className="text-sm text-gray-500 mt-1">
            Weight per roll: <span className="font-medium">{Number(inventory.weightPerRoll).toFixed(0)} lbs</span>
          </p>
        )}
      </div>

      {/* Quick Adjust Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleQuickAdjust(1)}
          disabled={isLoading}
          className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +1
        </button>
        <button
          onClick={() => handleQuickAdjust(5)}
          disabled={isLoading}
          className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +5
        </button>
        <button
          onClick={() => handleQuickAdjust(-1)}
          disabled={isLoading || inventory.quantity < 1}
          className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -1
        </button>
        <button
          onClick={() => handleQuickAdjust(-5)}
          disabled={isLoading || inventory.quantity < 5}
          className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -5
        </button>
      </div>

      {/* Custom Adjust */}
      {!showAdjust ? (
        <button
          onClick={() => setShowAdjust(true)}
          className="w-full px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Custom Adjust
        </button>
      ) : (
        <div className="space-y-3">
          <input
            type="number"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder="Enter quantity (+ or -)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <input
            type="text"
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCustomAdjust}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Adjusting...' : 'Apply'}
            </button>
            <button
              onClick={() => {
                setShowAdjust(false);
                setAdjustAmount('');
                setAdjustNotes('');
              }}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {inventory.transactions && inventory.transactions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recent Activity</p>
          <div className="space-y-1">
            {inventory.transactions.slice(0, 3).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between text-xs">
                <span className={transaction.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                  {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                </span>
                <span className="text-gray-500">
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
