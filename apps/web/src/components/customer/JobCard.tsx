'use client';

interface JobCardProps {
  job: any;
  onUploadFiles: (job: any) => void;
  onReviewProof: (job: any) => void;
  onViewBOL: (job: any) => void;
}

export function JobCard({ job, onUploadFiles, onReviewProof, onViewBOL }: JobCardProps) {
  const getStatusConfig = (status: string) => {
    const configs: Record<string, any> = {
      PENDING: {
        label: 'Pending',
        gradient: 'from-gray-400 to-gray-500',
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        dot: 'bg-gray-500',
      },
      IN_PRODUCTION: {
        label: 'In Production',
        gradient: 'from-blue-500 to-indigo-600',
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        dot: 'bg-blue-500',
      },
      READY_FOR_PROOF: {
        label: 'Ready for Proof',
        gradient: 'from-yellow-400 to-orange-500',
        bg: 'bg-yellow-100',
        text: 'text-orange-700',
        dot: 'bg-orange-500',
      },
      PROOF_APPROVED: {
        label: 'Proof Approved',
        gradient: 'from-green-500 to-emerald-600',
        bg: 'bg-green-100',
        text: 'text-green-700',
        dot: 'bg-green-500',
      },
      COMPLETED: {
        label: 'Completed',
        gradient: 'from-purple-500 to-purple-600',
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        dot: 'bg-purple-500',
      },
    };
    return configs[status] || configs.PENDING;
  };

  const getDeliveryUrgency = (deliveryDate?: string) => {
    if (!deliveryDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(deliveryDate);
    dueDate.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return { color: 'text-red-600', bg: 'bg-red-100', label: 'OVERDUE', dotColor: 'bg-red-500' };
    } else if (daysUntilDue <= 3) {
      return { color: 'text-orange-600', bg: 'bg-orange-100', label: `${daysUntilDue}d`, dotColor: 'bg-orange-500' };
    } else if (daysUntilDue <= 7) {
      return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: `${daysUntilDue}d`, dotColor: 'bg-yellow-500' };
    } else {
      return { color: 'text-green-600', bg: 'bg-green-100', label: `${daysUntilDue}d`, dotColor: 'bg-green-500' };
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const statusConfig = getStatusConfig(job.status);
  const urgency = getDeliveryUrgency(job.deliveryDate);

  const showUploadFiles = job.status === 'PENDING' && (job.requiredArtworkCount > 0 || job.requiredDataFileCount > 0);
  const showReviewProof = job.status === 'READY_FOR_PROOF';
  const showViewBOL = job.status === 'COMPLETED';

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group border border-gray-100 hover:border-gray-200">
      {/* Status Banner */}
      <div className={`h-2 bg-gradient-to-r ${statusConfig.gradient}`}></div>

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-bold text-gray-900">
                {job.customerPONumber || job.jobNo}
              </h3>
              {urgency && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${urgency.bg} ${urgency.color}`}>
                  <span className={`w-2 h-2 rounded-full ${urgency.dotColor} animate-pulse`}></span>
                  {urgency.label}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">Job #{job.jobNo}</p>
          </div>

          <div className={`px-3 py-1 rounded-lg ${statusConfig.bg} ${statusConfig.text} text-xs font-semibold flex items-center gap-1`}>
            <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></span>
            {statusConfig.label}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {job.specs?.description || 'No description available'}
        </p>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          {job.customerTotal && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Price</p>
              <p className="text-lg font-bold text-green-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07-.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                ${Number(job.customerTotal).toFixed(2)}
              </p>
            </div>
          )}

          {job.deliveryDate && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Delivery Date</p>
              <p className="text-sm font-semibold text-gray-700">{formatDate(job.deliveryDate)}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {showUploadFiles && (
            <button
              onClick={() => onUploadFiles(job)}
              className="flex-1 min-w-[120px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload Files
            </button>
          )}

          {showReviewProof && (
            <button
              onClick={() => onReviewProof(job)}
              className="flex-1 min-w-[120px] bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg animate-pulse"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Review Proof
            </button>
          )}

          {showViewBOL && (
            <button
              onClick={() => onViewBOL(job)}
              className="flex-1 min-w-[120px] bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View BOL
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
