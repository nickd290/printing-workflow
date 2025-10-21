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
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
      case 'ACCEPTED':
        return 'bg-blue-100 text-blue-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-900',
          accent: 'text-blue-600',
        };
      case 'purple':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          text: 'text-purple-900',
          accent: 'text-purple-600',
        };
      case 'green':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-900',
          accent: 'text-green-600',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-900',
          accent: 'text-gray-600',
        };
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Purchase Order Flow</h2>
        <div className="text-sm text-gray-500">
          Customer → Impact Direct → Bradford → JD Graphic
        </div>
      </div>

      {/* Flow Diagram */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stages.map((stage, index) => {
          const colors = getColorClasses(stage.color);
          const hasMargin = 'marginAmount' in stage.data;

          return (
            <div key={index} className="relative">
              {/* Arrow between stages */}
              {index < stages.length - 1 && (
                <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 z-10">
                  <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Stage Card */}
              <div className={`${colors.bg} ${colors.border} border-2 rounded-lg p-4 h-full`}>
                <div className="mb-3">
                  <h3 className={`font-semibold ${colors.text} text-sm mb-1`}>{stage.name}</h3>
                  <p className="text-xs text-gray-500">{stage.data.count} PO{stage.data.count !== 1 ? 's' : ''}</p>
                </div>

                <div className="space-y-2">
                  {/* Total Amount */}
                  <div>
                    <p className="text-xs text-gray-600">Total Amount</p>
                    <p className={`text-lg font-bold ${colors.accent}`}>
                      ${stage.data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Margin (if applicable) */}
                  {stage.showMargin && hasMargin && (
                    <div>
                      <p className="text-xs text-gray-600">Margin</p>
                      <p className="text-md font-semibold text-green-600">
                        ${(stage.data as any).marginAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}

                  {/* Status Breakdown */}
                  {stage.data.byStatus && Object.keys(stage.data.byStatus).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-600 mb-2">Status</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(stage.data.byStatus)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 3)
                          .map(([status, count]) => (
                            <span
                              key={status}
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}
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
      <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-200">
        <div className="text-center">
          <p className="text-xs text-gray-600 mb-1">Total Revenue</p>
          <p className="text-lg font-bold text-blue-600">
            ${data.summary.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 mb-1">Total Costs</p>
          <p className="text-lg font-bold text-red-600">
            ${data.summary.totalCosts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 mb-1">Impact Margin</p>
          <p className="text-lg font-bold text-purple-600">
            ${data.summary.impactMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 mb-1">Bradford Margin</p>
          <p className="text-lg font-bold text-green-600">
            ${data.summary.bradfordMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">How to read this chart:</p>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• <strong>Customer → Impact:</strong> Total revenue from customers</li>
          <li>• <strong>Impact → Bradford:</strong> Amount paid to Bradford (Impact keeps the margin)</li>
          <li>• <strong>Bradford → JD Graphic:</strong> Amount paid to JD Graphic (Bradford keeps the margin)</li>
        </ul>
      </div>
    </div>
  );
}
