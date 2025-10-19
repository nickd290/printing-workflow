'use client';

import { useState, useEffect } from 'react';
import { paperInventoryAPI, type PaperInventory, type PaperRollType } from '@/lib/api-client';
import { InventoryCard } from './InventoryCard';

export function InventoryManagement() {
  const [inventory, setInventory] = useState<PaperInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const result = await paperInventoryAPI.getSummary('bradford');
      setInventory(result.inventory);
      setLowStockCount(result.lowStockCount);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load inventory:', err);

      // If inventory doesn't exist, try to initialize it
      if (err.status === 404 || inventory.length === 0) {
        try {
          await paperInventoryAPI.initialize('bradford');
          const result = await paperInventoryAPI.getSummary('bradford');
          setInventory(result.inventory);
          setLowStockCount(result.lowStockCount);
          setError(null);
        } catch (initErr) {
          console.error('Failed to initialize inventory:', initErr);
          setError('Failed to load inventory. Make sure the API is running.');
        }
      } else {
        setError('Failed to load inventory. Make sure the API is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = async (rollType: string, quantity: number, notes?: string) => {
    try {
      await paperInventoryAPI.adjust({
        rollType: rollType as PaperRollType,
        quantity,
        type: quantity > 0 ? 'ADD' : 'REMOVE',
        companyId: 'bradford',
        notes,
      });
      await loadInventory();
    } catch (error) {
      console.error('Failed to adjust inventory:', error);
      throw error;
    }
  };

  const loadTransactions = async () => {
    try {
      const result = await paperInventoryAPI.getTransactions({
        companyId: 'bradford',
        limit: 50,
      });
      setTransactions(result.transactions);
      setShowTransactions(true);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      alert('Failed to load transaction history');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        <p className="mt-4 text-gray-600">Loading inventory...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold">Error:</span> {error}
        </div>
        <button
          onClick={loadInventory}
          className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Paper Roll Inventory</h2>
            <p className="text-orange-100 mt-1">Track and manage Bradford's paper roll stock</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-orange-100 text-sm">Total Rolls</p>
              <p className="text-3xl font-bold">{inventory.reduce((sum, inv) => sum + inv.quantity, 0)}</p>
            </div>
            {lowStockCount > 0 && (
              <div className="text-right">
                <p className="text-orange-100 text-sm">Low Stock Alerts</p>
                <p className="text-3xl font-bold text-red-200">{lowStockCount}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={loadInventory}
            className="px-4 py-2 bg-white text-orange-600 text-sm font-medium rounded-lg hover:bg-orange-50 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={loadTransactions}
            className="px-4 py-2 bg-orange-700 text-white text-sm font-medium rounded-lg hover:bg-orange-800 transition-colors"
          >
            View History
          </button>
        </div>
      </div>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {inventory.map((inv) => (
          <InventoryCard
            key={inv.id}
            inventory={inv}
            onAdjust={handleAdjust}
            onRefresh={loadInventory}
          />
        ))}
      </div>

      {/* Transaction History Modal */}
      {showTransactions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
              <button
                onClick={() => setShowTransactions(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-8rem)] p-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {transaction.inventory?.rollType || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'ADD' ? 'bg-green-100 text-green-800' :
                          transaction.type === 'JOB_USAGE' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold ${
                        transaction.quantity > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {transaction.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No transactions found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
