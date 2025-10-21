'use client';

import { useState, useEffect } from 'react';

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
}

interface PricingRuleModalProps {
  rule: PricingRule | null;
  onSave: (data: Partial<PricingRule>) => Promise<void>;
  onClose: () => void;
}

export function PricingRuleModal({ rule, onSave, onClose }: PricingRuleModalProps) {
  const [formData, setFormData] = useState({
    sizeName: rule?.sizeName || '',
    baseCPM: rule?.baseCPM?.toString() || '',
    printCPM: rule?.printCPM?.toString() || '',
    paperWeightPer1000: rule?.paperWeightPer1000?.toString() || '',
    paperCostPerLb: rule?.paperCostPerLb?.toString() || '',
    paperCPM: rule?.paperCPM?.toString() || '',
    rollSize: rule?.rollSize?.toString() || '',
    isActive: rule?.isActive ?? true,
    notes: rule?.notes || '',
  });

  const [submitting, setSubmitting] = useState(false);

  // Auto-calculate paper CPM when weight and cost change
  useEffect(() => {
    if (formData.paperWeightPer1000 && formData.paperCostPerLb) {
      const weight = parseFloat(formData.paperWeightPer1000);
      const cost = parseFloat(formData.paperCostPerLb);
      if (!isNaN(weight) && !isNaN(cost)) {
        const calculatedCPM = (weight * cost).toFixed(2);
        setFormData(prev => ({ ...prev, paperCPM: calculatedCPM }));
      }
    }
  }, [formData.paperWeightPer1000, formData.paperCostPerLb]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const data: any = {
        sizeName: formData.sizeName,
        baseCPM: parseFloat(formData.baseCPM),
        printCPM: parseFloat(formData.printCPM),
        isActive: formData.isActive,
      };

      if (formData.paperWeightPer1000) {
        data.paperWeightPer1000 = parseFloat(formData.paperWeightPer1000);
      }
      if (formData.paperCostPerLb) {
        data.paperCostPerLb = parseFloat(formData.paperCostPerLb);
      }
      if (formData.paperCPM) {
        data.paperCPM = parseFloat(formData.paperCPM);
      }
      if (formData.rollSize) {
        data.rollSize = parseInt(formData.rollSize);
      }
      if (formData.notes) {
        data.notes = formData.notes;
      }

      await onSave(data);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {rule ? 'Edit Pricing Rule' : 'New Pricing Rule'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {rule ? 'Update pricing information' : 'Add a new pricing rule for a product size'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Size Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!rule}
                  value={formData.sizeName}
                  onChange={(e) => setFormData({ ...formData, sizeName: e.target.value })}
                  placeholder="e.g., 26 x 9.75"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {rule && (
                  <p className="text-xs text-muted-foreground mt-1">Size name cannot be changed</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Base CPM *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.baseCPM}
                    onChange={(e) => setFormData({ ...formData, baseCPM: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-background border border-border rounded-lg pl-7 pr-12 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <span className="absolute right-3 top-2 text-muted-foreground">/M</span>
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-foreground">Active</span>
              </label>
            </div>
          </div>

          {/* Print Costs */}
          <div className="space-y-4 pt-6 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Print Costs</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Print CPM * <span className="text-xs text-muted-foreground">(JD Print Cost)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.printCPM}
                    onChange={(e) => setFormData({ ...formData, printCPM: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-background border border-border rounded-lg pl-7 pr-12 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <span className="absolute right-3 top-2 text-muted-foreground">/M</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Roll Size <span className="text-xs text-muted-foreground">(inches)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.rollSize}
                  onChange={(e) => setFormData({ ...formData, rollSize: e.target.value })}
                  placeholder="15, 18, or 20"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Paper Costs */}
          <div className="space-y-4 pt-6 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Paper Costs</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Paper Weight <span className="text-xs text-muted-foreground">(lbs/M)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.paperWeightPer1000}
                  onChange={(e) => setFormData({ ...formData, paperWeightPer1000: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Paper Cost <span className="text-xs text-muted-foreground">($/lb)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.paperCostPerLb}
                    onChange={(e) => setFormData({ ...formData, paperCostPerLb: e.target.value })}
                    placeholder="0.000"
                    className="w-full bg-background border border-border rounded-lg pl-7 pr-4 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Paper CPM <span className="text-xs text-muted-foreground">(auto)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.paperCPM}
                    onChange={(e) => setFormData({ ...formData, paperCPM: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-background border border-border rounded-lg pl-7 pr-12 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <span className="absolute right-3 top-2 text-muted-foreground">/M</span>
                </div>
              </div>
            </div>

            {formData.paperWeightPer1000 && formData.paperCostPerLb && (
              <div className="text-sm text-muted-foreground bg-muted/30 border border-border rounded-lg p-3">
                <strong>Calculation:</strong> {formData.paperWeightPer1000} lbs/M × ${formData.paperCostPerLb}/lb = ${formData.paperCPM}/M
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="pt-6 border-t border-border">
            <label className="block text-sm font-medium text-foreground mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about this pricing rule..."
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-foreground border border-border rounded-lg hover:bg-muted font-medium transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                rule ? 'Update Rule' : 'Create Rule'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
