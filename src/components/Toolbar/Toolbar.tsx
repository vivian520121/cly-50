import {
  MousePointer2,
  Square,
  Minus,
  Type,
  Undo2,
  Redo2,
  Download,
  Trash2,
  Save,
} from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { COLORS, STROKE_WIDTHS } from '../../types';
import { exportToPNG, exportToSVG } from '../../utils/exportUtils';
import { useState } from 'react';

export function TopToolbar() {
  const {
    shapes,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
    saveToStorage,
    saveStatus,
  } = useCanvasStore();
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-[#2C2C2C] flex items-center px-4 z-50 shadow-lg">
      <h1
        className="text-white text-xl mr-8 font-bold"
        style={{ fontFamily: "'Caveat', cursive" }}
      >
        SketchPad
      </h1>

      <div className="flex items-center gap-1 h-full">
        <ToolbarButton
          onClick={undo}
          disabled={!canUndo()}
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={redo}
          disabled={!canRedo()}
          title="重做 (Ctrl+Y)"
        >
          <Redo2 size={18} />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-600 mx-2" />

        <ToolbarButton onClick={saveToStorage} title="保存">
          <Save size={18} />
        </ToolbarButton>

        <div className="relative">
          <ToolbarButton
            onClick={() => setShowExportMenu(!showExportMenu)}
            title="导出"
          >
            <Download size={18} />
          </ToolbarButton>
          {showExportMenu && (
            <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl py-1 min-w-[140px] border border-gray-200">
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => {
                  exportToPNG(shapes);
                  setShowExportMenu(false);
                }}
              >
                导出为 PNG
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => {
                  exportToSVG(shapes);
                  setShowExportMenu(false);
                }}
              >
                导出为 SVG
              </button>
            </div>
          )}
        </div>

        <ToolbarButton onClick={clearCanvas} title="清空画布">
          <Trash2 size={18} />
        </ToolbarButton>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div
            className={`w-2 h-2 rounded-full ${
              saveStatus === 'saved'
                ? 'bg-green-400'
                : saveStatus === 'saving'
                ? 'bg-yellow-400 animate-pulse'
                : 'bg-red-400'
            }`}
          />
          {saveStatus === 'saved'
            ? '已保存'
            : saveStatus === 'saving'
            ? '保存中...'
            : '未保存'}
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-9 h-9 flex items-center justify-center rounded-md text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

export function LeftToolbar() {
  const {
    currentTool,
    setTool,
    currentColor,
    setColor,
    currentStrokeWidth,
    setStrokeWidth,
  } = useCanvasStore();

  const tools = [
    { id: 'select' as const, icon: MousePointer2, label: '选择 (V)' },
    { id: 'rectangle' as const, icon: Square, label: '矩形 (R)' },
    { id: 'line' as const, icon: Minus, label: '线条 (L)' },
    { id: 'text' as const, icon: Type, label: '文本 (T)' },
  ];

  return (
    <div className="fixed left-4 top-20 z-40 flex flex-col gap-3">
      <div className="bg-white rounded-xl shadow-lg p-2 flex flex-col gap-1 border border-gray-100">
        {tools.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            title={label}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
              currentTool === id
                ? 'bg-[#FF6B6B] text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-100">
        <p className="text-xs text-gray-500 mb-2 font-medium">颜色</p>
        <div className="grid grid-cols-4 gap-1.5">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setColor(color)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                currentColor === color
                  ? 'border-gray-800 scale-110'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-100">
        <p className="text-xs text-gray-500 mb-2 font-medium">线宽</p>
        <div className="flex flex-col gap-2">
          {STROKE_WIDTHS.map((width) => (
            <button
              key={width}
              onClick={() => setStrokeWidth(width)}
              className={`h-7 rounded flex items-center justify-center transition-all ${
                currentStrokeWidth === width
                  ? 'bg-gray-100 ring-2 ring-[#FF6B6B]'
                  : 'hover:bg-gray-50'
              }`}
              title={`${width}px`}
            >
              <div
                className="bg-gray-800 rounded-full"
                style={{
                  width: '24px',
                  height: `${width}px`,
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
