'use client';

import { useState, useEffect } from 'react';
import {
  getAvailableSizes,
  calculateCustomPricing,
  getBradfordBaseCost,
  type CustomJobPricing
} from '@printing-workflow/shared';

interface PricingCalculatorProps {
  onPricingChange?: (pricing: CustomJobPricing, customPaperCPM?: number) => void;
  initialSizeId?: string;
  initialQuantity?: number;
  initialCustomPrice?: number;
}

export function PricingCalculator({
  onPricingChange,
  initialSizeId,
  initialQuantity,
  initialCustomPrice
}: PricingCalculatorProps) {
  const sizes = getAvailableSizes();

  const [sizeId, setSizeId] = useState(initialSizeId || sizes[0]?.id || '');
  const [quantity, setQuantity] = useState(initialQuantity || 10000);
  const [customPrice, setCustomPrice] = useState<number | undefined>(initialCustomPrice);
  const [customPaperCPM, setCustomPaperCPM] = useState<number | undefined>(undefined);
  const [enablePaperOverride, setEnablePaperOverride] = useState(false);
  const [pricing, setPricing] = useState<CustomJobPricing | null>(null);

  // Calculate pricing whenever inputs change
  useEffect(() => {
    if (!sizeId || !quantity || quantity <= 0) {
      setPricing(null);
      return;
    }

    try {
      const effectivePaperCPM = enablePaperOverride ? customPaperCPM : undefined;
      const calculatedPricing = calculateCustomPricing(
        sizeId,
        quantity,
        customPrice,
        effectivePaperCPM
      );
      setPricing(calculatedPricing);
      onPricingChange?.(calculatedPricing, effectivePaperCPM);
    } catch (error) {
      console.error('Pricing calculation error:', error);
      setPricing(null);
    }
  }, [sizeId, quantity, customPrice, customPaperCPM, enablePaperOverride, onPricingChange]);

  const bradfordCost = sizeId ? getBradfordBaseCost(sizeId) : null;

  const handleCustomPriceChange = (value: string) => {
    if (value === '') {
      setCustomPrice(undefined);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setCustomPrice(numValue);
      }
    }
  };

  return (
    <div className="space-y-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Calculator</h3>

        {/* Size & Quantity Inputs */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Size
            </label>
            <select
              value={sizeId}
              onChange={(e) => setSizeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sizes.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              min="1"
              step="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {pricing && (
          <>
            {/* Standard Pricing Display */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">Standard Pricing</h4>
                {bradfordCost && (
                  <span className="text-xs text-gray-500">
                    Bradford Cost: ${bradfordCost.cpm}/M
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Customer Price</div>
                  <div className="text-lg font-bold text-blue-600">
                    ${pricing.standardCustomerPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${pricing.customerCPM.toFixed(2)}/M
                  </div>
                </div>

                <div>
                  <div className="text-gray-600">Impact Margin</div>
                  <div className="text-lg font-bold text-green-600">
                    ${((pricing.standardCustomerPrice - pricing.customerTotal) / 2 + pricing.impactMargin).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div>
                  <div className="text-gray-600">Bradford Margin</div>
                  <div className="text-lg font-bold text-purple-600">
                    ${((pricing.standardCustomerPrice - pricing.customerTotal) / 2 + pricing.impactMargin).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Pricing Input */}
            <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Custom Customer Price (Optional)
              </label>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-600">$</span>
                <input
                  type="number"
                  value={customPrice ?? ''}
                  onChange={(e) => handleCustomPriceChange(e.target.value)}
                  placeholder={pricing.standardCustomerPrice.toFixed(2)}
                  step="0.01"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {customPrice !== undefined && (
                  <button
                    onClick={() => setCustomPrice(undefined)}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Paper CPM Override Section */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="enablePaperOverride"
                    checked={enablePaperOverride}
                    onChange={(e) => setEnablePaperOverride(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="enablePaperOverride" className="text-sm font-medium text-gray-700">
                    Override Bradford Paper CPM (per job adjustment)
                  </label>
                </div>

                {enablePaperOverride && (
                  <div className="ml-6">
                    <label className="block text-sm text-gray-600 mb-2">
                      Bradford Paper CPM ($/M)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">$</span>
                      <input
                        type="number"
                        value={customPaperCPM ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            setCustomPaperCPM(undefined);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              setCustomPaperCPM(numValue);
                            }
                          }
                        }}
                        placeholder={pricing ? pricing.paperChargedCPM.toFixed(2) : ''}
                        step="0.01"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-sm text-gray-500">/M</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Standard: ${pricing?.paperChargedCPM.toFixed(2)}/M
                    </p>
                  </div>
                )}
              </div>

              {/* Custom Pricing Results */}
              {pricing.isCustomPricing && (
                <div className="mt-4">
                  {/* Loss Warning */}
                  {pricing.isLoss && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-red-800">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <div className="font-semibold">Below Cost - Requires Approval</div>
                          <div className="text-sm">Loss: ${pricing.lossAmount.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recalculated Margins */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className={pricing.isLoss ? 'opacity-75' : ''}>
                      <div className="text-gray-600">Actual Price</div>
                      <div className="text-lg font-bold text-blue-600">
                        ${pricing.customerTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className={pricing.isLoss ? 'opacity-75' : ''}>
                      <div className="text-gray-600">Impact Margin</div>
                      <div className={`text-lg font-bold ${pricing.isLoss ? 'text-red-600' : 'text-green-600'}`}>
                        ${pricing.impactMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">
                        ${pricing.impactMarginCPM.toFixed(2)}/M
                      </div>
                    </div>

                    <div className={pricing.isLoss ? 'opacity-75' : ''}>
                      <div className="text-gray-600">Bradford Margin</div>
                      <div className={`text-lg font-bold ${pricing.isLoss ? 'text-red-600' : 'text-purple-600'}`}>
                        ${pricing.bradfordPrintMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">
                        ${pricing.bradfordPrintMarginCPM.toFixed(2)}/M
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="mt-4 text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded p-3">
                    <div className="font-semibold mb-1">How this works:</div>
                    <div>Bradford Cost: ${(pricing.customerTotal - pricing.impactMargin - pricing.bradfordPrintMargin).toFixed(2)} (fixed)</div>
                    <div>Total Margin: ${(pricing.impactMargin + pricing.bradfordPrintMargin).toFixed(2)} (split 50/50)</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
