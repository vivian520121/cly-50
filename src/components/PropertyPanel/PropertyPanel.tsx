import { useCanvasStore } from '../../store/useCanvasStore';
import { X, Copy } from 'lucide-react';
import { COLORS } from '../../types';

const SHAPE_TYPE_LABELS: Record<string, string> = {
  rectangle: '矩形',
  circle: '圆形',
  diamond: '菱形',
  line: '线条',
  arrow: '箭头',
  text: '文本',
  doodle: '涂鸦',
};

export function PropertyPanel() {
  const {
    shapes,
    selectedIds,
    setSelectedIds,
    updateShape,
    updateShapes,
    deleteShape,
    duplicateSelected,
    pushHistory,
  } = useCanvasStore();

  const isMultiSelect = selectedIds.length > 1;
  const selectedShapes = selectedIds.map((id) => shapes.find((s) => s.id === id)).filter(Boolean) as any[];

  if (selectedIds.length === 0) return null;

  const primaryShape = selectedShapes[0];

  const getMixedValue = (prop: string) => {
    if (!isMultiSelect) return primaryShape?.[prop];
    const values = selectedShapes.map((s) => s[prop]);
    const allSame = values.every((v) => v === values[0]);
    return allSame ? values[0] : '__mixed__';
  };

  const strokeColor = getMixedValue('strokeColor');
  const strokeWidth = getMixedValue('strokeWidth');

  const handleColorChange = (color: string) => {
    pushHistory();
    if (isMultiSelect) {
      updateShapes(selectedIds, { strokeColor: color });
    } else {
      updateShape(primaryShape.id, { strokeColor: color });
    }
  };

  const handleStrokeWidthChange = (width: number) => {
    pushHistory();
    if (isMultiSelect) {
      updateShapes(selectedIds, { strokeWidth: width });
    } else {
      updateShape(primaryShape.id, { strokeWidth: width });
    }
  };

  const handleDuplicate = () => {
    pushHistory();
    duplicateSelected();
  };

  const handleDelete = () => {
    pushHistory();
    if (isMultiSelect) {
      for (const id of selectedIds) {
        deleteShape(id);
      }
    } else {
      deleteShape(primaryShape.id);
    }
  };

  const getTitle = () => {
    if (isMultiSelect) {
      return `已选择 ${selectedIds.length} 个图形`;
    }
    return SHAPE_TYPE_LABELS[primaryShape.type] || '图形';
  };

  return (
    <div className="fixed right-4 top-20 z-40 w-64 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-in slide-in-from-right-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="font-medium text-sm text-gray-700">
          {getTitle()}
        </span>
        <button
          onClick={() => setSelectedIds([])}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-2 font-medium">
            描边颜色
            {strokeColor === '__mixed__' && (
              <span className="ml-2 text-amber-500">(混合)</span>
            )}
          </label>
          <div className="grid grid-cols-8 gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  strokeColor === color && strokeColor !== '__mixed__'
                    ? 'border-gray-800 scale-110'
                    : strokeColor === '__mixed__'
                    ? 'border-gray-300 hover:border-gray-400'
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
            {strokeWidth === '__mixed__' && (
              <span className="ml-2 text-amber-500">(混合)</span>
            )}
          </label>
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth === '__mixed__' ? 2 : strokeWidth}
            onChange={(e) =>
              handleStrokeWidthChange(Number(e.target.value))
            }
            className="w-full accent-[#FF6B6B]"
          />
          <div className="text-xs text-gray-400 mt-1">
            {strokeWidth === '__mixed__' ? '—' : `${strokeWidth}px`}
          </div>
        </div>

        {!isMultiSelect && primaryShape.type === 'text' && (
          <div>
            <label className="block text-xs text-gray-500 mb-2 font-medium">
              字号
            </label>
            <input
              type="range"
              min="12"
              max="72"
              value={primaryShape.fontSize}
              onChange={(e) =>
                updateShape(primaryShape.id, {
                  fontSize: Number(e.target.value),
                })
              }
              className="w-full accent-[#FF6B6B]"
            />
            <div className="text-xs text-gray-400 mt-1">
              {primaryShape.fontSize}px
            </div>
          </div>
        )}

        {!isMultiSelect && primaryShape.type === 'text' && (
          <div>
            <label className="block text-xs text-gray-500 mb-2 font-medium">
              文本内容
            </label>
            <textarea
              value={primaryShape.text}
              onChange={(e) =>
                updateShape(primaryShape.id, { text: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent resize-none"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={handleDuplicate}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <Copy size={14} />
            复制图形
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
          >
            <X size={14} />
            删除图形
          </button>
        </div>
      </div>
    </div>
  );
}
