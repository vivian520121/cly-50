import { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import {
  renderAllShapes,
  getShapeAtPoint,
  getHandleAtPoint,
  getShapeBounds,
  getShapeCenter,
} from '../../utils/roughRenderer';
import type { HandlePosition } from '../../utils/roughRenderer';
import { generateId, generateSeed } from '../../utils/idGenerator';
import type { Shape, RectangleShape, CircleShape, DiamondShape, LineShape, ArrowShape, TextShape, DoodleShape, PointWithPressure } from '../../types';
import { DEFAULT_ROUGHNESS } from '../../types';

type DrawingState =
  | { kind: 'none' }
  | { kind: 'drawing'; shape: Shape; startX: number; startY: number }
  | {
      kind: 'dragging';
      offsets: { shapeId: string; offsetX: number; offsetY: number }[];
    }
  | { kind: 'panning'; startX: number; startY: number; origOffsetX: number; origOffsetY: number }
  | {
      kind: 'resizing';
      shapeId: string;
      handle: HandlePosition;
      startX: number;
      startY: number;
      origBounds: { x: number; y: number; width: number; height: number };
      origRotation: number;
    }
  | {
      kind: 'rotating';
      shapeId: string;
      startAngle: number;
      origRotation: number;
      cx: number;
      cy: number;
    };

function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  angle: number
): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function getResizeCursor(handle: HandlePosition | null): string {
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'w':
    case 'e':
      return 'ew-resize';
    case 'rotate':
      return 'crosshair';
    default:
      return 'default';
  }
}

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>({ kind: 'none' });
  const [hoverHandle, setHoverHandle] = useState<HandlePosition | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    shapes,
    selectedIds,
    currentTool,
    currentColor,
    currentStrokeWidth,
    currentFontSize,
    currentBrushStyle,
    currentSmoothing,
    pressureSensitivity,
    offsetX,
    offsetY,
    zoom,
    addShape,
    updateShape,
    updateShapes,
    setSelectedId,
    setSelectedIds,
    toggleSelectedId,
    setOffset,
    setZoom,
    undo,
    redo,
    deleteSelected,
    duplicateSelected,
    pushHistory,
  } = useCanvasStore();

  const smoothedPointsRef = useRef<PointWithPressure[]>([]);

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return {
        x: (screenX - rect.left - offsetX) / zoom,
        y: (screenY - rect.top - offsetY) / zoom,
      };
    },
    [offsetX, offsetY, zoom]
  );

  const smoothPoint = useCallback(
    (newPoint: PointWithPressure): PointWithPressure => {
      const points = smoothedPointsRef.current;
      if (points.length === 0 || currentSmoothing === 0) {
        return newPoint;
      }

      const smoothingFactor = currentSmoothing * 0.85;
      const lastPoint = points[points.length - 1];

      return {
        x: lastPoint.x + (newPoint.x - lastPoint.x) * (1 - smoothingFactor),
        y: lastPoint.y + (newPoint.y - lastPoint.y) * (1 - smoothingFactor),
        pressure: lastPoint.pressure + (newPoint.pressure - lastPoint.pressure) * (1 - smoothingFactor),
      };
    },
    [currentSmoothing]
  );

  const rerender = useCallback(() => {
    if (!canvasRef.current) return;
    renderAllShapes(
      canvasRef.current,
      shapes,
      selectedIds,
      offsetX,
      offsetY,
      zoom
    );
  }, [shapes, selectedIds, offsetX, offsetY, zoom]);

  useEffect(() => {
    rerender();
  }, [rerender]);

  useEffect(() => {
    const handleResize = () => rerender();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [rerender]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z')
      ) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'v' || e.key === 'V') {
        useCanvasStore.getState().setTool('select');
      } else if (e.key === 'r' || e.key === 'R') {
        useCanvasStore.getState().setTool('rectangle');
      } else if (e.key === 'o' || e.key === 'O') {
        useCanvasStore.getState().setTool('circle');
      } else if (e.key === 'd' || e.key === 'D') {
        if (!e.ctrlKey && !e.metaKey) {
          useCanvasStore.getState().setTool('diamond');
        }
      } else if (e.key === 'l' || e.key === 'L') {
        useCanvasStore.getState().setTool('line');
      } else if (e.key === 'a' || e.key === 'A') {
        useCanvasStore.getState().setTool('arrow');
      } else if (e.key === 'p' || e.key === 'P') {
        useCanvasStore.getState().setTool('doodle');
      } else if (e.key === 't' || e.key === 'T') {
        useCanvasStore.getState().setTool('text');
      } else if (e.key === 'Escape') {
        setSelectedIds([]);
        setEditingTextId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedIds, deleteSelected, duplicateSelected, setSelectedIds]);

  const getPressure = (e: React.PointerEvent | React.MouseEvent): number => {
    if (!pressureSensitivity) return 0.5;
    if ('pressure' in e) {
      return e.pressure > 0 ? e.pressure : 0.5;
    }
    return 0.5;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setDrawingState({
        kind: 'panning',
        startX: e.clientX,
        startY: e.clientY,
        origOffsetX: offsetX,
        origOffsetY: offsetY,
      });
      return;
    }

    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const pressure = getPressure(e);
    const isMultiSelect = e.ctrlKey || e.metaKey;

    if (currentTool === 'select') {
      if (selectedId) {
        const selectedShape = shapes.find((s) => s.id === selectedId);
        if (selectedShape) {
          const hitHandle = getHandleAtPoint(selectedShape, x, y, ctx);
          if (hitHandle) {
            pushHistory();
            if (hitHandle === 'rotate') {
              const { cx, cy } = getShapeCenter(selectedShape, ctx);
              const startAngle = Math.atan2(y - cy, x - cx);
              setDrawingState({
                kind: 'rotating',
                shapeId: selectedShape.id,
                startAngle,
                origRotation: selectedShape.rotation || 0,
                cx,
                cy,
              });
            } else {
              const bounds = getShapeBounds(selectedShape, ctx);
              setDrawingState({
                kind: 'resizing',
                shapeId: selectedShape.id,
                handle: hitHandle,
                startX: x,
                startY: y,
                origBounds: { ...bounds },
                origRotation: selectedShape.rotation || 0,
              });
            }
            return;
          }
        }
      }

      const clickedShape = getShapeAtPoint(shapes, x, y, ctx);
      if (clickedShape) {
        if (isMultiSelect) {
          toggleSelectedId(clickedShape.id);
        } else if (!selectedIds.includes(clickedShape.id)) {
          setSelectedId(clickedShape.id);
        }

        const newSelectedIds = isMultiSelect
          ? selectedIds.includes(clickedShape.id)
            ? selectedIds.filter((id) => id !== clickedShape.id)
            : [...selectedIds, clickedShape.id]
          : [clickedShape.id];

        const dragOffsets = newSelectedIds.map((id) => {
          const shape = shapes.find((s) => s.id === id);
          if (!shape) return null;
          return {
            shapeId: id,
            offsetX: x - shape.x,
            offsetY: y - shape.y,
          };
        }).filter(Boolean) as { shapeId: string; offsetX: number; offsetY: number }[];

        if (!isMultiSelect || selectedIds.length <= 1) {
          pushHistory();
        }

        setDrawingState({
          kind: 'dragging',
          offsets: dragOffsets,
        });

        if (clickedShape.type === 'text' && e.detail === 2 && newSelectedIds.length === 1) {
          setEditingTextId(clickedShape.id);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      } else {
        if (!isMultiSelect) {
          setSelectedIds([]);
        }
      }
      return;
    }

    if (currentTool === 'text') {
      pushHistory();
      const textShape: TextShape = {
        id: generateId(),
        type: 'text',
        x,
        y,
        rotation: 0,
        text: '文本',
        strokeColor: currentColor,
        fillColor: 'transparent',
        strokeWidth: currentStrokeWidth,
        roughness: DEFAULT_ROUGHNESS,
        seed: generateSeed(),
        fontSize: currentFontSize,
      };
      addShape(textShape);
      setSelectedId(textShape.id);
      setEditingTextId(textShape.id);
      useCanvasStore.getState().setTool('select');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return;
    }

    pushHistory();

    if (currentTool === 'rectangle') {
      const shape: RectangleShape = {
        id: generateId(),
        type: 'rectangle',
        x,
        y,
        rotation: 0,
        width: 0,
        height: 0,
        strokeColor: currentColor,
        fillColor: 'transparent',
        strokeWidth: currentStrokeWidth,
        roughness: DEFAULT_ROUGHNESS,
        seed: generateSeed(),
      };
      setDrawingState({ kind: 'drawing', shape, startX: x, startY: y });
      addShape(shape);
      setSelectedId(shape.id);
    } else if (currentTool === 'circle') {
      const shape: CircleShape = {
        id: generateId(),
        type: 'circle',
        x,
        y,
        rotation: 0,
        width: 0,
        height: 0,
        strokeColor: currentColor,
        fillColor: 'transparent',
        strokeWidth: currentStrokeWidth,
        roughness: DEFAULT_ROUGHNESS,
        seed: generateSeed(),
      };
      setDrawingState({ kind: 'drawing', shape, startX: x, startY: y });
      addShape(shape);
      setSelectedId(shape.id);
    } else if (currentTool === 'diamond') {
      const shape: DiamondShape = {
        id: generateId(),
        type: 'diamond',
        x,
        y,
        rotation: 0,
        width: 0,
        height: 0,
        strokeColor: currentColor,
        fillColor: 'transparent',
        strokeWidth: currentStrokeWidth,
        roughness: DEFAULT_ROUGHNESS,
        seed: generateSeed(),
      };
      setDrawingState({ kind: 'drawing', shape, startX: x, startY: y });
      addShape(shape);
      setSelectedId(shape.id);
    } else if (currentTool === 'line') {
      const shape: LineShape = {
        id: generateId(),
        type: 'line',
        x,
        y,
        rotation: 0,
        x2: x,
        y2: y,
        strokeColor: currentColor,
        fillColor: 'transparent',
        strokeWidth: currentStrokeWidth,
        roughness: DEFAULT_ROUGHNESS,
        seed: generateSeed(),
      };
      setDrawingState({ kind: 'drawing', shape, startX: x, startY: y });
      addShape(shape);
      setSelectedId(shape.id);
    } else if (currentTool === 'arrow') {
      const shape: ArrowShape = {
        id: generateId(),
        type: 'arrow',
        x,
        y,
        rotation: 0,
        x2: x,
        y2: y,
        strokeColor: currentColor,
        fillColor: 'transparent',
        strokeWidth: currentStrokeWidth,
        roughness: DEFAULT_ROUGHNESS,
        seed: generateSeed(),
      };
      setDrawingState({ kind: 'drawing', shape, startX: x, startY: y });
      addShape(shape);
      setSelectedId(shape.id);
    } else if (currentTool === 'doodle') {
      const initialPoint = { x, y, pressure };
      smoothedPointsRef.current = [initialPoint];
      const shape: DoodleShape = {
        id: generateId(),
        type: 'doodle',
        x,
        y,
        rotation: 0,
        points: [initialPoint],
        strokeColor: currentColor,
        fillColor: 'transparent',
        strokeWidth: currentStrokeWidth,
        roughness: DEFAULT_ROUGHNESS,
        seed: generateSeed(),
        brushStyle: currentBrushStyle,
      };
      setDrawingState({ kind: 'drawing', shape, startX: x, startY: y });
      addShape(shape);
      setSelectedId(shape.id);
    }
  };

  const applyResizeToShape = (
    shape: Shape,
    handle: HandlePosition,
    newBounds: { x: number; y: number; width: number; height: number }
  ): any => {
    const updates: any = {};

    if (shape.type === 'rectangle' || shape.type === 'circle' || shape.type === 'diamond') {
      updates.x = newBounds.x;
      updates.y = newBounds.y;
      updates.width = Math.max(2, newBounds.width);
      updates.height = Math.max(2, newBounds.height);
    } else if (shape.type === 'line' || shape.type === 'arrow') {
      const origBounds = getShapeBounds(shape);
      const origCx = origBounds.x + origBounds.width / 2;
      const origCy = origBounds.y + origBounds.height / 2;

      const scaleX = origBounds.width > 0 ? newBounds.width / origBounds.width : 1;
      const scaleY = origBounds.height > 0 ? newBounds.height / origBounds.height : 1;

      let x1 = shape.x;
      let y1 = shape.y;
      let x2 = shape.x2;
      let y2 = shape.y2;

      const dx = shape.x - origCx;
      const dy = shape.y - origCy;
      const dx2 = shape.x2 - origCx;
      const dy2 = shape.y2 - origCy;

      if (handle === 'nw') {
        x1 = newBounds.x;
        y1 = newBounds.y;
        x2 = origCx + dx2 * scaleX;
        y2 = origCy + dy2 * scaleY;
      } else if (handle === 'ne') {
        x1 = origCx + dx * scaleX;
        y1 = newBounds.y;
        x2 = newBounds.x + newBounds.width;
        y2 = origCy + dy2 * scaleY;
      } else if (handle === 'sw') {
        x1 = newBounds.x;
        y1 = origCy + dy * scaleY;
        x2 = origCx + dx2 * scaleX;
        y2 = newBounds.y + newBounds.height;
      } else if (handle === 'se') {
        x1 = origCx + dx * scaleX;
        y1 = origCy + dy * scaleY;
        x2 = newBounds.x + newBounds.width;
        y2 = newBounds.y + newBounds.height;
      } else if (handle === 'n') {
        y1 = newBounds.y;
        y2 = origCy + dy2 * scaleY;
      } else if (handle === 's') {
        y1 = origCy + dy * scaleY;
        y2 = newBounds.y + newBounds.height;
      } else if (handle === 'w') {
        x1 = newBounds.x;
        x2 = origCx + dx2 * scaleX;
      } else if (handle === 'e') {
        x1 = origCx + dx * scaleX;
        x2 = newBounds.x + newBounds.width;
      }

      updates.x = x1;
      updates.y = y1;
      updates.x2 = x2;
      updates.y2 = y2;
    } else if (shape.type === 'text') {
      const origBounds = getShapeBounds(shape);
      const origCx = origBounds.x + origBounds.width / 2;
      const origCy = origBounds.y + origBounds.height / 2;

      const newCx = newBounds.x + newBounds.width / 2;
      const newCy = newBounds.y + newBounds.height / 2;

      const scaleY = origBounds.height > 0 ? newBounds.height / origBounds.height : 1;
      const newFontSize = Math.max(8, shape.fontSize * scaleY);

      updates.x = shape.x + (newCx - origCx) - (newBounds.width - origBounds.width) / 2;
      updates.y = shape.y + (newCy - origCy);
      updates.fontSize = newFontSize;
    } else if (shape.type === 'doodle') {
      const origBounds = getShapeBounds(shape);
      const origCx = origBounds.x + origBounds.width / 2;
      const origCy = origBounds.y + origBounds.height / 2;

      const newCx = newBounds.x + newBounds.width / 2;
      const newCy = newBounds.y + newBounds.height / 2;

      const scaleX = origBounds.width > 0 ? newBounds.width / origBounds.width : 1;
      const scaleY = origBounds.height > 0 ? newBounds.height / origBounds.height : 1;

      const newPoints = shape.points.map((p) => {
        const dx = p.x - origCx;
        const dy = p.y - origCy;
        return {
          ...p,
          x: newCx + dx * scaleX,
          y: newCy + dy * scaleY,
        };
      });

      const minX = Math.min(...newPoints.map((p) => p.x));
      const minY = Math.min(...newPoints.map((p) => p.y));

      updates.x = minX;
      updates.y = minY;
      updates.points = newPoints;
    }

    return updates;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (drawingState.kind === 'none') {
      if (currentTool === 'select' && selectedId && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')!;
        const selectedShape = shapes.find((s) => s.id === selectedId);
        if (selectedShape) {
          const { x, y } = screenToCanvas(e.clientX, e.clientY);
          const hit = getHandleAtPoint(selectedShape, x, y, ctx);
          setHoverHandle(hit);
        }
      } else {
        setHoverHandle(null);
      }
      return;
    }

    if (drawingState.kind === 'panning') {
      const dx = e.clientX - drawingState.startX;
      const dy = e.clientY - drawingState.startY;
      setOffset(drawingState.origOffsetX + dx, drawingState.origOffsetY + dy);
      return;
    }

    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const pressure = getPressure(e);

    if (drawingState.kind === 'drawing') {
      const shape = drawingState.shape;

      if (shape.type === 'rectangle' || shape.type === 'circle' || shape.type === 'diamond') {
        const newX = Math.min(drawingState.startX, x);
        const newY = Math.min(drawingState.startY, y);
        const width = Math.abs(x - drawingState.startX);
        const height = Math.abs(y - drawingState.startY);
        updateShape(shape.id, { x: newX, y: newY, width, height } as Partial<Shape>);
      } else if (shape.type === 'line' || shape.type === 'arrow') {
        updateShape(shape.id, { x2: x, y2: y } as Partial<Shape>);
      } else if (shape.type === 'doodle') {
        const currentShape = shapes.find((s) => s.id === shape.id);
        if (currentShape && currentShape.type === 'doodle') {
          const rawPoint: PointWithPressure = { x, y, pressure };
          const smoothedPoint = smoothPoint(rawPoint);
          smoothedPointsRef.current.push(smoothedPoint);
          const newPoints = [...currentShape.points, smoothedPoint];
          updateShape(shape.id, { points: newPoints } as Partial<Shape>);
        }
      }
    } else if (drawingState.kind === 'dragging') {
      for (const dragInfo of drawingState.offsets) {
        const shape = shapes.find((s) => s.id === dragInfo.shapeId);
        if (!shape) continue;

        const newX = x - dragInfo.offsetX;
        const newY = y - dragInfo.offsetY;
        const dx = newX - shape.x;
        const dy = newY - shape.y;

        if (shape.type === 'rectangle' || shape.type === 'circle' || shape.type === 'diamond' || shape.type === 'text') {
          updateShape(shape.id, { x: newX, y: newY } as Partial<Shape>);
        } else if (shape.type === 'line' || shape.type === 'arrow') {
          updateShape(shape.id, {
            x: shape.x + dx,
            y: shape.y + dy,
            x2: shape.x2 + dx,
            y2: shape.y2 + dy,
          } as Partial<Shape>);
        } else if (shape.type === 'doodle') {
          const newPoints = shape.points.map((p) => ({
            x: p.x + dx,
            y: p.y + dy,
            pressure: p.pressure,
          }));
          updateShape(shape.id, {
            x: shape.x + dx,
            y: shape.y + dy,
            points: newPoints,
          } as Partial<Shape>);
        }
      }
    } else if (drawingState.kind === 'resizing') {
      const shape = shapes.find((s) => s.id === drawingState.shapeId);
      if (!shape) return;

      const { cx, cy } = getShapeCenter(shape);
      const rotation = drawingState.origRotation;

      const localStart = rotatePoint(drawingState.startX, drawingState.startY, cx, cy, -rotation);
      const localCurrent = rotatePoint(x, y, cx, cy, -rotation);

      let { x: newX, y: newY, width: newW, height: newH } = drawingState.origBounds;
      const handle = drawingState.handle;

      const dxLocal = localCurrent.x - localStart.x;
      const dyLocal = localCurrent.y - localStart.y;

      if (handle.includes('n')) {
        newY = drawingState.origBounds.y + dyLocal;
        newH = drawingState.origBounds.height - dyLocal;
      }
      if (handle.includes('s')) {
        newH = drawingState.origBounds.height + dyLocal;
      }
      if (handle.includes('w')) {
        newX = drawingState.origBounds.x + dxLocal;
        newW = drawingState.origBounds.width - dxLocal;
      }
      if (handle.includes('e')) {
        newW = drawingState.origBounds.width + dxLocal;
      }

      if (newW < 2) {
        if (handle.includes('w')) {
          newX = drawingState.origBounds.x + drawingState.origBounds.width - 2;
        }
        newW = 2;
      }
      if (newH < 2) {
        if (handle.includes('n')) {
          newY = drawingState.origBounds.y + drawingState.origBounds.height - 2;
        }
        newH = 2;
      }

      const newBounds = { x: newX, y: newY, width: newW, height: newH };
      const updates = applyResizeToShape(shape, handle, newBounds);
      updateShape(shape.id, updates);
    } else if (drawingState.kind === 'rotating') {
      const shape = shapes.find((s) => s.id === drawingState.shapeId);
      if (!shape) return;

      const { cx, cy } = drawingState;
      const currentAngle = Math.atan2(y - cy, x - cx);
      const deltaAngle = currentAngle - drawingState.startAngle;
      const newRotation = drawingState.origRotation + deltaAngle;

      updateShape(shape.id, { rotation: newRotation } as Partial<Shape>);
    }
  };

  const handlePointerUp = () => {
    setDrawingState({ kind: 'none' });
    smoothedPointsRef.current = [];
    setHoverHandle(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      setOffset(offsetX - e.deltaX, offsetY - e.deltaY);
      return;
    }
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom(zoom + delta * zoom);
  };

  const editingShape = shapes.find((s) => s.id === editingTextId);

  const getCursorStyle = () => {
    if (drawingState.kind !== 'none') {
      if (drawingState.kind === 'resizing') {
        return getResizeCursor(drawingState.handle);
      }
      if (drawingState.kind === 'rotating') {
        return 'crosshair';
      }
      if (drawingState.kind === 'panning') {
        return 'grabbing';
      }
      if (drawingState.kind === 'dragging') {
        return 'move';
      }
      return 'crosshair';
    }
    if (currentTool === 'select') {
      return hoverHandle ? getResizeCursor(hoverHandle) : 'default';
    }
    return 'crosshair';
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 top-14 overflow-hidden"
      style={{ cursor: getCursorStyle() }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      />

      {editingShape && editingShape.type === 'text' && inputRef && (
        <textarea
          ref={inputRef}
          value={editingShape.text}
          onChange={(e) => updateShape(editingShape.id, { text: e.target.value })}
          onBlur={() => setEditingTextId(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditingTextId(null);
            }
          }}
          className="absolute bg-transparent outline-none resize-none border-none p-0 m-0"
          style={{
            left: offsetX + editingShape.x * zoom,
            top: offsetY + editingShape.y * zoom,
            fontSize: editingShape.fontSize * zoom,
            color: editingShape.strokeColor,
            fontFamily: "'Caveat', 'Segoe UI', sans-serif",
            lineHeight: 1,
            minWidth: '100px',
            transform: `rotate(${editingShape.rotation || 0}rad)`,
            transformOrigin: 'top left',
          }}
        />
      )}
    </div>
  );
}
