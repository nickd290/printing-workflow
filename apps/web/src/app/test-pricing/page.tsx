'use client';

import { useState } from 'react';
import { PricingCalculator } from '@/components/PricingCalculator';
import { Navigation } from '@/components/navigation';
import type { CustomJobPricing } from '@printing-workflow/shared';

export default function TestPricingPage() {
  const [pricing, setPricing] = useState<CustomJobPricing | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pricing Calculator Test</h1>
          <p className="mt-2 text-sm text-gray-600">
            Test the broker pricing model with standard and custom pricing
          </p>
        </div>

        {/* Pricing Calculator */}
        <PricingCalculator onPricingChange={setPricing} />

        {/* Debug Output */}
        {pricing && (
          <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Details (Debug)</h3>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Job Info</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Size:</span>
                    <span className="font-medium">{pricing.sizeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium">{pricing.quantity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Custom Pricing:</span>
                    <span className={`font-medium ${pricing.isCustomPricing ? 'text-blue-600' : 'text-gray-500'}`}>
                      {pricing.isCustomPricing ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Loss Scenario:</span>
                    <span className={`font-medium ${pricing.isLoss ? 'text-red-600' : 'text-green-600'}`}>
                      {pricing.isLoss ? `Yes (-$${pricing.lossAmount.toFixed(2)})` : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Totals</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer Total:</span>
                    <span className="font-medium">${pricing.customerTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bradford Total:</span>
                    <span className="font-medium">${pricing.bradfordTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Impact Margin:</span>
                    <span className="font-medium text-green-600">${pricing.impactMargin.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bradford Margin:</span>
                    <span className="font-medium text-purple-600">${pricing.bradfordPrintMargin.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">JD Total:</span>
                    <span className="font-medium">${pricing.jdTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">CPM Rates</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer CPM:</span>
                  <span className="font-medium">${pricing.customerCPM.toFixed(2)}/M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Impact CPM:</span>
                  <span className="font-medium text-green-600">${pricing.impactMarginCPM.toFixed(2)}/M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bradford CPM:</span>
                  <span className="font-medium text-purple-600">${pricing.bradfordPrintMarginCPM.toFixed(2)}/M</span>
                </div>
              </div>
            </div>

            {/* Test Scenarios Helper */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-semibold text-sm text-gray-700 mb-3">Test Scenarios</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs">
                  <div className="font-semibold text-blue-900">Standard Pricing</div>
                  <div className="text-blue-700 mt-1">Leave custom price empty</div>
                  <div className="text-blue-600 mt-2">Should show 50/50 split</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-3 text-xs">
                  <div className="font-semibold text-green-900">Custom Above Cost</div>
                  <div className="text-green-700 mt-1">Enter price &gt; Bradford cost</div>
                  <div className="text-green-600 mt-2">Margins recalculate 50/50</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-3 text-xs">
                  <div className="font-semibold text-red-900">Below Cost (Loss)</div>
                  <div className="text-red-700 mt-1">Enter price &lt; Bradford cost</div>
                  <div className="text-red-600 mt-2">Shows warning, needs approval</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
