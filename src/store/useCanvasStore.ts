import { create } from 'zustand';
import type { Shape, ToolType, CanvasState, HistoryState, BrushStyle } from '../types';
import {
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_FONT_SIZE,
  DEFAULT_ROUGHNESS,
  DEFAULT_BRUSH_STYLE,
  DEFAULT_SMOOTHING,
  DEFAULT_PRESSURE_SENSITIVITY,
} from '../types';
import { generateId, generateSeed } from '../utils/idGenerator';

const HISTORY_LIMIT = 50;
const STORAGE_KEY = 'sketchpad-canvas';

interface CanvasStore {
  shapes: Shape[];
  selectedIds: string[];
  currentTool: ToolType;
  currentColor: string;
  currentStrokeWidth: number;
  currentFontSize: number;
  currentBrushStyle: BrushStyle;
  currentSmoothing: number;
  pressureSensitivity: boolean;
  offsetX: number;
  offsetY: number;
  zoom: number;
  past: Shape[][];
  future: Shape[][];
  saveStatus: 'saved' | 'saving' | 'unsaved';

  setTool: (tool: ToolType) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setFontSize: (size: number) => void;
  setBrushStyle: (style: BrushStyle) => void;
  setSmoothing: (smoothing: number) => void;
  setPressureSensitivity: (enabled: boolean) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectedId: (id: string) => void;

  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  updateShapes: (ids: string[], updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;

  setOffset: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  pushHistory: () => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
  clearCanvas: () => void;
}

function loadShapesFromStorage(): Shape[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.map((s: Shape) => ({
        ...s,
        rotation: s.rotation ?? 0,
      }));
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  return [];
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  shapes: loadShapesFromStorage(),
  selectedIds: [],
  currentTool: 'select',
  currentColor: DEFAULT_COLOR,
  currentStrokeWidth: DEFAULT_STROKE_WIDTH,
  currentFontSize: DEFAULT_FONT_SIZE,
  currentBrushStyle: DEFAULT_BRUSH_STYLE,
  currentSmoothing: DEFAULT_SMOOTHING,
  pressureSensitivity: DEFAULT_PRESSURE_SENSITIVITY,
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  past: [],
  future: [],
  saveStatus: 'saved',

  setTool: (tool) => set({ currentTool: tool }),
  setColor: (color) => set({ currentColor: color }),
  setStrokeWidth: (width) => set({ currentStrokeWidth: width }),
  setFontSize: (size) => set({ currentFontSize: size }),
  setBrushStyle: (style) => set({ currentBrushStyle: style }),
  setSmoothing: (smoothing) => set({ currentSmoothing: smoothing }),
  setPressureSensitivity: (enabled) => set({ pressureSensitivity: enabled }),

  setSelectedId: (id) => {
    if (id === null) {
      set({ selectedIds: [] });
    } else {
      set({ selectedIds: [id] });
    }
  },

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  toggleSelectedId: (id) => {
    const { selectedIds } = get();
    if (selectedIds.includes(id)) {
      set({ selectedIds: selectedIds.filter((x) => x !== id) });
    } else {
      set({ selectedIds: [...selectedIds, id] });
    }
  },

  addShape: (shape) => {
    const state = get();
    set({
      shapes: [...state.shapes, shape],
      past: [...state.past.slice(-HISTORY_LIMIT + 1), state.shapes],
      future: [],
      saveStatus: 'unsaved',
    });
    get().saveToStorage();
  },

  updateShape: (id, updates) => {
    const state = get();
    const newShapes = state.shapes.map((s) =>
      s.id === id ? ({ ...s, ...updates } as Shape) : s
    );
    set({ shapes: newShapes, saveStatus: 'unsaved' });
    get().saveToStorage();
  },

  updateShapes: (ids, updates) => {
    const state = get();
    const idSet = new Set(ids);
    const newShapes = state.shapes.map((s) =>
      idSet.has(s.id) ? ({ ...s, ...updates } as Shape) : s
    );
    set({ shapes: newShapes, saveStatus: 'unsaved' });
    get().saveToStorage();
  },

  deleteShape: (id) => {
    const state = get();
    set({
      shapes: state.shapes.filter((s) => s.id !== id),
      selectedIds: state.selectedIds.filter((x) => x !== id),
      past: [...state.past.slice(-HISTORY_LIMIT + 1), state.shapes],
      future: [],
      saveStatus: 'unsaved',
    });
    get().saveToStorage();
  },

  deleteSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    const state = get();
    set({
      shapes: state.shapes.filter((s) => !idSet.has(s.id)),
      selectedIds: [],
      past: [...state.past.slice(-HISTORY_LIMIT + 1), state.shapes],
      future: [],
      saveStatus: 'unsaved',
    });
    get().saveToStorage();
  },

  duplicateSelected: () => {
    const { selectedIds, shapes } = get();
    if (selectedIds.length === 0) return;

    const state = get();
    const newShapes = [...state.shapes];
    const newSelectedIds: string[] = [];

    for (const id of selectedIds) {
      const shape = shapes.find((s) => s.id === id);
      if (!shape) continue;

      const copiedShape: Shape = {
        ...shape,
        id: generateId(),
        seed: generateSeed(),
        x: shape.x + 20,
        y: shape.y + 20,
      };

      if (shape.type === 'line' || shape.type === 'arrow') {
        (copiedShape as any).x2 = (shape as any).x2 + 20;
        (copiedShape as any).y2 = (shape as any).y2 + 20;
      }

      if (shape.type === 'doodle') {
        (copiedShape as any).points = (shape as any).points.map((p: any) => ({
          ...p,
          x: p.x + 20,
          y: p.y + 20,
        }));
      }

      newShapes.push(copiedShape);
      newSelectedIds.push(copiedShape.id);
    }

    set({
      shapes: newShapes,
      selectedIds: newSelectedIds,
      past: [...state.past.slice(-HISTORY_LIMIT + 1), state.shapes],
      future: [],
      saveStatus: 'unsaved',
    });
    get().saveToStorage();
  },

  setOffset: (x, y) => set({ offsetX: x, offsetY: y }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    set({
      past: newPast,
      shapes: previous,
      selectedIds: [],
      future: [state.shapes, ...state.future],
      saveStatus: 'unsaved',
    });
    get().saveToStorage();
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    set({
      past: [...state.past, state.shapes],
      shapes: next,
      selectedIds: [],
      future: newFuture,
      saveStatus: 'unsaved',
    });
    get().saveToStorage();
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  pushHistory: () => {
    const state = get();
    set({
      past: [...state.past.slice(-HISTORY_LIMIT + 1), state.shapes],
      future: [],
    });
  },

  loadFromStorage: () => {
    const shapes = loadShapesFromStorage();
    set({ shapes, saveStatus: 'saved' });
  },

  saveToStorage: () => {
    set({ saveStatus: 'saving' });
    try {
      const { shapes } = get();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shapes));
      setTimeout(() => set({ saveStatus: 'saved' }), 300);
    } catch (e) {
      console.error('Failed to save to storage:', e);
      set({ saveStatus: 'unsaved' });
    }
  },

  clearCanvas: () => {
    const state = get();
    if (state.shapes.length === 0) return;
    if (!confirm('确定要清空画布吗？此操作不可撤销。')) return;
    set({
      shapes: [],
      selectedIds: [],
      past: [...state.past.slice(-HISTORY_LIMIT + 1), state.shapes],
      future: [],
      saveStatus: 'unsaved',
    });
    get().saveToStorage();
  },
}));
