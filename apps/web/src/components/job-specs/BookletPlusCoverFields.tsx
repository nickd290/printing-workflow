'use client';

interface BookletPlusCoverFieldsProps {
  formData: {
    interiorPages?: number;
    coverPages?: number;
    pageSize?: string;
    textStock?: string;
    coverStock?: string;
    bindingType?: string;
    textBleeds?: string;
    coverBleeds?: string;
    textCoverage?: string;
    coverCoverage?: string;
    textCoating?: string;
    coverCoating?: string;
  };
  onChange: (field: string, value: string | number) => void;
}

export function BookletPlusCoverFields({ formData, onChange }: BookletPlusCoverFieldsProps) {
  const totalPages = (formData.interiorPages || 0) + (formData.coverPages || 4);

  return (
    <>
      <div className="md:col-span-2 bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-indigo-900 mb-3 flex items-center">
          <span className="mr-2">📖</span>
          Booklet Specifications (Plus Cover)
        </h3>
        <p className="text-sm text-indigo-800 mb-4">
          Plus cover booklets use separate, heavier stock for the cover (different from interior pages).
        </p>

        {/* Page Count Section */}
        <div className="bg-white rounded-lg p-4 mb-4 border border-indigo-200">
          <h4 className="font-semibold text-gray-900 mb-3">Page Count</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Interior Pages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interior Pages *
              </label>
              <input
                type="number"
                min="4"
                step="4"
                value={formData.interiorPages || ''}
                onChange={(e) => onChange('interiorPages', parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="24"
              />
              <p className="text-xs text-gray-500 mt-1">Must be divisible by 4</p>
            </div>

            {/* Cover Pages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Pages
              </label>
              <input
                type="number"
                value={4}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Always 4 pages</p>
            </div>

            {/* Total Pages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Pages
              </label>
              <input
                type="number"
                value={totalPages}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-indigo-100 text-indigo-900 font-semibold cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Auto-calculated</p>
            </div>
          </div>
        </div>

        {/* General Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Page Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Page Size
            </label>
            <input
              type="text"
              value={formData.pageSize || ''}
              onChange={(e) => onChange('pageSize', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="5-7/8 x 10-1/2"
            />
          </div>

          {/* Binding Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Binding Type
            </label>
            <select
              value={formData.bindingType || ''}
              onChange={(e) => onChange('bindingType', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select binding...</option>
              <option value="saddle-stitch">Saddle Stitch</option>
              <option value="perfect-bound">Perfect Bound</option>
            </select>
          </div>
        </div>

        {/* TEXT SPECIFICATIONS */}
        <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
            <span className="mr-2">📄</span>
            Interior (Text) Specifications
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Text Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Stock
              </label>
              <input
                type="text"
                value={formData.textStock || ''}
                onChange={(e) => onChange('textStock', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="70# Dull Text"
              />
            </div>

            {/* Text Bleeds */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Bleeds
              </label>
              <input
                type="text"
                value={formData.textBleeds || ''}
                onChange={(e) => onChange('textBleeds', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Yes, 4 Sides"
              />
            </div>

            {/* Text Coverage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Ink Coverage
              </label>
              <input
                type="text"
                value={formData.textCoverage || ''}
                onChange={(e) => onChange('textCoverage', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="4c/4c Process with Medium Coverage"
              />
            </div>

            {/* Text Coating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Coating
              </label>
              <input
                type="text"
                value={formData.textCoating || ''}
                onChange={(e) => onChange('textCoating', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="None, Aqueous, UV"
              />
            </div>
          </div>
        </div>

        {/* COVER SPECIFICATIONS */}
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <h4 className="font-semibold text-amber-900 mb-3 flex items-center">
            <span className="mr-2">📕</span>
            Cover Specifications
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cover Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Stock
              </label>
              <input
                type="text"
                value={formData.coverStock || ''}
                onChange={(e) => onChange('coverStock', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="80# Dull Cover #3"
              />
            </div>

            {/* Cover Bleeds */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Bleeds
              </label>
              <input
                type="text"
                value={formData.coverBleeds || ''}
                onChange={(e) => onChange('coverBleeds', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Yes, 4 Sides"
              />
            </div>

            {/* Cover Coverage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Ink Coverage
              </label>
              <input
                type="text"
                value={formData.coverCoverage || ''}
                onChange={(e) => onChange('coverCoverage', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="4c/4c Process with Medium Coverage"
              />
            </div>

            {/* Cover Coating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Coating
              </label>
              <input
                type="text"
                value={formData.coverCoating || ''}
                onChange={(e) => onChange('coverCoating', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="None, Aqueous, UV, Spot UV"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
