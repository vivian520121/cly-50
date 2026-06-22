import { useRef, useEffect, useState } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useCustomShapesStore } from '../../store/useCustomShapesStore';
import type { Shape } from '../../types';
import { getShapeBounds, drawShape } from '../../utils/roughRenderer';
import { X, Plus, Trash2, Pencil, Check, GripVertical } from 'lucide-react';

const THUMBNAIL_SIZE = 96;
const THUMBNAIL_PADDING = 8;

function renderThumbnail(
  canvas: HTMLCanvasElement,
  shapes: Shape[]
): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (shapes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const shape of shapes) {
    const bounds = getShapeBounds(shape, ctx);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  const scaleX = (THUMBNAIL_SIZE - THUMBNAIL_PADDING * 2) / width;
  const scaleY = (THUMBNAIL_SIZE - THUMBNAIL_PADDING * 2) / height;
  const scale = Math.min(scaleX, scaleY, 2);

  const offsetX = (THUMBNAIL_SIZE - width * scale) / 2 - minX * scale;
  const offsetY = (THUMBNAIL_SIZE - height * scale) / 2 - minY * scale;

  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;

  ctx.fillStyle = '#FFFEF7';
  ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  for (const shape of shapes) {
    drawShape(ctx, shape);
  }

  ctx.restore();

  return canvas.toDataURL('image/png');
}

function ThumbnailCanvas({ shapes }: { shapes: Shape[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderThumbnail(canvasRef.current, shapes);
    }
  }, [shapes]);

  return (
    <canvas
      ref={canvasRef}
      className="w-[96px] h-[96px] rounded-lg border border-gray-200 bg-[#FFFEF7]"
      style={{ imageRendering: 'auto' }}
    />
  );
}

export function CustomShapesPanel() {
  const { templates, showPanel, setShowPanel, deleteTemplate, renameTemplate, instantiateTemplate } =
    useCustomShapesStore();
  const { addShapes, setSelectedIds, offsetX, offsetY, zoom } = useCanvasStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedTemplateId, setDraggedTemplateId] = useState<string | null>(null);

  const handleAddToCanvas = (templateId: string) => {
    const centerX = (window.innerWidth / 2 - offsetX) / zoom;
    const centerY = (window.innerHeight / 2 - offsetY) / zoom;
    const newShapes = instantiateTemplate(templateId, centerX - 100, centerY - 100);
    const ids = addShapes(newShapes);
    setSelectedIds(ids);
  };

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleConfirmRename = (id: string) => {
    if (editingName.trim()) {
      renameTemplate(id, editingName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个自定义图形吗？')) {
      deleteTemplate(id);
    }
  };

  const handleDragStart = (e: React.DragEvent, templateId: string) => {
    setDraggedTemplateId(templateId);
    e.dataTransfer.setData('application/custom-shape', templateId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggedTemplateId(null);
  };

  if (!showPanel) return null;

  return (
    <div className="fixed left-4 top-[420px] z-40 w-[260px] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden max-h-[calc(100vh-500px)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50">
        <span className="font-medium text-sm text-gray-700 flex items-center gap-2">
          <Plus size={16} className="text-green-600" />
          自定义图形库
          <span className="text-xs text-gray-400 font-normal">
            ({templates.length})
          </span>
        </span>
        <button
          onClick={() => setShowPanel(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <div className="mb-2 text-4xl opacity-30">📦</div>
            <p>还没有自定义图形</p>
            <p className="mt-1 text-xs">选中画布中的图形后点击"保存为自定义图形"即可添加</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`group relative bg-white rounded-xl border border-gray-100 p-2 hover:shadow-md hover:border-green-200 transition-all cursor-pointer ${
                  draggedTemplateId === template.id ? 'opacity-50' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, template.id)}
                onDragEnd={handleDragEnd}
                onDoubleClick={() => handleAddToCanvas(template.id)}
              >
                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-gray-400 hover:text-gray-600">
                  <GripVertical size={14} />
                </div>

                <div className="flex justify-center mb-2">
                  <ThumbnailCanvas shapes={template.shapes} />
                </div>

                {editingId === template.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmRename(template.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-green-400"
                      autoFocus
                    />
                    <button
                      onClick={() => handleConfirmRename(template.id)}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 text-center truncate font-medium">
                    {template.name}
                  </div>
                )}

                <div className="text-[10px] text-gray-400 text-center mt-0.5">
                  {template.shapes.length} 个图形
                </div>

                <div className="absolute top-1 right-1 flex opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(template.id, template.name);
                    }}
                    className="p-1 bg-white/90 text-blue-500 hover:bg-blue-50 rounded shadow-sm"
                    title="重命名"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(template.id);
                    }}
                    className="p-1 bg-white/90 text-red-500 hover:bg-red-50 rounded shadow-sm"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCanvas(template.id);
                  }}
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-md"
                  title="添加到画布"
                >
                  <Plus size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {templates.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-400 text-center">
          拖拽或双击添加到画布
        </div>
      )}
    </div>
  );
}
