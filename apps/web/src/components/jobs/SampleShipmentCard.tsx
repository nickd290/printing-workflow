'use client';

interface SampleShipment {
  id: string;
  description: string;
  carrier: string;
  trackingNo: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientAddress: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface SampleShipmentCardProps {
  sampleShipments: SampleShipment[];
  onRequestSample?: () => void;
}

export function SampleShipmentCard({ sampleShipments, onRequestSample }: SampleShipmentCardProps) {
  // Carrier tracking URL mapping
  const getTrackingUrl = (carrier: string, trackingNo: string): string => {
    const lowerCarrier = carrier.toLowerCase();

    if (lowerCarrier.includes('ups')) {
      return `https://www.ups.com/track?tracknum=${trackingNo}`;
    } else if (lowerCarrier.includes('fedex')) {
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNo}`;
    } else if (lowerCarrier.includes('usps')) {
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNo}`;
    } else if (lowerCarrier.includes('dhl')) {
      return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNo}`;
    }

    return '#'; // Default fallback
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Sample Shipments</h3>
          <p className="text-sm text-gray-500 mt-1">
            {sampleShipments.length > 0
              ? `${sampleShipments.length} sample${sampleShipments.length > 1 ? 's' : ''} sent`
              : 'No samples sent yet'}
          </p>
        </div>
        {onRequestSample && (
          <button
            onClick={onRequestSample}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Request Sample
          </button>
        )}
      </div>

      {/* Sample Shipments List */}
      {sampleShipments.length > 0 ? (
        <div className="space-y-3">
          {sampleShipments.map((sample) => (
            <div
              key={sample.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* Header Row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">{sample.description}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{sample.carrier}</span>
                      {sample.sentAt && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-xs text-gray-500">
                            Sent {new Date(sample.sentAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {sample.sentAt ? (
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-md">
                    Sent
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-md">
                    Pending
                  </span>
                )}
              </div>

              {/* Tracking Number */}
              {sample.trackingNo && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-xs font-medium text-gray-700">Tracking:</span>
                      <span className="text-sm font-mono font-semibold text-gray-900">{sample.trackingNo}</span>
                    </div>
                    <a
                      href={getTrackingUrl(sample.carrier, sample.trackingNo)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1"
                    >
                      Track
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              )}

              {/* Recipient Info */}
              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Recipient:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm text-gray-900">{sample.recipientName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-gray-600">{sample.recipientEmail}</span>
                  </div>
                  {sample.recipientAddress && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm text-gray-600">{sample.recipientAddress}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-sm font-medium text-gray-900 mb-1">No samples sent yet</p>
          <p className="text-sm text-gray-500 mb-4">Request a sample to see tracking information here</p>
          {onRequestSample && (
            <button
              onClick={onRequestSample}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Request Sample
            </button>
          )}
        </div>
      )}
    </div>
  );
}
