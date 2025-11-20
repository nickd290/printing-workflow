'use client';

interface FoldedPieceFieldsProps {
  formData: {
    flatSize?: string;
    foldedSize?: string;
    foldType?: string;
    bleeds?: string;
    finishing?: string;
    stock?: string;
    coating?: string;
    coverage?: string;
  };
  onChange: (field: string, value: string) => void;
}

export function FoldedPieceFields({ formData, onChange }: FoldedPieceFieldsProps) {
  return (
    <>
      <div className="md:col-span-2 bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center">
          <span className="mr-2">📖</span>
          Folded Piece Specifications
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Flat Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Flat Size (Before Folding)
            </label>
            <input
              type="text"
              value={formData.flatSize || ''}
              onChange={(e) => onChange('flatSize', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="17 x 11"
            />
          </div>

          {/* Folded Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Folded Size (Final)
            </label>
            <input
              type="text"
              value={formData.foldedSize || ''}
              onChange={(e) => onChange('foldedSize', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="8.5 x 11"
            />
          </div>

          {/* Fold Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fold Type
            </label>
            <input
              type="text"
              value={formData.foldType || ''}
              onChange={(e) => onChange('foldType', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Tri-fold, Half fold, Gate fold"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="100lb Gloss Text"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="4/4, 4/1, 4/0"
            />
          </div>

          {/* Finishing */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Finishing
            </label>
            <input
              type="text"
              value={formData.finishing || ''}
              onChange={(e) => onChange('finishing', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Score, Fold, Score+Fold"
            />
          </div>

          {/* Coating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Coating / Finish
            </label>
            <input
              type="text"
              value={formData.coating || ''}
              onChange={(e) => onChange('coating', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="UV coating, Aqueous, Matte finish"
            />
          </div>
        </div>
      </div>
    </>
  );
}
