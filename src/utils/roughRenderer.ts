import rough from 'roughjs';
import type { Shape, RectangleShape, CircleShape, DiamondShape, LineShape, ArrowShape, TextShape, DoodleShape, PointWithPressure, BrushStyle } from '../types';
import type { Options } from 'roughjs/bin/core';

const roughCache = new Map<string, ReturnType<typeof rough.generator>>();

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

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape
) {
  ctx.save();

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

export function drawSelection(
  ctx: CanvasRenderingContext2D,
  shape: Shape
) {
  ctx.save();
  ctx.strokeStyle = '#FF6B6B';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);

  let x: number, y: number, w: number, h: number;

  switch (shape.type) {
    case 'rectangle':
    case 'circle':
    case 'diamond':
      x = shape.x - 6;
      y = shape.y - 6;
      w = shape.width + 12;
      h = shape.height + 12;
      break;
    case 'line':
    case 'arrow':
      x = Math.min(shape.x, shape.x2) - 6;
      y = Math.min(shape.y, shape.y2) - 6;
      w = Math.abs(shape.x2 - shape.x) + 12;
      h = Math.abs(shape.y2 - shape.y) + 12;
      break;
    case 'doodle': {
      if (shape.points.length === 0) {
        x = 0; y = 0; w = 0; h = 0;
        break;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of shape.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      x = minX - 6;
      y = minY - 6;
      w = maxX - minX + 12;
      h = maxY - minY + 12;
      break;
    }
    case 'text':
      ctx.font = `${shape.fontSize}px 'Caveat', 'Segoe UI', sans-serif`;
      const metrics = ctx.measureText(shape.text);
      x = shape.x - 6;
      y = shape.y - 6;
      w = metrics.width + 12;
      h = shape.fontSize + 12;
      break;
  }

  ctx.strokeRect(x, y, w, h);
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
  selectedId: string | null,
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

  for (const shape of shapes) {
    drawShape(ctx, shape);
    if (shape.id === selectedId) {
      drawSelection(ctx, shape);
    }
  }

  ctx.restore();
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

  switch (shape.type) {
    case 'rectangle':
    case 'circle':
    case 'diamond':
      return (
        px >= shape.x - tolerance &&
        px <= shape.x + shape.width + tolerance &&
        py >= shape.y - tolerance &&
        py <= shape.y + shape.height + tolerance
      );
    case 'line':
    case 'arrow': {
      const dist = pointToLineDistance(
        px, py,
        shape.x, shape.y,
        shape.x2, shape.y2
      );
      return dist <= tolerance;
    }
    case 'doodle': {
      if (shape.points.length < 2) return false;
      for (let i = 0; i < shape.points.length - 1; i++) {
        const p1 = shape.points[i];
        const p2 = shape.points[i + 1];
        const dist = pointToLineDistance(px, py, p1.x, p1.y, p2.x, p2.y);
        if (dist <= tolerance) return true;
      }
      return false;
    }
    case 'text': {
      ctx.font = `${shape.fontSize}px 'Caveat', 'Segoe UI', sans-serif`;
      const metrics = ctx.measureText(shape.text);
      return (
        px >= shape.x - tolerance &&
        px <= shape.x + metrics.width + tolerance &&
        py >= shape.y - tolerance &&
        py <= shape.y + shape.fontSize + tolerance
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
