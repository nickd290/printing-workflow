'use client';

import { POFlowMetrics } from '@/lib/api-client';

interface POFlowChartProps {
  data: POFlowMetrics;
}

export function POFlowChart({ data }: POFlowChartProps) {
  const stages = [
    {
      name: 'Customer → Impact',
      shortName: 'Customer',
      data: data.stages.customerToImpact,
      color: 'blue',
      showMargin: false,
    },
    {
      name: 'Impact → Bradford',
      shortName: 'Impact',
      data: data.stages.impactToBradford,
      color: 'purple',
      showMargin: true,
    },
    {
      name: 'Bradford → JD Graphic',
      shortName: 'Bradford',
      data: data.stages.bradfordToJD,
      color: 'green',
      showMargin: true,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-success/10 text-success';
      case 'IN_PROGRESS':
      case 'ACCEPTED':
        return 'bg-primary/10 text-primary';
      case 'PENDING':
        return 'bg-warning/10 text-warning';
      case 'CANCELLED':
        return 'bg-danger/10 text-danger';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-primary/5',
          border: 'border-primary/20',
          text: 'text-foreground',
          accent: 'text-primary',
        };
      case 'purple':
        return {
          bg: 'bg-info/5',
          border: 'border-info/20',
          text: 'text-foreground',
          accent: 'text-info',
        };
      case 'green':
        return {
          bg: 'bg-success/5',
          border: 'border-success/20',
          text: 'text-foreground',
          accent: 'text-success',
        };
      default:
        return {
          bg: 'bg-background-subtle',
          border: 'border-border',
          text: 'text-foreground',
          accent: 'text-muted-foreground',
        };
    }
  };

  return (
    <div className="mt-8 px-8">
      <div className="section-header">
        <h2 className="section-title">Purchase Order Flow</h2>
        <div className="text-xs text-muted-foreground">
          Customer → Impact Direct → Bradford → JD Graphic
        </div>
      </div>

      {/* Flow Diagram */}
      <div className="flow-container grid grid-cols-3 gap-6 mb-8">
        {stages.map((stage, index) => {
          const colors = getColorClasses(stage.color);
          const hasMargin = 'marginAmount' in stage.data;

          return (
            <div key={index} className="relative">
              {/* Arrow between stages */}
              {index < stages.length - 1 && (
                <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 z-10">
                  <svg className="w-5 h-5 text-muted-foreground/40" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Stage Card */}
              <div className={`${colors.bg} ${colors.border} border rounded-md p-4 h-full`}>
                <div className="mb-3">
                  <h3 className={`font-medium ${colors.text} text-sm mb-0.5`}>{stage.name}</h3>
                  <p className="text-xs text-muted-foreground">{stage.data.count} PO{stage.data.count !== 1 ? 's' : ''}</p>
                </div>

                <div className="space-y-3">
                  {/* Total Amount */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                    <p className={`text-lg font-semibold ${colors.accent}`}>
                      ${stage.data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Margin (if applicable) */}
                  {stage.showMargin && hasMargin && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Margin</p>
                      <p className="text-sm font-medium text-success">
                        ${(stage.data as any).marginAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}

                  {/* Status Breakdown */}
                  {stage.data.byStatus && Object.keys(stage.data.byStatus).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(stage.data.byStatus)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 3)
                          .map(([status, count]) => (
                            <span
                              key={status}
                              className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(status)}`}
                            >
                              {status.replace('_', ' ')}: {count}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-4 gap-6 pt-6 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-lg font-semibold text-primary">
            ${data.summary.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Costs</p>
          <p className="text-lg font-semibold text-danger">
            ${data.summary.totalCosts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Impact Margin</p>
          <p className="text-lg font-semibold text-info">
            ${data.summary.impactMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Bradford Margin</p>
          <p className="text-lg font-semibold text-success">
            ${data.summary.bradfordMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">How to read this chart:</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• <span className="font-medium text-foreground">Customer → Impact:</span> Total revenue from customers</li>
          <li>• <span className="font-medium text-foreground">Impact → Bradford:</span> Amount paid to Bradford (Impact keeps the margin)</li>
          <li>• <span className="font-medium text-foreground">Bradford → JD Graphic:</span> Amount paid to JD Graphic (Bradford keeps the margin)</li>
        </ul>
      </div>
    </div>
  );
}
