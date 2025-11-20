'use client';

interface BookletSelfCoverFieldsProps {
  formData: {
    totalPages?: number;
    pageSize?: string;
    bindingType?: string;
    textStock?: string;
    bleeds?: string;
    coverage?: string;
    coating?: string;
  };
  onChange: (field: string, value: string | number) => void;
}

export function BookletSelfCoverFields({ formData, onChange }: BookletSelfCoverFieldsProps) {
  return (
    <>
      <div className="md:col-span-2 bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center">
          <span className="mr-2">📚</span>
          Booklet Specifications (Self Cover)
        </h3>
        <p className="text-sm text-green-800 mb-4">
          Self cover booklets use the same stock throughout (cover and interior pages are the same paper).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Total Pages */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Pages *
            </label>
            <input
              type="number"
              min="4"
              step="4"
              value={formData.totalPages || ''}
              onChange={(e) => onChange('totalPages', parseInt(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="16"
            />
            <p className="text-xs text-gray-500 mt-1">Must be divisible by 4 (e.g., 8, 12, 16, 20)</p>
          </div>

          {/* Page Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Page Size
            </label>
            <input
              type="text"
              value={formData.pageSize || ''}
              onChange={(e) => onChange('pageSize', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="8.5 x 11, 5.5 x 8.5"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select binding...</option>
              <option value="saddle-stitch">Saddle Stitch</option>
              <option value="perfect-bound">Perfect Bound</option>
            </select>
          </div>

          {/* Text Stock */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock / Paper Weight
            </label>
            <input
              type="text"
              value={formData.textStock || ''}
              onChange={(e) => onChange('textStock', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="70# Dull Text"
            />
          </div>

          {/* Bleeds */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bleeds
            </label>
            <input
              type="text"
              value={formData.bleeds || ''}
              onChange={(e) => onChange('bleeds', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="4 sides, 0.125 inch"
            />
          </div>

          {/* Coverage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ink Coverage
            </label>
            <input
              type="text"
              value={formData.coverage || ''}
              onChange={(e) => onChange('coverage', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="4/4, 4/1, 4/0"
            />
          </div>

          {/* Coating */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Coating / Finish
            </label>
            <input
              type="text"
              value={formData.coating || ''}
              onChange={(e) => onChange('coating', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="UV coating, Aqueous, Matte finish"
            />
          </div>
        </div>
      </div>
    </>
  );
}
