/**
 * Template Store Slice
 *
 * Contains all template-related actions for the topology store.
 */

import type { StateCreator } from 'zustand';

import type { NodeTemplate, LinkTemplate, SimNodeTemplate } from '../../types/schema';
import type { UISimulation } from '../../types/ui';
import { validateTemplateName } from '../utils';

export interface TemplateState {
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
}

export interface TemplateActions {
  addNodeTemplate: (template: NodeTemplate) => void;
  updateNodeTemplate: (name: string, template: Partial<NodeTemplate>) => boolean;
  deleteNodeTemplate: (name: string) => void;
  addLinkTemplate: (template: LinkTemplate) => void;
  updateLinkTemplate: (name: string, template: Partial<LinkTemplate>) => boolean;
  deleteLinkTemplate: (name: string) => void;
  addSimNodeTemplate: (template: SimNodeTemplate) => void;
  updateSimNodeTemplate: (name: string, template: Partial<SimNodeTemplate>) => boolean;
  deleteSimNodeTemplate: (name: string) => void;
}

export type TemplateSlice = TemplateState & TemplateActions;

export type TemplateSliceCreator = StateCreator<
  TemplateSlice & {
    simulation: UISimulation;
    triggerYamlRefresh: () => void;
    setError: (error: string | null) => void;
  },
  [],
  [],
  TemplateSlice
>;

export const createTemplateSlice: TemplateSliceCreator = (set, get) => ({
  nodeTemplates: [],
  linkTemplates: [],

  addNodeTemplate: (template: NodeTemplate) => {
    const existingNames = get().nodeTemplates.map(t => t.name);
    const nameError = validateTemplateName(template.name, existingNames);
    if (nameError) {
      get().setError(`Invalid template name: ${nameError}`);
      return;
    }
    set({ nodeTemplates: [...get().nodeTemplates, template] });
    get().triggerYamlRefresh();
  },

  updateNodeTemplate: (name: string, template: Partial<NodeTemplate>): boolean => {
    if (template.name && template.name !== name) {
      const existingNames = get().nodeTemplates.filter(t => t.name !== name).map(t => t.name);
      const nameError = validateTemplateName(template.name, existingNames);
      if (nameError) {
        get().setError(`Invalid template name: ${nameError}`);
        return false;
      }
    }
    set({
      nodeTemplates: get().nodeTemplates.map(t =>
        t.name === name ? { ...t, ...template } : t,
      ),
    });
    get().triggerYamlRefresh();
    return true;
  },

  deleteNodeTemplate: (name: string) => {
    set({ nodeTemplates: get().nodeTemplates.filter(t => t.name !== name) });
    get().triggerYamlRefresh();
  },

  addLinkTemplate: (template: LinkTemplate) => {
    const existingNames = get().linkTemplates.map(t => t.name);
    const nameError = validateTemplateName(template.name, existingNames);
    if (nameError) {
      get().setError(`Invalid template name: ${nameError}`);
      return;
    }
    set({ linkTemplates: [...get().linkTemplates, template] });
    get().triggerYamlRefresh();
  },

  updateLinkTemplate: (name: string, template: Partial<LinkTemplate>): boolean => {
    if (template.name && template.name !== name) {
      const existingNames = get().linkTemplates.filter(t => t.name !== name).map(t => t.name);
      const nameError = validateTemplateName(template.name, existingNames);
      if (nameError) {
        get().setError(`Invalid template name: ${nameError}`);
        return false;
      }
    }
    set({
      linkTemplates: get().linkTemplates.map(t =>
        t.name === name ? { ...t, ...template } : t,
      ),
    });
    get().triggerYamlRefresh();
    return true;
  },

  deleteLinkTemplate: (name: string) => {
    set({ linkTemplates: get().linkTemplates.filter(t => t.name !== name) });
    get().triggerYamlRefresh();
  },

  addSimNodeTemplate: (template: SimNodeTemplate) => {
    const simulation = get().simulation;
    const existingNames = simulation.simNodeTemplates.map(t => t.name);
    const nameError = validateTemplateName(template.name, existingNames);
    if (nameError) {
      get().setError(`Invalid template name: ${nameError}`);
      return;
    }
    set({
      simulation: {
        ...simulation,
        simNodeTemplates: [...simulation.simNodeTemplates, template],
      },
    } as Partial<TemplateSlice>);
    get().triggerYamlRefresh();
  },

  updateSimNodeTemplate: (name: string, template: Partial<SimNodeTemplate>): boolean => {
    const simulation = get().simulation;
    if (template.name && template.name !== name) {
      const existingNames = simulation.simNodeTemplates.filter(t => t.name !== name).map(t => t.name);
      const nameError = validateTemplateName(template.name, existingNames);
      if (nameError) {
        get().setError(`Invalid template name: ${nameError}`);
        return false;
      }
    }
    set({
      simulation: {
        ...simulation,
        simNodeTemplates: simulation.simNodeTemplates.map(t =>
          t.name === name ? { ...t, ...template } : t,
        ),
      },
    } as Partial<TemplateSlice>);
    get().triggerYamlRefresh();
    return true;
  },

  deleteSimNodeTemplate: (name: string) => {
    const simulation = get().simulation;
    set({
      simulation: {
        ...simulation,
        simNodeTemplates: simulation.simNodeTemplates.filter(t => t.name !== name),
      },
    } as Partial<TemplateSlice>);
    get().triggerYamlRefresh();
  },
});
