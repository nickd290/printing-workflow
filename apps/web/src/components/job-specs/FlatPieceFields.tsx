'use client';

interface FlatPieceFieldsProps {
  formData: {
    flatSize?: string;
    bleeds?: string;
    coverage?: string;
    stock?: string;
    coating?: string;
  };
  onChange: (field: string, value: string) => void;
}

export function FlatPieceFields({ formData, onChange }: FlatPieceFieldsProps) {
  return (
    <>
      <div className="md:col-span-2 bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
          <span className="mr-2">📄</span>
          Flat Piece Specifications
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Flat Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Flat Size
            </label>
            <input
              type="text"
              value={formData.flatSize || ''}
              onChange={(e) => onChange('flatSize', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="8.5 x 11"
            />
          </div>

          {/* Stock */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock / Paper Weight
            </label>
            <input
              type="text"
              value={formData.stock || ''}
              onChange={(e) => onChange('stock', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="100lb Gloss Cover"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="UV coating one side, Aqueous, Matte finish"
            />
          </div>
        </div>
      </div>
    </>
  );
}
