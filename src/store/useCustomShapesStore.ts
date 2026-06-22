import { create } from 'zustand';
import type { Shape, CustomShapeTemplate } from '../types';
import { generateId, generateSeed } from '../utils/idGenerator';

const CUSTOM_SHAPES_KEY = 'sketchpad-custom-shapes';

interface CustomShapesStore {
  templates: CustomShapeTemplate[];
  showPanel: boolean;

  loadTemplates: () => void;
  saveTemplates: () => void;
  setShowPanel: (show: boolean) => void;

  addTemplate: (name: string, shapes: Shape[]) => string;
  deleteTemplate: (id: string) => void;
  renameTemplate: (id: string, name: string) => void;

  instantiateTemplate: (id: string, offsetX?: number, offsetY?: number) => Shape[];
}

function normalizeShapes(shapes: Shape[]): Shape[] {
  if (shapes.length === 0) return [];

  let minX = Infinity;
  let minY = Infinity;

  const bounds = shapes.map((shape) => {
    let shapeMinX = shape.x;
    let shapeMinY = shape.y;

    if (shape.type === 'line' || shape.type === 'arrow') {
      shapeMinX = Math.min(shape.x, shape.x2);
      shapeMinY = Math.min(shape.y, shape.y2);
    }

    if (shape.type === 'doodle' && shape.points.length > 0) {
      for (const p of shape.points) {
        shapeMinX = Math.min(shapeMinX, p.x);
        shapeMinY = Math.min(shapeMinY, p.y);
      }
    }

    return { shapeMinX, shapeMinY };
  });

  for (const b of bounds) {
    minX = Math.min(minX, b.shapeMinX);
    minY = Math.min(minY, b.shapeMinY);
  }

  return shapes.map((shape, index) => {
    const dx = minX;
    const dy = minY;

    const newShape = { ...shape } as Shape;

    newShape.x = shape.x - dx;
    newShape.y = shape.y - dy;

    if (shape.type === 'line' || shape.type === 'arrow') {
      (newShape as any).x2 = shape.x2 - dx;
      (newShape as any).y2 = shape.y2 - dy;
    }

    if (shape.type === 'doodle') {
      (newShape as any).points = shape.points.map((p) => ({
        x: p.x - dx,
        y: p.y - dy,
        pressure: p.pressure,
      }));
    }

    return newShape;
  });
}

function loadTemplatesFromStorage(): CustomShapeTemplate[] {
  try {
    const data = localStorage.getItem(CUSTOM_SHAPES_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.map((t: CustomShapeTemplate) => ({
        ...t,
        shapes: t.shapes.map((s: Shape) => ({
          ...s,
          rotation: s.rotation ?? 0,
        })),
      }));
    }
  } catch (e) {
    console.error('Failed to load custom shapes:', e);
  }
  return [];
}

export const useCustomShapesStore = create<CustomShapesStore>((set, get) => ({
  templates: loadTemplatesFromStorage(),
  showPanel: false,

  loadTemplates: () => {
    set({ templates: loadTemplatesFromStorage() });
  },

  saveTemplates: () => {
    try {
      const { templates } = get();
      localStorage.setItem(CUSTOM_SHAPES_KEY, JSON.stringify(templates));
    } catch (e) {
      console.error('Failed to save custom shapes:', e);
    }
  },

  setShowPanel: (show) => set({ showPanel: show }),

  addTemplate: (name, shapes) => {
    const id = generateId();
    const normalizedShapes = normalizeShapes(shapes);
    const template: CustomShapeTemplate = {
      id,
      name: name || `自定义图形 ${get().templates.length + 1}`,
      shapes: normalizedShapes,
      createdAt: Date.now(),
    };

    set((state) => ({
      templates: [...state.templates, template],
    }));
    get().saveTemplates();
    return id;
  },

  deleteTemplate: (id) => {
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    }));
    get().saveTemplates();
  },

  renameTemplate: (id, name) => {
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, name } : t
      ),
    }));
    get().saveTemplates();
  },

  instantiateTemplate: (id, offsetX = 100, offsetY = 100) => {
    const template = get().templates.find((t) => t.id === id);
    if (!template) return [];

    return template.shapes.map((shape) => {
      const newShape = { ...shape } as Shape;
      newShape.id = generateId();
      newShape.seed = generateSeed();
      newShape.x = shape.x + offsetX;
      newShape.y = shape.y + offsetY;

      if (shape.type === 'line' || shape.type === 'arrow') {
        (newShape as any).x2 = (shape as any).x2 + offsetX;
        (newShape as any).y2 = (shape as any).y2 + offsetY;
      }

      if (shape.type === 'doodle') {
        (newShape as any).points = (shape as any).points.map((p: any) => ({
          x: p.x + offsetX,
          y: p.y + offsetY,
          pressure: p.pressure,
        }));
      }

      return newShape;
    });
  },
}));
