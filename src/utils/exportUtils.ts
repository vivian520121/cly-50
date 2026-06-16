import type { Shape } from '../types';
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';

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

function drawShapeToContext(
  ctx: CanvasRenderingContext2D,
  shape: Shape
) {
  const roughCanvas = rough.canvas(ctx.canvas);

  switch (shape.type) {
    case 'rectangle':
      roughCanvas.rectangle(
        shape.x, shape.y, shape.width, shape.height, getOptions(shape)
      );
      break;
    case 'circle':
      roughCanvas.ellipse(
        shape.x + shape.width / 2,
        shape.y + shape.height / 2,
        shape.width,
        shape.height,
        getOptions(shape)
      );
      break;
    case 'diamond': {
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const points = [
        [cx, shape.y],
        [shape.x + shape.width, cy],
        [cx, shape.y + shape.height],
        [shape.x, cy],
      ] as [number, number][];
      roughCanvas.polygon(points, getOptions(shape));
      break;
    }
    case 'line':
      roughCanvas.line(
        shape.x, shape.y, shape.x2, shape.y2, getOptions(shape)
      );
      break;
    case 'arrow': {
      roughCanvas.line(
        shape.x, shape.y, shape.x2, shape.y2, getOptions(shape)
      );
      const angle = Math.atan2(shape.y2 - shape.y, shape.x2 - shape.x);
      const arrowSize = shape.strokeWidth * 6 + 10;
      const arrowAngle = Math.PI / 6;
      const x1 = shape.x2 - arrowSize * Math.cos(angle - arrowAngle);
      const y1 = shape.y2 - arrowSize * Math.sin(angle - arrowAngle);
      const x2 = shape.x2 - arrowSize * Math.cos(angle + arrowAngle);
      const y2 = shape.y2 - arrowSize * Math.sin(angle + arrowAngle);
      const arrowOptions = { ...getOptions(shape), fill: shape.strokeColor, fillStyle: 'solid' as const };
      roughCanvas.polygon(
        [[shape.x2, shape.y2], [x1, y1], [x2, y2]] as [number, number][],
        arrowOptions
      );
      break;
    }
    case 'doodle': {
      if (shape.points.length >= 2) {
        const points = shape.points.map((p) => [p.x, p.y] as [number, number]);
        roughCanvas.curve(points, getOptions(shape));
      }
      break;
    }
    case 'text':
      ctx.fillStyle = shape.strokeColor;
      ctx.font = `${shape.fontSize}px 'Caveat', 'Segoe UI', sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(shape.text, shape.x, shape.y);
      break;
  }
}

export function exportToPNG(
  shapes: Shape[],
  filename: string = 'sketchpad.png'
) {
  if (shapes.length === 0) {
    alert('画布为空，无法导出');
    return;
  }

  const bounds = getShapesBounds(shapes);
  const padding = 40;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  ctx.fillStyle = '#FFFEF7';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(-bounds.minX + padding, -bounds.minY + padding);

  for (const shape of shapes) {
    drawShapeToContext(ctx, shape);
  }
  ctx.restore();

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function exportToSVG(
  shapes: Shape[],
  filename: string = 'sketchpad.svg'
) {
  if (shapes.length === 0) {
    alert('画布为空，无法导出');
    return;
  }

  const bounds = getShapesBounds(shapes);
  const padding = 40;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#FFFEF7');
  svg.appendChild(bg);

  const rc = rough.svg(svg);
  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);

  for (const shape of shapes) {
    const options = getOptions(shape);
    let node: SVGElement | null = null;
    switch (shape.type) {
      case 'rectangle':
        node = rc.rectangle(shape.x, shape.y, shape.width, shape.height, options);
        break;
      case 'circle':
        node = rc.ellipse(
          shape.x + shape.width / 2,
          shape.y + shape.height / 2,
          shape.width,
          shape.height,
          options
        );
        break;
      case 'diamond': {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const points = [
          [cx, shape.y],
          [shape.x + shape.width, cy],
          [cx, shape.y + shape.height],
          [shape.x, cy],
        ] as [number, number][];
        node = rc.polygon(points, options);
        break;
      }
      case 'line':
        node = rc.line(shape.x, shape.y, shape.x2, shape.y2, options);
        break;
      case 'arrow': {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const lineNode = rc.line(shape.x, shape.y, shape.x2, shape.y2, options);
        g.appendChild(lineNode);

        const angle = Math.atan2(shape.y2 - shape.y, shape.x2 - shape.x);
        const arrowSize = shape.strokeWidth * 6 + 10;
        const arrowAngle = Math.PI / 6;
        const x1 = shape.x2 - arrowSize * Math.cos(angle - arrowAngle);
        const y1 = shape.y2 - arrowSize * Math.sin(angle - arrowAngle);
        const x2 = shape.x2 - arrowSize * Math.cos(angle + arrowAngle);
        const y2 = shape.y2 - arrowSize * Math.sin(angle + arrowAngle);

        const arrowOptions = { ...options, fill: shape.strokeColor, fillStyle: 'solid' as const };
        const arrowNode = rc.polygon(
          [[shape.x2, shape.y2], [x1, y1], [x2, y2]] as [number, number][],
          arrowOptions
        );
        g.appendChild(arrowNode);
        node = g;
        break;
      }
      case 'doodle': {
        if (shape.points.length >= 2) {
          const points = shape.points.map((p) => [p.x, p.y] as [number, number]);
          node = rc.curve(points, options);
        }
        break;
      }
      case 'text': {
        node = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        node.setAttribute('x', String(shape.x));
        node.setAttribute('y', String(shape.y + shape.fontSize * 0.85));
        node.setAttribute('fill', shape.strokeColor);
        node.setAttribute('font-size', String(shape.fontSize));
        node.setAttribute('font-family', "'Caveat', 'Segoe UI', sans-serif");
        node.textContent = shape.text;
        break;
      }
    }

    if (node) {
      g.appendChild(node);
    }
  }

  svg.appendChild(g);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
}

function getShapesBounds(shapes: Shape[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const tmpCanvas = document.createElement('canvas');
  const ctx = tmpCanvas.getContext('2d')!;

  for (const shape of shapes) {
    switch (shape.type) {
      case 'rectangle':
      case 'circle':
      case 'diamond':
        minX = Math.min(minX, shape.x);
        minY = Math.min(minY, shape.y);
        maxX = Math.max(maxX, shape.x + shape.width);
        maxY = Math.max(maxY, shape.y + shape.height);
        break;
      case 'line':
      case 'arrow':
        minX = Math.min(minX, shape.x, shape.x2);
        minY = Math.min(minY, shape.y, shape.y2);
        maxX = Math.max(maxX, shape.x, shape.x2);
        maxY = Math.max(maxY, shape.y, shape.y2);
        break;
      case 'doodle':
        for (const p of shape.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        break;
      case 'text':
        ctx.font = `${shape.fontSize}px 'Caveat', 'Segoe UI', sans-serif`;
        const metrics = ctx.measureText(shape.text);
        minX = Math.min(minX, shape.x);
        minY = Math.min(minY, shape.y);
        maxX = Math.max(maxX, shape.x + metrics.width);
        maxY = Math.max(maxY, shape.y + shape.fontSize);
        break;
    }
  }

  return { minX, minY, maxX, maxY };
}
