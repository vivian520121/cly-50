export type ShapeType = 'rectangle' | 'line' | 'text';
export type ToolType = 'select' | ShapeType;

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  roughness: number;
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

export type Shape = RectangleShape | LineShape | TextShape;

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

export const STROKE_WIDTHS = [1, 2, 3, 4, 6];

export const DEFAULT_COLOR = '#1E1E1E';
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_ROUGHNESS = 1.5;
