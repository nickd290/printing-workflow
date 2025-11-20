'use client';

interface BradfordPrioritySectionProps {
  jobs: any[];
  onCreatePO: (jobId: string) => void;
}

export function BradfordPrioritySection({ jobs, onCreatePO }: BradfordPrioritySectionProps) {
  // Filter jobs that need JD POs
  const jobsNeedingPO = jobs.filter((job) => {
    // Filter out jobs with $0 Bradford total
    if (!job.bradfordTotal || parseFloat(job.bradfordTotal) <= 0) {
      return false;
    }

    // Has incoming PO from Impact → Bradford
    const hasIncomingPO = job.purchaseOrders?.some((po: any) =>
      po.originCompanyId === 'impact-direct' && po.targetCompanyId === 'bradford'
    );

    // Does NOT have outgoing PO from Bradford → JD
    const hasOutgoingPO = job.purchaseOrders?.some((po: any) =>
      po.originCompanyId === 'bradford' && po.targetCompanyId === 'jd-graphic'
    );

    return hasIncomingPO && !hasOutgoingPO;
  });

  if (jobsNeedingPO.length === 0) {
    return null;
  }

  const getCustomerName = (job: any) => {
    return typeof job.customer === 'string' ? job.customer : job.customer?.name || 'Unknown Customer';
  };

  const formatNumber = (num: any, decimals: number = 2) => {
    if (num === null || num === undefined) return 'N/A';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  return (
    <div className="mb-6 bg-red-50 border-2 border-red-500 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-red-100 border-b border-red-500">
        <span className="text-red-600 text-2xl">🔴</span>
        <h2 className="text-xl font-bold text-red-700">
          ACTION REQUIRED: {jobsNeedingPO.length} Job{jobsNeedingPO.length > 1 ? 's' : ''} Need JD PO
        </h2>
      </div>

      <div className="bg-white">
        <table className="min-w-full divide-y divide-red-200">
          <thead className="bg-red-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                Job Info
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                Production
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                Financial
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-red-100">
            {jobsNeedingPO.map((job) => {
              const customerName = getCustomerName(job);

              return (
                <tr key={job.id} className="hover:bg-red-50">
                  {/* Job Info */}
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-gray-900">{job.jobNo}</div>
                    <div className="text-sm text-gray-600">{customerName}</div>
                    {job.customerPONumber && (
                      <div className="text-xs text-gray-500">Customer PO: {job.customerPONumber}</div>
                    )}
                  </td>

                  {/* Production */}
                  <td className="px-4 py-3">
                    <div className="text-xs space-y-0.5">
                      <div>
                        <span className="font-medium">Qty:</span> {job.quantity ? formatNumber(job.quantity, 0) : 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Paper:</span> {job.paperType || 'N/A'}
                      </div>
                    </div>
                  </td>

                  {/* Financial */}
                  <td className="px-4 py-3">
                    <div className="text-xs space-y-0.5">
                      <div>
                        <span className="font-medium">Receives:</span>{' '}
                        <span className="text-green-700 font-semibold">
                          ${job.bradfordTotal ? formatNumber(job.bradfordTotal) : '0.00'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Profit:</span>{' '}
                        <span className="text-green-700 font-semibold">
                          ${job.bradfordTotalMargin ? formatNumber(job.bradfordTotalMargin) : '0.00'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => onCreatePO(job.id)}
                      className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-red-700"
                    >
                      Create PO
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
