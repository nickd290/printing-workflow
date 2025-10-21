'use client';

import { useState } from 'react';

interface PricingBreakdownProps {
  job: {
    quantity?: number;
    customerTotal: number;
    customerCPM?: number;
    impactMargin?: number;
    impactMarginCPM?: number;
    bradfordTotal?: number;
    bradfordTotalCPM?: number;
    bradfordTotalMargin?: number;
    bradfordPaperMargin?: number;
    jdTotal?: number;
    printCPM?: number;
    paperCostTotal?: number;
    paperCostCPM?: number;
    paperWeightTotal?: number;
    paperWeightPer1000?: number;
  };
  userRole?: 'BROKER_ADMIN' | 'BRADFORD_ADMIN' | 'CUSTOMER';
}

export function PricingBreakdown({ job, userRole }: PricingBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate derived values
  const hasQuantity = job.quantity && job.quantity > 0;
  const quantityInThousands = hasQuantity ? job.quantity! / 1000 : 0;

  // Format currency
  const fmt = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format number
  const fmtNum = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Check if we have pricing data
  const hasPricingData = job.impactMargin !== undefined || job.bradfordTotal !== undefined;

  if (!hasPricingData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>No pricing calculated yet.</strong> Pricing will be calculated once job details are complete.
        </p>
      </div>
    );
  }

  // Summary line for collapsed state
  const summary = userRole === 'BROKER_ADMIN'
    ? `Revenue ${fmt(job.customerTotal)} → Impact Margin ${fmt(job.impactMargin)} | Owed to Bradford ${fmt(job.bradfordTotal)}`
    : userRole === 'BRADFORD_ADMIN'
    ? `Invoice to Impact ${fmt(job.bradfordTotal)} → Print ${fmt(job.jdTotal)} | Paper ${fmt(job.paperCostTotal)} | Margin ${fmt(job.bradfordTotalMargin)}`
    : `Total: ${fmt(job.customerTotal)}`;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 bg-muted/30 hover:bg-muted/50 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-foreground">Pricing Breakdown</h3>
            {!isExpanded && (
              <p className="text-sm text-muted-foreground">{summary}</p>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-6 space-y-6 bg-card">
          {/* Quantity Info */}
          {hasQuantity && (
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Order Quantity</span>
                <span className="text-lg font-bold text-foreground">
                  {job.quantity!.toLocaleString()} pieces ({fmtNum(quantityInThousands)}M)
                </span>
              </div>
            </div>
          )}

          {/* BROKER_ADMIN (Impact Direct) View */}
          {userRole === 'BROKER_ADMIN' && (
            <>
              {/* Revenue Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Revenue (Customer Payment)
                </h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-green-700 font-medium">TOTAL</span>
                      <p className="text-2xl font-bold text-green-900">{fmt(job.customerTotal)}</p>
                    </div>
                    {job.customerCPM && (
                      <div>
                        <span className="text-xs text-green-700 font-medium">RATE (CPM)</span>
                        <p className="text-2xl font-bold text-green-900">{fmt(job.customerCPM)}/M</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Impact Direct's Share */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Impact Direct Margin (50% of Profit)
                </h4>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-purple-700 font-medium">TOTAL</span>
                      <p className="text-2xl font-bold text-purple-900">{fmt(job.impactMargin)}</p>
                    </div>
                    {job.impactMarginCPM && (
                      <div>
                        <span className="text-xs text-purple-700 font-medium">RATE (CPM)</span>
                        <p className="text-2xl font-bold text-purple-900">{fmt(job.impactMarginCPM)}/M</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Owed to Bradford */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  Owed to Bradford
                </h4>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-orange-700 font-medium">TOTAL</span>
                      <p className="text-2xl font-bold text-orange-900">{fmt(job.bradfordTotal)}</p>
                    </div>
                    {job.bradfordTotalCPM && (
                      <div>
                        <span className="text-xs text-orange-700 font-medium">RATE (CPM)</span>
                        <p className="text-2xl font-bold text-orange-900">{fmt(job.bradfordTotalCPM)}/M</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* BRADFORD_ADMIN View */}
          {userRole === 'BRADFORD_ADMIN' && (
            <>
              {/* Invoice to Impact */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Invoice to Impact Direct
                </h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-green-700 font-medium">TOTAL</span>
                      <p className="text-2xl font-bold text-green-900">{fmt(job.bradfordTotal)}</p>
                    </div>
                    {job.bradfordTotalCPM && (
                      <div>
                        <span className="text-xs text-green-700 font-medium">RATE (CPM)</span>
                        <p className="text-2xl font-bold text-green-900">{fmt(job.bradfordTotalCPM)}/M</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Costs */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Production Costs
                </h4>

                {/* JD Print Cost */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-orange-900">JD Graphic (Printing)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-orange-700 font-medium">TOTAL</span>
                      <p className="text-xl font-bold text-orange-900">{fmt(job.jdTotal)}</p>
                    </div>
                    {job.printCPM && (
                      <div>
                        <span className="text-xs text-orange-700 font-medium">RATE (CPM)</span>
                        <p className="text-xl font-bold text-orange-900">{fmt(job.printCPM)}/M</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Paper Cost */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-900">Paper Cost</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-red-700 font-medium">TOTAL</span>
                      <p className="text-xl font-bold text-red-900">{fmt(job.paperCostTotal)}</p>
                    </div>
                    {job.paperCostCPM && (
                      <div>
                        <span className="text-xs text-red-700 font-medium">RATE (CPM)</span>
                        <p className="text-xl font-bold text-red-900">{fmt(job.paperCostCPM)}/M</p>
                      </div>
                    )}
                  </div>
                  {job.paperWeightTotal && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-xs text-red-700 font-medium">TOTAL WEIGHT</span>
                          <p className="font-semibold text-red-900">{fmtNum(job.paperWeightTotal)} lbs</p>
                        </div>
                        {job.paperWeightPer1000 && (
                          <div>
                            <span className="text-xs text-red-700 font-medium">WEIGHT PER M</span>
                            <p className="font-semibold text-red-900">{fmtNum(job.paperWeightPer1000)} lbs/M</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bradford's Margin */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Bradford Margin (50% of Profit)
                </h4>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <span className="text-xs text-purple-700 font-medium">TOTAL PROFIT</span>
                      <p className="text-2xl font-bold text-purple-900">{fmt(job.bradfordTotalMargin)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CUSTOMER View - Simple */}
          {userRole === 'CUSTOMER' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-green-700 font-medium">YOUR TOTAL</span>
                  <p className="text-2xl font-bold text-green-900">{fmt(job.customerTotal)}</p>
                </div>
                {job.customerCPM && hasQuantity && (
                  <div>
                    <span className="text-xs text-green-700 font-medium">PRICE PER THOUSAND</span>
                    <p className="text-2xl font-bold text-green-900">{fmt(job.customerCPM)}/M</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
