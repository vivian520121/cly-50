import rough from 'roughjs';
import type { Shape, RectangleShape, LineShape, TextShape } from '../types';
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
    case 'line':
      drawLine(roughCanvas, shape);
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
      x = shape.x - 6;
      y = shape.y - 6;
      w = shape.width + 12;
      h = shape.height + 12;
      break;
    case 'line':
      x = Math.min(shape.x, shape.x2) - 6;
      y = Math.min(shape.y, shape.y2) - 6;
      w = Math.abs(shape.x2 - shape.x) + 12;
      h = Math.abs(shape.y2 - shape.y) + 12;
      break;
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
      return (
        px >= shape.x - tolerance &&
        px <= shape.x + shape.width + tolerance &&
        py >= shape.y - tolerance &&
        py <= shape.y + shape.height + tolerance
      );
    case 'line': {
      const dist = pointToLineDistance(
        px, py,
        shape.x, shape.y,
        shape.x2, shape.y2
      );
      return dist <= tolerance;
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
