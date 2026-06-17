import rough from 'roughjs';
import type { Shape, RectangleShape, CircleShape, DiamondShape, LineShape, ArrowShape, TextShape, DoodleShape, PointWithPressure, BrushStyle } from '../types';
import type { Options } from 'roughjs/bin/core';

const roughCache = new Map<string, ReturnType<typeof rough.generator>>();

export type HandlePosition =
  | 'nw' | 'n' | 'ne'
  | 'w' | 'e'
  | 'sw' | 's' | 'se'
  | 'rotate';

const HANDLE_SIZE = 8;
const ROTATE_HANDLE_OFFSET = 30;

function getRoughGenerator(canvas: HTMLCanvasElement) {
  const key = canvas.id || 'default';
  if (!roughCache.has(key)) {
    roughCache.set(key, rough.generator());
  }
  return roughCache.get(key)!;
}

function getOptions(shape: Shape): Options {
  return {
    roughness: shape.roughness,
    stroke: shape.strokeColor,
    strokeWidth: shape.strokeWidth,
    fill: shape.fillColor || undefined,
    fillStyle: 'hachure',
    hachureGap: 6,
    seed: shape.seed ?? 1,
  };
}

export interface ShapeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getShapeBounds(
  shape: Shape,
  ctx?: CanvasRenderingContext2D
): ShapeBounds {
  switch (shape.type) {
    case 'rectangle':
    case 'circle':
    case 'diamond':
      return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    case 'line':
    case 'arrow': {
      const minX = Math.min(shape.x, shape.x2);
      const minY = Math.min(shape.y, shape.y2);
      return {
        x: minX,
        y: minY,
        width: Math.abs(shape.x2 - shape.x),
        height: Math.abs(shape.y2 - shape.y),
      };
    }
    case 'doodle': {
      if (shape.points.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of shape.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case 'text': {
      if (ctx) {
        ctx.font = `${shape.fontSize}px 'Caveat', 'Segoe UI', sans-serif`;
        const metrics = ctx.measureText(shape.text);
        return { x: shape.x, y: shape.y, width: metrics.width, height: shape.fontSize };
      }
      return { x: shape.x, y: shape.y, width: shape.text.length * shape.fontSize * 0.6, height: shape.fontSize };
    }
  }
}

export function getShapeCenter(shape: Shape, ctx?: CanvasRenderingContext2D) {
  const bounds = getShapeBounds(shape, ctx);
  return {
    cx: bounds.x + bounds.width / 2,
    cy: bounds.y + bounds.height / 2,
  };
}

function rotatePoint(
  x: number, y: number,
  cx: number, cy: number,
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

export function applyRotation(ctx: CanvasRenderingContext2D, shape: Shape, useCtx: CanvasRenderingContext2D) {
  const rotation = shape.rotation || 0;
  if (rotation === 0) return;
  const { cx, cy } = getShapeCenter(shape, useCtx);
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.translate(-cx, -cy);
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape
) {
  ctx.save();

  applyRotation(ctx, shape, ctx);

  const roughCanvas = rough.canvas(ctx.canvas);

  switch (shape.type) {
    case 'rectangle':
      drawRectangle(roughCanvas, shape);
      break;
    case 'circle':
      drawCircle(roughCanvas, shape);
      break;
    case 'diamond':
      drawDiamond(roughCanvas, shape);
      break;
    case 'line':
      drawLine(roughCanvas, shape);
      break;
    case 'arrow':
      drawArrow(roughCanvas, ctx, shape);
      break;
    case 'doodle':
      drawDoodle(roughCanvas, shape);
      break;
    case 'text':
      drawText(ctx, shape);
      break;
  }

  ctx.restore();
}

function drawRectangle(
  rc: ReturnType<typeof rough.canvas>,
  shape: RectangleShape
) {
  rc.rectangle(shape.x, shape.y, shape.width, shape.height, getOptions(shape));
}

function drawLine(
  rc: ReturnType<typeof rough.canvas>,
  shape: LineShape
) {
  rc.line(shape.x, shape.y, shape.x2, shape.y2, getOptions(shape));
}

function drawCircle(
  rc: ReturnType<typeof rough.canvas>,
  shape: CircleShape
) {
  rc.ellipse(
    shape.x + shape.width / 2,
    shape.y + shape.height / 2,
    shape.width,
    shape.height,
    getOptions(shape)
  );
}

function drawDiamond(
  rc: ReturnType<typeof rough.canvas>,
  shape: DiamondShape
) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const points = [
    [cx, shape.y],
    [shape.x + shape.width, cy],
    [cx, shape.y + shape.height],
    [shape.x, cy],
  ];
  rc.polygon(points as [number, number][], getOptions(shape));
}

function drawArrow(
  rc: ReturnType<typeof rough.canvas>,
  ctx: CanvasRenderingContext2D,
  shape: ArrowShape
) {
  rc.line(shape.x, shape.y, shape.x2, shape.y2, getOptions(shape));

  const angle = Math.atan2(shape.y2 - shape.y, shape.x2 - shape.x);
  const arrowSize = shape.strokeWidth * 6 + 10;
  const arrowAngle = Math.PI / 6;

  const x1 = shape.x2 - arrowSize * Math.cos(angle - arrowAngle);
  const y1 = shape.y2 - arrowSize * Math.sin(angle - arrowAngle);
  const x2 = shape.x2 - arrowSize * Math.cos(angle + arrowAngle);
  const y2 = shape.y2 - arrowSize * Math.sin(angle + arrowAngle);

  const arrowOptions = { ...getOptions(shape), fill: shape.strokeColor, fillStyle: 'solid' as const };
  rc.polygon([
    [shape.x2, shape.y2],
    [x1, y1],
    [x2, y2],
  ] as [number, number][], arrowOptions);
}

function drawDoodle(
  rc: ReturnType<typeof rough.canvas>,
  shape: DoodleShape
) {
  const canvasCtx = (rc as unknown as { canvas: HTMLCanvasElement }).canvas?.getContext('2d');
  if (!canvasCtx) return;

  if (shape.points.length < 2) {
    if (shape.points.length === 1) {
      const p = shape.points[0];
      canvasCtx.save();
      canvasCtx.fillStyle = shape.strokeColor;
      const radius = getStrokeWidthFromPressure(p.pressure ?? 0.5, shape.strokeWidth) / 2;
      canvasCtx.beginPath();
      canvasCtx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      canvasCtx.fill();
      canvasCtx.restore();
    }
    return;
  }

  const ctx = canvasCtx;

  const brushStyle: BrushStyle = shape.brushStyle ?? 'solid';
  const hasPressure = shape.points.some(p => p.pressure !== undefined && p.pressure !== 0.5);

  if (brushStyle === 'solid' && !hasPressure) {
    const points = shape.points.map((p) => [p.x, p.y] as [number, number]);
    rc.curve(points, {
      ...getOptions(shape),
    });
    return;
  }

  drawCustomDoodle(ctx, shape);
}

function getStrokeWidthFromPressure(pressure: number, baseWidth: number): number {
  const minRatio = 0.2;
  const maxRatio = 1.5;
  const ratio = minRatio + pressure * (maxRatio - minRatio);
  return Math.max(0.5, baseWidth * ratio);
}

function applyBrushStyle(ctx: CanvasRenderingContext2D, style: BrushStyle, strokeWidth: number) {
  switch (style) {
    case 'dashed':
      ctx.setLineDash([strokeWidth * 3, strokeWidth * 2]);
      break;
    case 'dotted':
      ctx.setLineDash([0, strokeWidth * 2.5]);
      ctx.lineCap = 'round';
      break;
    case 'solid':
    default:
      ctx.setLineDash([]);
      break;
  }
}

function drawCustomDoodle(ctx: CanvasRenderingContext2D, shape: DoodleShape) {
  const points = shape.points;
  const brushStyle: BrushStyle = shape.brushStyle ?? 'solid';
  const hasPressure = points.some(p => p.pressure !== undefined && p.pressure !== 0.5);

  ctx.save();
  ctx.strokeStyle = shape.strokeColor;
  ctx.fillStyle = shape.strokeColor;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (!hasPressure) {
    ctx.lineWidth = shape.strokeWidth;
    applyBrushStyle(ctx, brushStyle, shape.strokeWidth);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (brushStyle === 'solid') {
    drawPressureSolidLine(ctx, points, shape.strokeWidth);
  } else {
    drawPressureStyledLine(ctx, points, shape.strokeWidth, brushStyle);
  }

  ctx.restore();
}

function drawPressureSolidLine(
  ctx: CanvasRenderingContext2D,
  points: PointWithPressure[],
  baseWidth: number
) {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const w1 = getStrokeWidthFromPressure(p1.pressure ?? 0.5, baseWidth);
    const w2 = getStrokeWidthFromPressure(p2.pressure ?? 0.5, baseWidth);

    const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    const steps = Math.max(1, Math.ceil(dist / 2));

    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      const x = p1.x + (p2.x - p1.x) * t;
      const y = p1.y + (p2.y - p1.y) * t;
      const width = w1 + (w2 - w1) * t;

      ctx.beginPath();
      ctx.arc(x, y, width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const lastPoint = points[points.length - 1];
  const lastWidth = getStrokeWidthFromPressure(lastPoint.pressure ?? 0.5, baseWidth);
  ctx.beginPath();
  ctx.arc(lastPoint.x, lastPoint.y, lastWidth / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPressureStyledLine(
  ctx: CanvasRenderingContext2D,
  points: PointWithPressure[],
  baseWidth: number,
  style: BrushStyle
) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  const avgPressure = points.reduce((sum, p) => sum + (p.pressure ?? 0.5), 0) / points.length;
  const avgWidth = getStrokeWidthFromPressure(avgPressure, baseWidth);

  ctx.lineWidth = avgWidth;
  applyBrushStyle(ctx, style, avgWidth);
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, shape: TextShape) {
  ctx.fillStyle = shape.strokeColor;
  ctx.font = `${shape.fontSize}px 'Caveat', 'Segoe UI', sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(shape.text, shape.x, shape.y);
}

export function getHandleCoordinates(
  bounds: ShapeBounds,
  cx: number,
  cy: number,
  rotation: number
): Record<HandlePosition, { x: number; y: number }> {
  const { x, y, width, height } = bounds;
  const pad = 6;

  const rawHandles = {
    nw: { x: x - pad, y: y - pad },
    n:  { x: x + width / 2, y: y - pad },
    ne: { x: x + width + pad, y: y - pad },
    w:  { x: x - pad, y: y + height / 2 },
    e:  { x: x + width + pad, y: y + height / 2 },
    sw: { x: x - pad, y: y + height + pad },
    s:  { x: x + width / 2, y: y + height + pad },
    se: { x: x + width + pad, y: y + height + pad },
    rotate: { x: x + width / 2, y: y - pad - ROTATE_HANDLE_OFFSET },
  };

  const result: Record<string, { x: number; y: number }> = {};
  for (const key of Object.keys(rawHandles) as HandlePosition[]) {
    result[key] = rotatePoint(rawHandles[key].x, rawHandles[key].y, cx, cy, rotation);
  }
  return result as Record<HandlePosition, { x: number; y: number }>;
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FF6B6B';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.rect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawSelection(
  ctx: CanvasRenderingContext2D,
  shape: Shape
) {
  ctx.save();

  const bounds = getShapeBounds(shape, ctx);
  const { cx, cy } = getShapeCenter(shape, ctx);
  const rotation = shape.rotation || 0;

  ctx.strokeStyle = '#FF6B6B';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.translate(-cx, -cy);

  const pad = 6;
  ctx.strokeRect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2);
  ctx.restore();

  const handles = getHandleCoordinates(bounds, cx, cy, rotation);

  const midTop = handles.n;
  const rotateHandle = handles.rotate;
  ctx.save();
  ctx.strokeStyle = '#FF6B6B';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(midTop.x, midTop.y);
  ctx.lineTo(rotateHandle.x, rotateHandle.y);
  ctx.stroke();
  ctx.restore();

  for (const key of Object.keys(handles) as HandlePosition[]) {
    if (key === 'rotate') {
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#FF6B6B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(handles[key].x, handles[key].y, HANDLE_SIZE / 2 + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FF6B6B';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↻', handles[key].x, handles[key].y);
      ctx.restore();
    } else {
      drawHandle(ctx, handles[key].x, handles[key].y);
    }
  }

  ctx.restore();
}

export function drawMultiSelection(
  ctx: CanvasRenderingContext2D,
  shape: Shape
) {
  ctx.save();

  const bounds = getShapeBounds(shape, ctx);
  const { cx, cy } = getShapeCenter(shape, ctx);
  const rotation = shape.rotation || 0;

  ctx.strokeStyle = '#4ECDC4';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.translate(-cx, -cy);

  const pad = 6;
  ctx.strokeRect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2);
  ctx.restore();

  ctx.restore();
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  zoom: number
) {
  ctx.save();
  ctx.fillStyle = '#E8E4D9';
  const gridSize = 25 * zoom;
  const startX = offsetX % gridSize;
  const startY = offsetY % gridSize;

  for (let x = startX; x < width; x += gridSize) {
    for (let y = startY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function renderAllShapes(
  canvas: HTMLCanvasElement,
  shapes: Shape[],
  selectedIds: string[],
  offsetX: number,
  offsetY: number,
  zoom: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#FFFEF7';
  ctx.fillRect(0, 0, rect.width, rect.height);

  drawGrid(ctx, rect.width, rect.height, offsetX, offsetY, zoom);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(zoom, zoom);

  const selectedSet = new Set(selectedIds);
  const primaryId = selectedIds.length === 1 ? selectedIds[0] : null;

  for (const shape of shapes) {
    drawShape(ctx, shape);
    if (selectedSet.has(shape.id)) {
      if (shape.id === primaryId) {
        drawSelection(ctx, shape);
      } else {
        drawMultiSelection(ctx, shape);
      }
    }
  }

  ctx.restore();
}

export function getHandleAtPoint(
  shape: Shape,
  px: number,
  py: number,
  ctx: CanvasRenderingContext2D
): HandlePosition | null {
  const bounds = getShapeBounds(shape, ctx);
  const { cx, cy } = getShapeCenter(shape, ctx);
  const rotation = shape.rotation || 0;
  const handles = getHandleCoordinates(bounds, cx, cy, rotation);

  const tolerance = HANDLE_SIZE;
  for (const key of Object.keys(handles) as HandlePosition[]) {
    const h = handles[key];
    const dx = px - h.x;
    const dy = py - h.y;
    if (dx * dx + dy * dy <= tolerance * tolerance) {
      return key;
    }
  }
  return null;
}

export function getShapeAtPoint(
  shapes: Shape[],
  px: number,
  py: number,
  ctx: CanvasRenderingContext2D
): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (isPointInShape(shape, px, py, ctx)) {
      return shape;
    }
  }
  return null;
}

function isPointInShape(
  shape: Shape,
  px: number,
  py: number,
  ctx: CanvasRenderingContext2D
): boolean {
  const tolerance = 8;
  const rotation = shape.rotation || 0;
  const { cx, cy } = getShapeCenter(shape, ctx);

  let localPx = px;
  let localPy = py;
  if (rotation !== 0) {
    const rotated = rotatePoint(px, py, cx, cy, -rotation);
    localPx = rotated.x;
    localPy = rotated.y;
  }

  switch (shape.type) {
    case 'rectangle':
    case 'circle':
    case 'diamond':
      return (
        localPx >= shape.x - tolerance &&
        localPx <= shape.x + shape.width + tolerance &&
        localPy >= shape.y - tolerance &&
        localPy <= shape.y + shape.height + tolerance
      );
    case 'line':
    case 'arrow': {
      const { x, y } = rotatePoint(shape.x, shape.y, cx, cy, rotation);
      const { x: x2, y: y2 } = rotatePoint(shape.x2, shape.y2, cx, cy, rotation);
      const dist = pointToLineDistance(
        px, py,
        x, y,
        x2, y2
      );
      return dist <= tolerance;
    }
    case 'doodle': {
      if (shape.points.length < 2) return false;
      for (let i = 0; i < shape.points.length - 1; i++) {
        const p1 = shape.points[i];
        const p2 = shape.points[i + 1];
        const rp1 = rotatePoint(p1.x, p1.y, cx, cy, rotation);
        const rp2 = rotatePoint(p2.x, p2.y, cx, cy, rotation);
        const dist = pointToLineDistance(px, py, rp1.x, rp1.y, rp2.x, rp2.y);
        if (dist <= tolerance) return true;
      }
      return false;
    }
    case 'text': {
      ctx.font = `${shape.fontSize}px 'Caveat', 'Segoe UI', sans-serif`;
      const metrics = ctx.measureText(shape.text);
      return (
        localPx >= shape.x - tolerance &&
        localPx <= shape.x + metrics.width + tolerance &&
        localPy >= shape.y - tolerance &&
        localPy <= shape.y + shape.fontSize + tolerance
      );
    }
  }
}

function pointToLineDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = lenSq !== 0 ? dot / lenSq : -1;

  let xx: number, yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}
