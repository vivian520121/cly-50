import {
  MousePointer2,
  Square,
  Circle,
  Diamond,
  Minus,
  ArrowRight,
  Pencil,
  Type,
  Undo2,
  Redo2,
  Download,
  Trash2,
  Save,
} from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { COLORS, STROKE_WIDTHS, MIN_STROKE_WIDTH, MAX_STROKE_WIDTH, BRUSH_STYLES, MIN_SMOOTHING, MAX_SMOOTHING } from '../../types';
import { exportToPNG, exportToSVG } from '../../utils/exportUtils';
import { useState, useRef, useEffect } from 'react';

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
    currentBrushStyle,
    setBrushStyle,
    currentSmoothing,
    setSmoothing,
    pressureSensitivity,
    setPressureSensitivity,
  } = useCanvasStore();

  const [customWidth, setCustomWidth] = useState<string>(String(currentStrokeWidth));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomWidth(String(currentStrokeWidth));
  }, [currentStrokeWidth]);

  const handleCustomWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomWidth(val);
    const num = Number(val);
    if (!isNaN(num) && num >= MIN_STROKE_WIDTH && num <= MAX_STROKE_WIDTH) {
      setStrokeWidth(num);
    }
  };

  const handleCustomWidthBlur = () => {
    const num = Number(customWidth);
    if (isNaN(num) || num < MIN_STROKE_WIDTH) {
      setStrokeWidth(MIN_STROKE_WIDTH);
      setCustomWidth(String(MIN_STROKE_WIDTH));
    } else if (num > MAX_STROKE_WIDTH) {
      setStrokeWidth(MAX_STROKE_WIDTH);
      setCustomWidth(String(MAX_STROKE_WIDTH));
    }
  };

  const tools = [
    { id: 'select' as const, icon: MousePointer2, label: '选择 (V)' },
    { id: 'rectangle' as const, icon: Square, label: '矩形 (R)' },
    { id: 'circle' as const, icon: Circle, label: '圆形 (O)' },
    { id: 'diamond' as const, icon: Diamond, label: '菱形 (D)' },
    { id: 'line' as const, icon: Minus, label: '线条 (L)' },
    { id: 'arrow' as const, icon: ArrowRight, label: '箭头 (A)' },
    { id: 'doodle' as const, icon: Pencil, label: '涂鸦 (P)' },
    { id: 'text' as const, icon: Type, label: '文本 (T)' },
  ];

  const isPresetWidth = STROKE_WIDTHS.includes(currentStrokeWidth);

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
                isPresetWidth && currentStrokeWidth === width
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
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            min={MIN_STROKE_WIDTH}
            max={MAX_STROKE_WIDTH}
            value={customWidth}
            onChange={handleCustomWidthChange}
            onBlur={handleCustomWidthBlur}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent text-center"
            title="自定义线宽 (1-20px)"
          />
          <span className="text-xs text-gray-400 whitespace-nowrap">px</span>
        </div>
      </div>

      {currentTool === 'doodle' && (
        <>
          <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500 mb-2 font-medium">笔刷样式</p>
            <div className="flex flex-col gap-1.5">
              {BRUSH_STYLES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setBrushStyle(value)}
                  className={`h-8 px-3 rounded text-xs font-medium transition-all flex items-center justify-center ${
                    currentBrushStyle === value
                      ? 'bg-[#FF6B6B] text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="w-6 h-0.5 bg-current rounded"
                      style={{
                        borderStyle: value === 'dashed' ? 'dashed' : value === 'dotted' ? 'dotted' : 'solid',
                        borderWidth: value === 'solid' ? '0' : '1px',
                      }}
                    />
                    <span>{label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">平滑度</p>
              <span className="text-xs text-gray-400">
                {Math.round(currentSmoothing * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={MIN_SMOOTHING}
              max={MAX_SMOOTHING}
              step={0.05}
              value={currentSmoothing}
              onChange={(e) => setSmoothing(Number(e.target.value))}
              className="w-full accent-[#FF6B6B]"
            />
          </div>

          <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-100">
            <button
              onClick={() => setPressureSensitivity(!pressureSensitivity)}
              className={`w-full h-8 px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                pressureSensitivity
                  ? 'bg-[#FF6B6B] text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>压感</span>
              <span className={`text-xs ${pressureSensitivity ? 'text-white/80' : 'text-gray-400'}`}>
                {pressureSensitivity ? '开启' : '关闭'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
