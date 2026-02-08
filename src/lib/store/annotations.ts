import type { StateCreator } from 'zustand';

import type { UIAnnotation, UIAnnotationInput, UITextAnnotation, UIShapeAnnotation } from '../../types/ui';

export interface AnnotationState {
  annotations: UIAnnotation[];
  selectedAnnotationId: string | null;
  selectedAnnotationIds: Set<string>;
}

export interface AnnotationActions {
  addAnnotation: (annotation: UIAnnotationInput) => void;
  updateAnnotation: (id: string, update: Partial<Omit<UITextAnnotation, 'id' | 'type'>> | Partial<Omit<UIShapeAnnotation, 'id' | 'type'>>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  selectAnnotations: (ids: Set<string>) => void;
}

export type AnnotationSlice = AnnotationState & AnnotationActions;

let annotationIdCounter = 1;

export const setAnnotationIdCounter = (n: number) => { annotationIdCounter = n; };

export function generateAnnotationId(): string {
  return `a${annotationIdCounter++}`;
}

export type AnnotationSliceCreator = StateCreator<
  AnnotationSlice & {
    triggerYamlRefresh: () => void;
    saveToUndoHistory: () => void;
  },
  [],
  [],
  AnnotationSlice
>;

export const createAnnotationSlice: AnnotationSliceCreator = (set, get) => ({
  annotations: [],
  selectedAnnotationId: null,
  selectedAnnotationIds: new Set(),

  addAnnotation: input => {
    get().saveToUndoHistory();
    const id = generateAnnotationId();
    const annotation = { ...input, id } as UIAnnotation;
    set({
      annotations: [...get().annotations, annotation],
      selectedAnnotationId: id,
      selectedAnnotationIds: new Set([id]),
    });
    get().triggerYamlRefresh();
  },

  updateAnnotation: (id, update) => {
    get().saveToUndoHistory();
    set({
      annotations: get().annotations.map(a =>
        a.id === id ? { ...a, ...update } as UIAnnotation : a,
      ),
    });
    get().triggerYamlRefresh();
  },

  deleteAnnotation: id => {
    get().saveToUndoHistory();
    const newIds = new Set(get().selectedAnnotationIds);
    newIds.delete(id);
    set({
      annotations: get().annotations.filter(a => a.id !== id),
      selectedAnnotationId: get().selectedAnnotationId === id ? null : get().selectedAnnotationId,
      selectedAnnotationIds: newIds,
    });
    get().triggerYamlRefresh();
  },

  selectAnnotation: id => {
    set({
      selectedAnnotationId: id,
      selectedAnnotationIds: id ? new Set([id]) : new Set(),
    });
  },

  selectAnnotations: ids => {
    const lastId = ids.size > 0 ? [...ids][ids.size - 1] : null;
    set({
      selectedAnnotationIds: ids,
      selectedAnnotationId: lastId,
    });
  },
});
