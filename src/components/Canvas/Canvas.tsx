import { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { renderAllShapes, getShapeAtPoint } from '../../utils/roughRenderer';
import { generateId, generateSeed } from '../../utils/idGenerator';
import type { Shape, RectangleShape, CircleShape, DiamondShape, LineShape, ArrowShape, TextShape, DoodleShape, PointWithPressure } from '../../types';
import { DEFAULT_ROUGHNESS } from '../../types';

type DrawingState =
  | { kind: 'none' }
  | { kind: 'drawing'; shape: Shape; startX: number; startY: number }
  | { kind: 'dragging'; offsetX: number; offsetY: number; shapeId: string }
  | { kind: 'panning'; startX: number; startY: number; origOffsetX: number; origOffsetY: number };

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>({ kind: 'none' });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    shapes,
    selectedId,
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
    setSelectedId,
    setOffset,
    setZoom,
    undo,
    redo,
    deleteSelected,
    pushHistory,
  } = useCanvasStore();

  const smoothedPointsRef = useRef<PointWithPressure[]>([]);

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
      selectedId,
      offsetX,
      offsetY,
      zoom
    );
  }, [shapes, selectedId, offsetX, offsetY, zoom]);

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
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'v' || e.key === 'V') {
        useCanvasStore.getState().setTool('select');
      } else if (e.key === 'r' || e.key === 'R') {
        useCanvasStore.getState().setTool('rectangle');
      } else if (e.key === 'o' || e.key === 'O') {
        useCanvasStore.getState().setTool('circle');
      } else if (e.key === 'd' || e.key === 'D') {
        useCanvasStore.getState().setTool('diamond');
      } else if (e.key === 'l' || e.key === 'L') {
        useCanvasStore.getState().setTool('line');
      } else if (e.key === 'a' || e.key === 'A') {
        useCanvasStore.getState().setTool('arrow');
      } else if (e.key === 'p' || e.key === 'P') {
        useCanvasStore.getState().setTool('doodle');
      } else if (e.key === 't' || e.key === 'T') {
        useCanvasStore.getState().setTool('text');
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setEditingTextId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedId, deleteSelected, setSelectedId]);

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

    if (currentTool === 'select') {
      const clickedShape = getShapeAtPoint(shapes, x, y, ctx);
      if (clickedShape) {
        setSelectedId(clickedShape.id);
        pushHistory();
        setDrawingState({
          kind: 'dragging',
          offsetX: x - clickedShape.x,
          offsetY: y - clickedShape.y,
          shapeId: clickedShape.id,
        });

        if (clickedShape.type === 'text' && e.detail === 2) {
          setEditingTextId(clickedShape.id);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      } else {
        setSelectedId(null);
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

  const handlePointerMove = (e: React.PointerEvent) => {
    if (drawingState.kind === 'none') return;

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
      const shape = shapes.find((s) => s.id === drawingState.shapeId);
      if (!shape) return;

      const newX = x - drawingState.offsetX;
      const newY = y - drawingState.offsetY;
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
  };

  const handlePointerUp = () => {
    setDrawingState({ kind: 'none' });
    smoothedPointsRef.current = [];
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

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 top-14 overflow-hidden"
      style={{ cursor: currentTool === 'select' ? 'default' : 'crosshair' }}
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
            top: offsetX + editingShape.y * zoom,
            fontSize: editingShape.fontSize * zoom,
            color: editingShape.strokeColor,
            fontFamily: "'Caveat', 'Segoe UI', sans-serif",
            lineHeight: 1,
            minWidth: '100px',
          }}
        />
      )}
    </div>
  );
}
