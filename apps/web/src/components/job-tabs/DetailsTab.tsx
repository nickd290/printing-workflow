'use client';

interface Job {
  id: string;
  jobNo: string;
  status: string;
  specs: any;
  customerTotal: number;
  deliveryDate?: string;
  packingSlipNotes?: string;
  customerPONumber?: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
}

interface Shipment {
  id: string;
  carrier: string;
  trackingNo?: string;
  scheduledAt?: string;
  shippedAt?: string;
}

interface SampleShipment {
  id: string;
  recipientName: string;
  recipientEmail: string;
  recipientAddress?: string;
  carrier: string;
  trackingNo?: string;
  sentAt?: string;
}

interface DetailsTabProps {
  job: Job;
  isAdmin: boolean;
  deliveryDate: string;
  setDeliveryDate: (date: string) => void;
  packingSlipNotes: string;
  setPackingSlipNotes: (notes: string) => void;
  onUpdateDelivery: () => void;
  shipments: Shipment[];
  sampleShipments: SampleShipment[];
  onAddSample: () => void;
  showSampleModal: boolean;
  setShowSampleModal: (show: boolean) => void;
  sampleRecipients: Array<{ name: string; email: string; address: string }>;
  setSampleRecipients: (recipients: Array<{ name: string; email: string; address: string }>) => void;
  sampleCarrier: string;
  setSampleCarrier: (carrier: string) => void;
  sampleTracking: string;
  setSampleTracking: (tracking: string) => void;
  onAddSampleShipment: () => void;
}

export function DetailsTab({
  job,
  isAdmin,
  deliveryDate,
  setDeliveryDate,
  packingSlipNotes,
  setPackingSlipNotes,
  onUpdateDelivery,
  shipments,
  sampleShipments,
  onAddSample,
  showSampleModal,
  setShowSampleModal,
  sampleRecipients,
  setSampleRecipients,
  sampleCarrier,
  setSampleCarrier,
  sampleTracking,
  setSampleTracking,
  onAddSampleShipment,
}: DetailsTabProps) {
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

  const addRecipient = () => {
    setSampleRecipients([...sampleRecipients, { name: '', email: '', address: '' }]);
  };

  const removeRecipient = (index: number) => {
    setSampleRecipients(sampleRecipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, field: 'name' | 'email' | 'address', value: string) => {
    const updated = [...sampleRecipients];
    updated[index][field] = value;
    setSampleRecipients(updated);
  };

  return (
    <div className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Job Information */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status)}`}>
                  {job.status.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Total</span>
                <span className="text-lg font-bold text-green-600">${Number(job.customerTotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Created</span>
                <span className="text-sm text-gray-900">{new Date(job.createdAt).toLocaleDateString()}</span>
              </div>
              {job.customerPONumber && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">PO Number</span>
                  <span className="text-sm text-gray-900 font-medium">{job.customerPONumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer</h3>
            <div className="flex items-center">
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

          {/* Job Specifications */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Specifications</h3>
            {Object.keys(job.specs || {}).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No specifications provided</p>
            ) : (
              <dl className="space-y-3">
                {Object.entries(job.specs || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <dt className="text-sm font-medium text-gray-600 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </dt>
                    <dd className="text-sm text-gray-900 font-semibold">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Delivery Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Delivery Date
                </label>
                {isAdmin ? (
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-base font-semibold text-gray-900">
                    {deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'Not set'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Packing Slip Notes
                </label>
                {isAdmin ? (
                  <textarea
                    value={packingSlipNotes}
                    onChange={(e) => setPackingSlipNotes(e.target.value)}
                    rows={3}
                    placeholder="Add special instructions..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-700">
                      {packingSlipNotes || 'No special instructions'}
                    </p>
                  </div>
                )}
              </div>

              {isAdmin && (
                <button
                  onClick={onUpdateDelivery}
                  className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
                >
                  Update Delivery Info
                </button>
              )}
            </div>
          </div>

          {/* Shipments */}
          {(shipments.length > 0 || sampleShipments.length > 0) && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipments</h3>

              {/* Main Shipments */}
              {shipments.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Main Shipment</p>
                  <div className="space-y-2">
                    {shipments.map((shipment) => (
                      <div key={shipment.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center">
                          <svg className="h-6 w-6 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                          </svg>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{shipment.carrier}</p>
                            {shipment.trackingNo && (
                              <p className="text-xs text-gray-600">{shipment.trackingNo}</p>
                            )}
                          </div>
                        </div>
                        {shipment.trackingNo && (
                          <a
                            href={`https://www.google.com/search?q=${shipment.carrier}+tracking+${shipment.trackingNo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            Track
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Shipments */}
              {sampleShipments.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-600">Samples</p>
                    {isAdmin && (
                      <button
                        onClick={() => setShowSampleModal(true)}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {sampleShipments.map((sample) => (
                      <div key={sample.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{sample.recipientName}</p>
                            <p className="text-xs text-gray-600">{sample.recipientEmail}</p>
                            {sample.trackingNo && (
                              <p className="text-xs text-gray-600 mt-1">{sample.carrier}: {sample.trackingNo}</p>
                            )}
                          </div>
                          {sample.trackingNo && (
                            <a
                              href={`https://www.google.com/search?q=${sample.carrier}+tracking+${sample.trackingNo}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                            >
                              Track
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Sample Button */}
              {isAdmin && sampleShipments.length === 0 && (
                <button
                  onClick={() => setShowSampleModal(true)}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-green-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                >
                  + Add Sample Shipment
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sample Shipment Modal */}
      {showSampleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Add Sample Shipment</h3>
                <button
                  onClick={() => setShowSampleModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Recipients */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">Recipients</label>
                    <button
                      onClick={addRecipient}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Add Another
                    </button>
                  </div>

                  <div className="space-y-4">
                    {sampleRecipients.map((recipient, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">Recipient {index + 1}</span>
                          {sampleRecipients.length > 1 && (
                            <button
                              onClick={() => removeRecipient(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={recipient.name}
                            onChange={(e) => updateRecipient(index, 'name', e.target.value)}
                            placeholder="Name"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="email"
                            value={recipient.email}
                            onChange={(e) => updateRecipient(index, 'email', e.target.value)}
                            placeholder="Email"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <textarea
                            value={recipient.address}
                            onChange={(e) => updateRecipient(index, 'address', e.target.value)}
                            placeholder="Address (Optional)"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Carrier</label>
                    <select
                      value={sampleCarrier}
                      onChange={(e) => setSampleCarrier(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select carrier...</option>
                      <option value="UPS">UPS</option>
                      <option value="FedEx">FedEx</option>
                      <option value="USPS">USPS</option>
                      <option value="DHL">DHL</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tracking Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={sampleTracking}
                      onChange={(e) => setSampleTracking(e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowSampleModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onAddSampleShipment}
                    className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors"
                  >
                    Add Sample
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
