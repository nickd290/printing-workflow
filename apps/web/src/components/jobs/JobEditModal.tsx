'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface JobEditModalProps {
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}

interface PricingRule {
  id: string;
  sizeName: string;
  baseCPM: number;
  printCPM: number;
  paperWeightPer1000: number | null;
  paperCostPerLb: number | null;
  paperCPM: number | null;
  paperChargedCPM: number | null;
}

export function JobEditModal({ job, isOpen, onClose, onSave }: JobEditModalProps) {
  // Form state
  const [formData, setFormData] = useState({
    // Basic
    quantity: job.quantity || 0,
    sizeName: job.sizeName || '',
    paperType: job.paperType || '',
    jdSuppliesPaper: job.jdSuppliesPaper || false,
    bradfordWaivesPaperMargin: job.bradfordWaivesPaperMargin || false,

    // Financial
    customerTotal: job.customerTotal?.toString() || '0',
    jdTotal: job.jdTotal?.toString() || '0',
    paperChargedTotal: job.paperChargedTotal?.toString() || '0',
    paperCostTotal: job.paperCostTotal?.toString() || '0',
    impactMargin: job.impactMargin?.toString() || '0',
    bradfordTotal: job.bradfordTotal?.toString() || '0',
    bradfordPrintMargin: job.bradfordPrintMargin?.toString() || '0',
    bradfordPaperMargin: job.bradfordPaperMargin?.toString() || '0',
    bradfordTotalMargin: job.bradfordTotalMargin?.toString() || '0',

    // CPM
    printCPM: job.printCPM?.toString() || '0',
    paperCostCPM: job.paperCostCPM?.toString() || '0',
    paperChargedCPM: job.paperChargedCPM?.toString() || '0',

    // Paper
    paperWeightPer1000: job.paperWeightPer1000?.toString() || '0',
  });

  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [selectedPricingRule, setSelectedPricingRule] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Load pricing rules
  useEffect(() => {
    loadPricingRules();
  }, []);

  // Sync formData when job prop changes (fixes toggle persistence issue)
  useEffect(() => {
    if (job) {
      console.log('[JobEditModal] Job prop changed, syncing formData:', {
        bradfordWaivesPaperMargin: job.bradfordWaivesPaperMargin,
        jdSuppliesPaper: job.jdSuppliesPaper,
      });

      setFormData({
        // Basic
        quantity: job.quantity || 0,
        sizeName: job.sizeName || '',
        paperType: job.paperType || '',
        jdSuppliesPaper: job.jdSuppliesPaper || false,
        bradfordWaivesPaperMargin: job.bradfordWaivesPaperMargin || false,

        // Financial
        customerTotal: job.customerTotal?.toString() || '0',
        jdTotal: job.jdTotal?.toString() || '0',
        paperChargedTotal: job.paperChargedTotal?.toString() || '0',
        paperCostTotal: job.paperCostTotal?.toString() || '0',
        impactMargin: job.impactMargin?.toString() || '0',
        bradfordTotal: job.bradfordTotal?.toString() || '0',
        bradfordPrintMargin: job.bradfordPrintMargin?.toString() || '0',
        bradfordPaperMargin: job.bradfordPaperMargin?.toString() || '0',
        bradfordTotalMargin: job.bradfordTotalMargin?.toString() || '0',

        // CPM
        printCPM: job.printCPM?.toString() || '0',
        paperCostCPM: job.paperCostCPM?.toString() || '0',
        paperChargedCPM: job.paperChargedCPM?.toString() || '0',

        // Paper
        paperWeightPer1000: job.paperWeightPer1000?.toString() || '0',
      });
    }
  }, [job]);

  const loadPricingRules = async () => {
    try {
      const response = await fetch(`${API_URL}/api/pricing-rules`);
      if (!response.ok) throw new Error('Failed to load pricing rules');
      const data = await response.json();
      setPricingRules(data.rules || []);
    } catch (error) {
      console.error('Error loading pricing rules:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBradfordWaiverChange = (checked: boolean) => {
    console.log('[JobEditModal] Bradford Waiver toggled:', checked);
    setFormData(prev => ({ ...prev, bradfordWaivesPaperMargin: checked }));
    // Trigger recalculation with the new checked value
    setTimeout(() => calculateMarginsFrom5050(checked), 0);
  };

  const calculateMarginsFrom5050 = (overrideWaiver?: boolean) => {
    const customerTotal = parseFloat(formData.customerTotal) || 0;
    const paperCharged = parseFloat(formData.paperChargedTotal) || 0;
    const paperCost = parseFloat(formData.paperCostTotal) || 0;
    const jdTotal = parseFloat(formData.jdTotal) || 0;

    // Use override value if provided, otherwise read from form state
    const isWaiver = overrideWaiver !== undefined ? overrideWaiver : formData.bradfordWaivesPaperMargin;

    let updates: any = {};

    // If Bradford waives paper margin, set paper charged = paper cost (no markup)
    if (isWaiver) {
      updates.paperChargedTotal = paperCost.toFixed(2);

      const profitPool = customerTotal - paperCost - jdTotal;

      if (profitPool < 0) {
        toast.error(`Negative profit pool: $${profitPool.toFixed(2)}. Customer total is less than costs!`);
      }

      const impactMargin = profitPool / 2;
      const bradfordMargin = profitPool / 2;
      const bradfordTotal = bradfordMargin + paperCost + jdTotal;

      updates.impactMargin = impactMargin.toFixed(2);
      updates.bradfordTotalMargin = bradfordMargin.toFixed(2);
      updates.bradfordTotal = bradfordTotal.toFixed(2);

      setFormData(prev => ({ ...prev, ...updates }));
      toast.success(`Bradford waives paper margin - 50/50 split: Impact $${impactMargin.toFixed(2)}, Bradford $${bradfordMargin.toFixed(2)}`);
    } else {
      // Normal case: Bradford keeps paper markup
      const profitPool = customerTotal - paperCharged - jdTotal;

      if (profitPool < 0) {
        toast.error(`Negative profit pool: $${profitPool.toFixed(2)}. Customer total is less than costs!`);
      }

      const impactMargin = profitPool / 2;
      const paperMarkup = paperCharged - paperCost;
      const bradfordMargin = profitPool / 2 + paperMarkup;
      const bradfordTotal = bradfordMargin + paperCharged + jdTotal;

      updates.impactMargin = impactMargin.toFixed(2);
      updates.bradfordTotalMargin = bradfordMargin.toFixed(2);
      updates.bradfordTotal = bradfordTotal.toFixed(2);

      setFormData(prev => ({ ...prev, ...updates }));
      toast.success(`Margins calculated: Impact $${impactMargin.toFixed(2)}, Bradford $${bradfordMargin.toFixed(2)}`);
    }
  };

  const applyPricingRule = () => {
    const rule = pricingRules.find(r => r.id === selectedPricingRule);
    if (!rule) {
      toast.error('Please select a pricing rule');
      return;
    }

    const quantity = parseInt(formData.quantity.toString()) || 0;
    const thousands = quantity / 1000;

    const jdTotal = (parseFloat(rule.printCPM.toString()) * thousands).toFixed(2);
    const paperCharged = (parseFloat((rule.paperChargedCPM || rule.paperCPM || 0).toString()) * thousands).toFixed(2);
    const paperCost = rule.paperCostPerLb && rule.paperWeightPer1000
      ? ((parseFloat(rule.paperCostPerLb.toString()) * parseFloat(rule.paperWeightPer1000.toString()) / 1000) * quantity / 1000).toFixed(2)
      : '0';

    setFormData(prev => ({
      ...prev,
      sizeName: rule.sizeName,
      jdTotal,
      paperChargedTotal: paperCharged,
      paperCostTotal: paperCost,
      printCPM: rule.printCPM.toString(),
      paperChargedCPM: (rule.paperChargedCPM || rule.paperCPM || 0).toString(),
      paperCostCPM: rule.paperCostPerLb?.toString() || '0',
      paperWeightPer1000: rule.paperWeightPer1000?.toString() || '0',
    }));

    toast.success(`Applied pricing for ${rule.sizeName}`);
  };

  const calculateCPMs = () => {
    const quantity = parseInt(formData.quantity.toString()) || 0;
    if (quantity === 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    const thousands = quantity / 1000;

    const customerTotal = parseFloat(formData.customerTotal) || 0;
    const jdTotal = parseFloat(formData.jdTotal) || 0;
    const paperCharged = parseFloat(formData.paperChargedTotal) || 0;
    const impactMargin = parseFloat(formData.impactMargin) || 0;

    setFormData(prev => ({
      ...prev,
      customerCPM: (customerTotal / thousands).toFixed(2),
      printCPM: (jdTotal / thousands).toFixed(2),
      paperChargedCPM: (paperCharged / thousands).toFixed(2),
      impactMarginCPM: (impactMargin / thousands).toFixed(2),
    }));

    toast.success('CPM values calculated from totals');
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Convert string values to numbers for API
      const updates: any = {
        quantity: parseInt(formData.quantity.toString()),
        sizeName: formData.sizeName,
        paperType: formData.paperType,
        jdSuppliesPaper: formData.jdSuppliesPaper,
        bradfordWaivesPaperMargin: formData.bradfordWaivesPaperMargin,
        customerTotal: parseFloat(formData.customerTotal),
        jdTotal: parseFloat(formData.jdTotal),
        paperChargedTotal: parseFloat(formData.paperChargedTotal),
        paperCostTotal: parseFloat(formData.paperCostTotal),
        impactMargin: parseFloat(formData.impactMargin),
        bradfordTotal: parseFloat(formData.bradfordTotal),
        bradfordPrintMargin: parseFloat(formData.bradfordPrintMargin),
        bradfordPaperMargin: parseFloat(formData.bradfordPaperMargin),
        bradfordTotalMargin: parseFloat(formData.bradfordTotalMargin),
        printCPM: parseFloat(formData.printCPM),
        paperCostCPM: parseFloat(formData.paperCostCPM),
        paperChargedCPM: parseFloat(formData.paperChargedCPM),
        paperWeightPer1000: parseFloat(formData.paperWeightPer1000),
        changedBy: 'admin@impactdirect.com', // TODO: get from auth
        changedByRole: 'BROKER_ADMIN',
      };

      console.log('[JobEditModal] Saving job with payload:', {
        bradfordWaivesPaperMargin: updates.bradfordWaivesPaperMargin,
        jdSuppliesPaper: updates.jdSuppliesPaper,
      });

      const response = await fetch(`${API_URL}/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update job');

      const responseData = await response.json();
      console.log('[JobEditModal] Job saved successfully, response:', {
        bradfordWaivesPaperMargin: responseData.job?.bradfordWaivesPaperMargin,
        jdSuppliesPaper: responseData.job?.jdSuppliesPaper,
      });

      toast.success('Job updated successfully!');

      console.log('[JobEditModal] Awaiting parent data refresh...');
      await onSave();
      console.log('[JobEditModal] Parent data refreshed, waiting for React to re-render...');

      // Wait for React to re-render and propagate the updated job prop
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('[JobEditModal] React re-render complete, closing modal');

      onClose();
    } catch (error: any) {
      console.error('Error saving job:', error);
      toast.error(error.message || 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const profitPool = (parseFloat(formData.customerTotal) || 0) -
                     (parseFloat(formData.paperChargedTotal) || 0) -
                     (parseFloat(formData.jdTotal) || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Edit Job: {job.jobNo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size Name</label>
                <input
                  type="text"
                  value={formData.sizeName}
                  onChange={(e) => handleInputChange('sizeName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., 8.5 x 11"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper Type</label>
                <input
                  type="text"
                  value={formData.paperType}
                  onChange={(e) => handleInputChange('paperType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., 100# Gloss Text"
                />
              </div>
              <div className="col-span-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.jdSuppliesPaper}
                    onChange={(e) => setFormData(prev => ({ ...prev, jdSuppliesPaper: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    JD Supplies Paper (10/10 margin split, no Bradford markup)
                  </span>
                </label>
              </div>
              <div className="col-span-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.bradfordWaivesPaperMargin}
                    onChange={(e) => handleBradfordWaiverChange(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Bradford Waives Paper Margin (50/50 split of total margin)
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* Pricing Rule Lookup */}
          <section className="bg-blue-50 p-4 rounded-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Apply Pricing Rule</h3>
            <div className="flex gap-4">
              <select
                value={selectedPricingRule}
                onChange={(e) => setSelectedPricingRule(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select a size...</option>
                {pricingRules.map(rule => (
                  <option key={rule.id} value={rule.id}>
                    {rule.sizeName} - Print: ${rule.printCPM} CPM
                  </option>
                ))}
              </select>
              <button
                onClick={applyPricingRule}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Apply Rule
              </button>
            </div>
          </section>

          {/* Cost Breakdown */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Total</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.customerTotal}
                  onChange={(e) => handleInputChange('customerTotal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">JD Printing Total</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.jdTotal}
                  onChange={(e) => handleInputChange('jdTotal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper Charged</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.paperChargedTotal}
                  onChange={(e) => handleInputChange('paperChargedTotal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.paperCostTotal}
                  onChange={(e) => handleInputChange('paperCostTotal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </section>

          {/* Profit Pool Display */}
          <div className={`p-4 rounded-md ${profitPool < 0 ? 'bg-red-100 border border-red-300' : 'bg-green-100 border border-green-300'}`}>
            <div className="flex items-center justify-between">
              <span className={`font-semibold ${profitPool < 0 ? 'text-red-900' : 'text-green-900'}`}>Profit Pool (Customer - Paper - JD):</span>
              <span className={`text-xl font-bold ${profitPool < 0 ? 'text-red-700' : 'text-green-700'}`}>
                ${profitPool.toFixed(2)}
              </span>
            </div>
            {profitPool < 0 && (
              <p className="text-sm text-red-700 mt-2">⚠️ Negative profit! Customer total is less than costs.</p>
            )}
          </div>

          {/* Margin Split (50/50) */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Margin Split (50/50)</h3>
              <button
                onClick={calculateMarginsFrom5050}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Auto-Calculate
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Impact Margin (50%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.impactMargin}
                  onChange={(e) => handleInputChange('impactMargin', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bradford Margin (50%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.bradfordTotalMargin}
                  onChange={(e) => handleInputChange('bradfordTotalMargin', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bradford Total (Margin + Paper + JD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.bradfordTotal}
                  onChange={(e) => handleInputChange('bradfordTotal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  readOnly
                />
              </div>
            </div>
          </section>

          {/* CPM Fields */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">CPM Rates (Per Thousand)</h3>
              <button
                onClick={calculateCPMs}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
              >
                Calculate CPMs
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Print CPM</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.printCPM}
                  onChange={(e) => handleInputChange('printCPM', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper Charged CPM</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.paperChargedCPM}
                  onChange={(e) => handleInputChange('paperChargedCPM', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper Weight (per 1000)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.paperWeightPer1000}
                  onChange={(e) => handleInputChange('paperWeightPer1000', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
