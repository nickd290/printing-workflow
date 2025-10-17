'use client';

interface Job {
  id: string;
  jobNo: string;
  status: string;
  specs: any;
  customerTotal: number;
  deliveryDate?: string;
  customerPONumber?: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
}

interface OverviewTabProps {
  job: Job;
}

export function OverviewTab({ job }: OverviewTabProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Job Information Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg">
            <dt className="text-sm font-medium text-gray-500">Job Number</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">{job.jobNo}</dd>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(job.status)}`}>
                {job.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </dd>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <dt className="text-sm font-medium text-gray-500">Customer Total</dt>
            <dd className="mt-1 text-lg font-bold text-green-600">${Number(job.customerTotal).toFixed(2)}</dd>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <dt className="text-sm font-medium text-gray-500">Created Date</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">
              {new Date(job.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </dd>
          </div>
        </div>
      </div>

      {/* Customer Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mr-4">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{job.customer.name}</p>
              <p className="text-sm text-gray-600">{job.customer.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Job Specifications */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Specifications</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          {Object.keys(job.specs || {}).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No specifications provided</p>
          ) : (
            <dl className="grid grid-cols-2 gap-4">
              {Object.entries(job.specs || {}).map(([key, value]) => (
                <div key={key} className="bg-gray-50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 font-semibold">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {/* Order Information */}
      {(job.customerPONumber || job.deliveryDate) && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Information</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="grid grid-cols-2 gap-4">
              {job.customerPONumber && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500">Customer PO Number</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-semibold">{job.customerPONumber}</dd>
                </div>
              )}
              {job.deliveryDate && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500">Expected Delivery</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-semibold">
                    {new Date(job.deliveryDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </dd>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Timeline (Placeholder for future enhancement) */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-900">Job Created</p>
                <p className="text-sm text-gray-500">
                  {new Date(job.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            {job.status !== 'PENDING' && (
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-900">Status: {job.status.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-gray-500">Current status</p>
                </div>
              </div>
            )}

            {job.deliveryDate && (
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-900">Expected Delivery</p>
                  <p className="text-sm text-gray-500">
                    {new Date(job.deliveryDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
