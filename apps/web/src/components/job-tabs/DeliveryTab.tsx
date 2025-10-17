'use client';

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

interface DeliveryTabProps {
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

export function DeliveryTab({
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
}: DeliveryTabProps) {
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
    <div className="space-y-8">
      {/* Delivery Information Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Information</h3>

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          {/* Expected Delivery Date */}
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
              <p className="text-lg font-semibold text-gray-900">
                {deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Not set'}
              </p>
            )}
          </div>

          {/* Packing Slip Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Packing Slip Notes
            </label>
            {isAdmin ? (
              <textarea
                value={packingSlipNotes}
                onChange={(e) => setPackingSlipNotes(e.target.value)}
                rows={4}
                placeholder="Add special instructions for packing slips..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">
                  {packingSlipNotes || 'No special instructions'}
                </p>
              </div>
            )}
          </div>

          {/* Save Button (Admin Only) */}
          {isAdmin && (
            <button
              onClick={onUpdateDelivery}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
            >
              Update Delivery Information
            </button>
          )}
        </div>
      </div>

      {/* Main Shipments Section */}
      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Main Shipments</h3>

        {shipments.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No shipments scheduled yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shipments.map((shipment) => (
              <div key={shipment.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <svg className="h-8 w-8 text-blue-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{shipment.carrier}</p>
                    {shipment.trackingNo && (
                      <p className="text-sm text-gray-600">Tracking: {shipment.trackingNo}</p>
                    )}
                    {shipment.shippedAt && (
                      <p className="text-xs text-gray-500">
                        Shipped: {new Date(shipment.shippedAt).toLocaleDateString()}
                      </p>
                    )}
                    {shipment.scheduledAt && !shipment.shippedAt && (
                      <p className="text-xs text-gray-500">
                        Scheduled: {new Date(shipment.scheduledAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                {shipment.trackingNo && (
                  <a
                    href={`https://www.google.com/search?q=${shipment.carrier}+tracking+${shipment.trackingNo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Track Package
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sample Shipments Section */}
      <div className="border-t border-gray-200 pt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Sample Shipments</h3>
          {isAdmin && (
            <button
              onClick={() => setShowSampleModal(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Sample
            </button>
          )}
        </div>

        {sampleShipments.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No sample shipments yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sampleShipments.map((sample) => (
              <div key={sample.id} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <svg className="h-5 w-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                      </svg>
                      <p className="font-semibold text-gray-900">{sample.recipientName}</p>
                    </div>
                    <p className="text-sm text-gray-600 ml-7">{sample.recipientEmail}</p>
                    {sample.recipientAddress && (
                      <p className="text-sm text-gray-600 ml-7">{sample.recipientAddress}</p>
                    )}
                    <div className="mt-3 ml-7 space-y-1">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Carrier:</span> {sample.carrier}
                      </p>
                      {sample.trackingNo && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Tracking:</span> {sample.trackingNo}
                        </p>
                      )}
                      {sample.sentAt && (
                        <p className="text-xs text-gray-500">
                          Sent: {new Date(sample.sentAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {sample.trackingNo && (
                    <a
                      href={`https://www.google.com/search?q=${sample.carrier}+tracking+${sample.trackingNo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors"
                    >
                      Track
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
                      + Add Another Recipient
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
                    Add Sample Shipment
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
