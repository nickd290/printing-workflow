'use client';

import { useState, useEffect } from 'react';
import { vendorsAPI, type Vendor } from '@/lib/api-client';

interface JobFormData {
  description: string;
  paper: string;
  flatSize: string;
  foldedSize: string;
  colors: string;
  finishing: string;
  total: string;
  poNumber: string;
  deliveryDate: string;
  samples: string;
  requiredArtworkCount: number;
  requiredDataFileCount: number;
  // Routing fields
  routingType?: 'BRADFORD_JD' | 'THIRD_PARTY_VENDOR';
  vendorId?: string;
  vendorAmount?: string;
  bradfordCut?: string;
}

interface JobFormFieldsProps {
  data: Partial<JobFormData>;
  onChange: (field: keyof JobFormData, value: string | number) => void;
  disabled?: boolean;
  showFileRequirements?: boolean;
  showRoutingOptions?: boolean; // Only shown to admins
}

export function JobFormFields({
  data,
  onChange,
  disabled = false,
  showFileRequirements = true,
  showRoutingOptions = false
}: JobFormFieldsProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Load vendors when routing options are shown
  useEffect(() => {
    if (showRoutingOptions) {
      const loadVendors = async () => {
        try {
          setLoadingVendors(true);
          const data = await vendorsAPI.list({ isActive: true });
          setVendors(data);
        } catch (error) {
          console.error('Failed to load vendors:', error);
        } finally {
          setLoadingVendors(false);
        }
      };
      loadVendors();
    }
  }, [showRoutingOptions]);

  const routingType = data.routingType || 'BRADFORD_JD';
  const isThirdPartyVendor = routingType === 'THIRD_PARTY_VENDOR';

  return (
    <div className="space-y-6">
      {/* Job Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Job Description *
        </label>
        <input
          type="text"
          value={data.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          disabled={disabled}
          placeholder="e.g., Tri-fold Brochures, Business Cards"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
        />
      </div>

      {/* Routing Options (Admin Only) */}
      {showRoutingOptions && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Production Routing</h3>

          {/* Routing Type Selection */}
          <div className="space-y-3 mb-4">
            <label className="flex items-start p-3 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="routingType"
                value="BRADFORD_JD"
                checked={routingType === 'BRADFORD_JD'}
                onChange={(e) => onChange('routingType', e.target.value)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">Bradford → JD Graphic</div>
                <div className="text-sm text-gray-500">Traditional routing with auto-calculated pricing</div>
              </div>
            </label>

            <label className="flex items-start p-3 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="routingType"
                value="THIRD_PARTY_VENDOR"
                checked={routingType === 'THIRD_PARTY_VENDOR'}
                onChange={(e) => onChange('routingType', e.target.value)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">Third-Party Vendor</div>
                <div className="text-sm text-gray-500">Direct to external vendor with manual pricing</div>
              </div>
            </label>
          </div>

          {/* Third-Party Vendor Fields */}
          {isThirdPartyVendor && (
            <div className="space-y-4 mt-4 p-4 bg-blue-50 rounded-md border border-blue-200">
              {/* Vendor Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Select Vendor *
                </label>
                <select
                  value={data.vendorId || ''}
                  onChange={(e) => onChange('vendorId', e.target.value)}
                  disabled={disabled || loadingVendors}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                >
                  <option value="">-- Select a vendor --</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
                {loadingVendors && (
                  <p className="mt-1 text-xs text-gray-500">Loading vendors...</p>
                )}
              </div>

              {/* Vendor Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Vendor Quote Amount *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={data.vendorAmount || ''}
                    onChange={(e) => onChange('vendorAmount', e.target.value)}
                    disabled={disabled}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Amount quoted by the third-party vendor
                </p>
              </div>

              {/* Bradford Cut */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Bradford's Cut *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={data.bradfordCut || ''}
                    onChange={(e) => onChange('bradfordCut', e.target.value)}
                    disabled={disabled}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Bradford's portion of the profit
                </p>
              </div>

              {/* Margin Calculation Helper */}
              {data.total && data.vendorAmount && data.bradfordCut && (
                <div className="mt-3 p-3 bg-white rounded border border-blue-300">
                  <div className="text-xs font-medium text-gray-700 mb-2">Margin Breakdown:</div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Customer Total:</span>
                      <span className="font-medium">${parseFloat(data.total || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Vendor Amount:</span>
                      <span className="font-medium">-${parseFloat(data.vendorAmount || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bradford's Cut:</span>
                      <span className="font-medium">-${parseFloat(data.bradfordCut || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-200">
                      <span className="font-semibold">Impact Margin:</span>
                      <span className={`font-semibold ${
                        parseFloat(data.total) - parseFloat(data.vendorAmount) - parseFloat(data.bradfordCut) >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        ${(parseFloat(data.total || '0') - parseFloat(data.vendorAmount || '0') - parseFloat(data.bradfordCut || '0')).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Paper Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Paper Type
        </label>
        <input
          type="text"
          value={data.paper || ''}
          onChange={(e) => onChange('paper', e.target.value)}
          disabled={disabled}
          placeholder="e.g., 100lb Gloss Text, 14pt C2S"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
        />
      </div>

      {/* Sizes */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Flat Size
          </label>
          <input
            type="text"
            value={data.flatSize || ''}
            onChange={(e) => onChange('flatSize', e.target.value)}
            disabled={disabled}
            placeholder="e.g., 8.5 x 11"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Folded Size
          </label>
          <input
            type="text"
            value={data.foldedSize || ''}
            onChange={(e) => onChange('foldedSize', e.target.value)}
            disabled={disabled}
            placeholder="e.g., 8.5 x 3.67"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
          />
        </div>
      </div>

      {/* Colors */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Colors
        </label>
        <input
          type="text"
          value={data.colors || ''}
          onChange={(e) => onChange('colors', e.target.value)}
          disabled={disabled}
          placeholder="e.g., 4/4 (full color both sides)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
        />
        <p className="mt-1 text-xs text-gray-500">
          Format: Front/Back (e.g., 4/4 = full color both sides, 4/0 = full color one side)
        </p>
      </div>

      {/* Finishing */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Finishing
        </label>
        <input
          type="text"
          value={data.finishing || ''}
          onChange={(e) => onChange('finishing', e.target.value)}
          disabled={disabled}
          placeholder="e.g., Cut, Fold, Glue"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
        />
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Price
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
              $
            </span>
            <input
              type="number"
              step="0.01"
              value={data.total || ''}
              onChange={(e) => onChange('total', e.target.value)}
              disabled={disabled}
              placeholder="0.00"
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PO Number
          </label>
          <input
            type="text"
            value={data.poNumber || ''}
            onChange={(e) => onChange('poNumber', e.target.value)}
            disabled={disabled}
            placeholder="Customer PO#"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
          />
        </div>
      </div>

      {/* Delivery Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Delivery Date
        </label>
        <input
          type="date"
          value={data.deliveryDate || ''}
          onChange={(e) => onChange('deliveryDate', e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
        />
      </div>

      {/* Samples */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sample Information
        </label>
        <input
          type="text"
          value={data.samples || ''}
          onChange={(e) => onChange('samples', e.target.value)}
          disabled={disabled}
          placeholder="Sample quantity or distribution notes"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
        />
      </div>

      {/* File Requirements */}
      {showFileRequirements && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">File Requirements</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Artwork Files Required
              </label>
              <input
                type="number"
                min="0"
                value={data.requiredArtworkCount || 1}
                onChange={(e) => onChange('requiredArtworkCount', parseInt(e.target.value) || 1)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
              />
              <p className="mt-1 text-xs text-gray-500">
                Number of artwork files (PDF, AI, EPS)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Files Required
              </label>
              <input
                type="number"
                min="0"
                value={data.requiredDataFileCount || 0}
                onChange={(e) => onChange('requiredDataFileCount', parseInt(e.target.value) || 0)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
              />
              <p className="mt-1 text-xs text-gray-500">
                Mailing lists, variable data (CSV, XLSX)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
