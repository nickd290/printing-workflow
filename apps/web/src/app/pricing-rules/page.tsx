'use client';

import { useState, useEffect } from 'react';
import { PricingRulesTable } from '@/components/PricingRulesTable';
import { PricingRuleModal } from '@/components/PricingRuleModal';

interface PricingRule {
  id: string;
  sizeName: string;
  baseCPM: number;
  printCPM: number;
  paperWeightPer1000: number | null;
  paperCostPerLb: number | null;
  paperCPM: number | null;
  rollSize: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';
export default function PricingRulesPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('${API_URL}/api/pricing-rules');
      const data = await response.json();
      setRules(data.rules);
      setError(null);
    } catch (err) {
      console.error('Failed to load pricing rules:', err);
      setError('Failed to load pricing rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRule(null);
    setShowModal(true);
  };

  const handleEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/pricing-rules/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete pricing rule');
      }

      await loadRules();
    } catch (err) {
      console.error('Failed to delete pricing rule:', err);
      alert('Failed to delete pricing rule');
    }
  };

  const handleSave = async (data: Partial<PricingRule>) => {
    try {
      const url = editingRule
        ? `${API_URL}/api/pricing-rules/${editingRule.id}`
        : '${API_URL}/api/pricing-rules';

      const method = editingRule ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save pricing rule');
      }

      setShowModal(false);
      setEditingRule(null);
      await loadRules();
    } catch (err: any) {
      console.error('Failed to save pricing rule:', err);
      alert(err.message || 'Failed to save pricing rule');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-gray-600">Loading pricing rules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pricing Rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage pricing rules for different product sizes
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Pricing Rule
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* Pricing Rules Table */}
      <PricingRulesTable
        rules={rules}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Create/Edit Modal */}
      {showModal && (
        <PricingRuleModal
          rule={editingRule}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}
