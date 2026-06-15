import { useCanvasStore } from '../../store/useCanvasStore';
import { X } from 'lucide-react';
import { COLORS } from '../../types';

export function PropertyPanel() {
  const {
    shapes,
    selectedId,
    setSelectedId,
    updateShape,
    deleteShape,
  } = useCanvasStore();

  const selectedShape = shapes.find((s) => s.id === selectedId);

  if (!selectedShape) return null;

  return (
    <div className="fixed right-4 top-20 z-40 w-64 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-in slide-in-from-right-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="font-medium text-sm text-gray-700">
          {selectedShape.type === 'rectangle'
            ? '矩形'
            : selectedShape.type === 'line'
            ? '线条'
            : '文本'}
        </span>
        <button
          onClick={() => setSelectedId(null)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-2 font-medium">
            描边颜色
          </label>
          <div className="grid grid-cols-8 gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() =>
                  updateShape(selectedShape.id, { strokeColor: color })
                }
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  selectedShape.strokeColor === color
                    ? 'border-gray-800 scale-110'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-2 font-medium">
            线宽
          </label>
          <input
            type="range"
            min="1"
            max="8"
            value={selectedShape.strokeWidth}
            onChange={(e) =>
              updateShape(selectedShape.id, {
                strokeWidth: Number(e.target.value),
              })
            }
            className="w-full accent-[#FF6B6B]"
          />
          <div className="text-xs text-gray-400 mt-1">
            {selectedShape.strokeWidth}px
          </div>
        </div>

        {selectedShape.type === 'text' && (
          <div>
            <label className="block text-xs text-gray-500 mb-2 font-medium">
              字号
            </label>
            <input
              type="range"
              min="12"
              max="72"
              value={selectedShape.fontSize}
              onChange={(e) =>
                updateShape(selectedShape.id, {
                  fontSize: Number(e.target.value),
                })
              }
              className="w-full accent-[#FF6B6B]"
            />
            <div className="text-xs text-gray-400 mt-1">
              {selectedShape.fontSize}px
            </div>
          </div>
        )}

        {selectedShape.type === 'text' && (
          <div>
            <label className="block text-xs text-gray-500 mb-2 font-medium">
              文本内容
            </label>
            <textarea
              value={selectedShape.text}
              onChange={(e) =>
                updateShape(selectedShape.id, { text: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent resize-none"
            />
          </div>
        )}

        <button
          onClick={() => deleteShape(selectedShape.id)}
          className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
        >
          删除图形
        </button>
      </div>
    </div>
  );
}
