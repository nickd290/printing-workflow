'use client';

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
}

interface JobFormFieldsProps {
  data: Partial<JobFormData>;
  onChange: (field: keyof JobFormData, value: string | number) => void;
  disabled?: boolean;
  showFileRequirements?: boolean;
}

export function JobFormFields({
  data,
  onChange,
  disabled = false,
  showFileRequirements = true
}: JobFormFieldsProps) {
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
