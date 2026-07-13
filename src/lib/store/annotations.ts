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
    yamlRefreshCounter: number;
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
    const state = get();
    const id = generateAnnotationId();
    const annotation = { ...input, id };
    set({
      annotations: [...state.annotations, annotation],
      selectedAnnotationId: id,
      selectedAnnotationIds: new Set([id]),
      yamlRefreshCounter: state.yamlRefreshCounter + 1,
    });
  },

  updateAnnotation: (id, update) => {
    get().saveToUndoHistory();
    const state = get();
    set({
      annotations: state.annotations.map(a =>
        a.id === id ? { ...a, ...update } : a,
      ),
      yamlRefreshCounter: state.yamlRefreshCounter + 1,
    });
  },

  deleteAnnotation: id => {
    get().saveToUndoHistory();
    const state = get();
    const newIds = new Set(state.selectedAnnotationIds);
    newIds.delete(id);
    set({
      annotations: state.annotations.filter(a => a.id !== id),
      selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
      selectedAnnotationIds: newIds,
      yamlRefreshCounter: state.yamlRefreshCounter + 1,
    });
  },

  selectAnnotation: id => {
    const state = get();
    const alreadySelected = id === null
      ? state.selectedAnnotationId === null && state.selectedAnnotationIds.size === 0
      : state.selectedAnnotationId === id
        && state.selectedAnnotationIds.size === 1
        && state.selectedAnnotationIds.has(id);
    if (alreadySelected) return;
    set({
      selectedAnnotationId: id,
      selectedAnnotationIds: id ? new Set([id]) : new Set(),
    });
  },

  selectAnnotations: ids => {
    const lastId = ids.size > 0 ? [...ids][ids.size - 1] : null;
    const current = get().selectedAnnotationIds;
    if (
      get().selectedAnnotationId === lastId
      && current.size === ids.size
      && [...ids].every(id => current.has(id))
    ) return;
    set({
      selectedAnnotationIds: ids,
      selectedAnnotationId: lastId,
    });
  },
});
