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

const HISTORY_LIMIT = 50;
const STORAGE_KEY = 'sketchpad-canvas';

interface CanvasStore {
  shapes: Shape[];
  selectedId: string | null;
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

  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  deleteSelected: () => void;

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
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  return [];
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  shapes: loadShapesFromStorage(),
  selectedId: null,
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
  setSelectedId: (id) => set({ selectedId: id }),

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

  deleteShape: (id) => {
    const state = get();
    set({
      shapes: state.shapes.filter((s) => s.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      past: [...state.past.slice(-HISTORY_LIMIT + 1), state.shapes],
      future: [],
      saveStatus: 'unsaved',
    });
    get().saveToStorage();
  },

  deleteSelected: () => {
    const { selectedId } = get();
    if (selectedId) {
      get().deleteShape(selectedId);
    }
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
      selectedId: null,
      past: [...state.past.slice(-HISTORY_LIMIT + 1), state.shapes],
      future: [],
      saveStatus: 'unsaved',
    });
    get().saveToStorage();
  },
}));
