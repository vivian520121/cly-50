export type ShapeType = 'rectangle' | 'circle' | 'diamond' | 'line' | 'arrow' | 'text' | 'doodle';
export type ToolType = 'select' | ShapeType;

export type BrushStyle = 'solid' | 'dashed' | 'dotted';

export interface PointWithPressure {
  x: number;
  y: number;
  pressure: number;
}

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  roughness: number;
  seed: number;
  brushStyle?: BrushStyle;
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  width: number;
  height: number;
}

export interface LineShape extends BaseShape {
  type: 'line';
  x2: number;
  y2: number;
}

export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  fontSize: number;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  width: number;
  height: number;
}

export interface DiamondShape extends BaseShape {
  type: 'diamond';
  width: number;
  height: number;
}

export interface ArrowShape extends BaseShape {
  type: 'arrow';
  x2: number;
  y2: number;
}

export interface DoodleShape extends BaseShape {
  type: 'doodle';
  points: PointWithPressure[];
}

export type Shape = RectangleShape | CircleShape | DiamondShape | LineShape | ArrowShape | TextShape | DoodleShape;

export interface CanvasState {
  shapes: Shape[];
  selectedId: string | null;
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface HistoryState {
  past: Shape[][];
  present: Shape[];
  future: Shape[][];
}

export const COLORS = [
  '#1E1E1E',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
];

export const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8, 12, 20];
export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 20;

export const BRUSH_STYLES: { value: BrushStyle; label: string }[] = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点状' },
];

export const DEFAULT_COLOR = '#1E1E1E';
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_ROUGHNESS = 1.5;
export const DEFAULT_BRUSH_STYLE: BrushStyle = 'solid';
export const DEFAULT_SMOOTHING = 0.5;
export const MIN_SMOOTHING = 0;
export const MAX_SMOOTHING = 1;
export const DEFAULT_PRESSURE_SENSITIVITY = true;
