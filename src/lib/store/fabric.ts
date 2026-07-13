/**
 * Fabric Store Slice
 *
 * One action: `addFabric` — materialise a leaf-spine fabric (N spines × M leaves) with the
 * inter-switch links cabled the way the Nokia validated designs do it: every leaf connects to
 * every spine, leaf uplink k of spine j lands on the leaf's next free port, and spine j's
 * downlinks fill sequentially so leaf i always sits on the same port index of every spine.
 */

import type { StateCreator } from 'zustand';

import type { UIEdge, UINode } from '../../types/ui';
import type { Component, LinkTemplate, NodeTemplate } from '../../types/schema';
import { generateUniqueName } from '../utils';
import { frontPanelMetaOf, frontPanelNodeSize, interfaceForCage, resolveFrontPanel } from '../frontpanel';
import { osOfPlatform } from '../catalog';
import { DEFAULT_NODE_PROFILE_SRL, DEFAULT_NODE_PROFILE_SROS } from '../constants';
import { getSchemaEnums } from '../schemaEnums';

export interface FabricTierConfig {
  count: number;
  platform: string;
  components?: Component[];
}

export interface FabricConfig {
  spines: FabricTierConfig;
  leaves: FabricTierConfig;
  /** links between each leaf-spine pair (>= 1) */
  uplinksPerPair: number;
}

export interface FabricActions {
  addFabric: (config: FabricConfig) => boolean;
}

export type FabricSlice = FabricActions;

// ID generators - will be set from main store
let generateNodeId: () => string = () => `node-${Date.now()}`;
let generateEdgeId: () => string = () => `edge-${Date.now()}`;

export const setFabricIdGenerators = (nodeFn: () => string, edgeFn: () => string) => {
  generateNodeId = nodeFn;
  generateEdgeId = edgeFn;
};

const ROLE_LABEL = 'eda.nokia.com/role';
const SECURITY_LABEL = 'eda.nokia.com/security-profile';
const NAME_PREFIX_ANNOTATION = 'topobuilder.eda.labs/name-prefix';

const sameComponents = (a?: Component[], b?: Component[]): boolean =>
  JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

/**
 * Existing template with this role and hardware, or a freshly built one (returned in
 * `created`) named after the role ("spine", "spine2", …).
 */
function resolveTemplate(
  role: 'spine' | 'leaf',
  tier: FabricTierConfig,
  templates: NodeTemplate[],
  created: NodeTemplate[],
): string {
  const pool = [...templates, ...created];
  const existing = pool.find(t =>
    t.labels?.[ROLE_LABEL] === role && t.platform === tier.platform && sameComponents(t.components, tier.components));
  if (existing) return existing.name;

  const names = new Set(pool.map(t => t.name));
  let uniqueName: string = role;
  for (let i = 2; names.has(uniqueName); i++) uniqueName = `${role}-${i}`;
  const sros = osOfPlatform(tier.platform) === 'sros';
  created.push({
    name: uniqueName,
    platform: tier.platform,
    components: tier.components?.length ? tier.components : undefined,
    nodeProfile: sros ? DEFAULT_NODE_PROFILE_SROS : DEFAULT_NODE_PROFILE_SRL,
    labels: { [ROLE_LABEL]: role, [SECURITY_LABEL]: 'managed' },
    annotations: { [NAME_PREFIX_ANNOTATION]: role },
  });
  return uniqueName;
}

/** Free interfaces of a tier platform, in faceplate port order. */
export function fabricPortCapacity(tier: Pick<FabricTierConfig, 'platform' | 'components'>): number {
  const stencil = resolveFrontPanel(tier.platform, tier.components);
  const meta = stencil ? frontPanelMetaOf(stencil) : undefined;
  return meta?.layout.length ?? 0;
}

function tierInterfaces(tier: FabricTierConfig, needed: number): string[] | null {
  const stencil = resolveFrontPanel(tier.platform, tier.components);
  const meta = stencil ? frontPanelMetaOf(stencil) : undefined;
  if (!meta?.layout.length) return null;
  const sros = osOfPlatform(tier.platform) === 'sros';
  const interfaces: string[] = [];
  for (const pos of meta.layout) {
    if (interfaces.length >= needed) break;
    const iface = interfaceForCage(pos.p, { sros, components: tier.components, usedInterfaces: interfaces });
    if (iface) interfaces.push(iface);
  }
  return interfaces.length >= needed ? interfaces : null;
}

function nodeSpacing(tier: FabricTierConfig): number {
  const stencil = resolveFrontPanel(tier.platform, tier.components);
  const meta = stencil ? frontPanelMetaOf(stencil) : undefined;
  const width = meta ? frontPanelNodeSize(meta).width : 220;
  return width + 100;
}

export type FabricSliceCreator = StateCreator<
  FabricSlice & {
    nodes: UINode[];
    edges: UIEdge[];
    nodeTemplates: NodeTemplate[];
    linkTemplates: LinkTemplate[];
    schemaVersion: number;
    selectedNodeId: string | null;
    selectedEdgeId: string | null;
    selectedSimNodeName: string | null;
    triggerYamlRefresh: () => void;
    setError: (error: string | null) => void;
    saveToUndoHistory: () => void;
  },
  [],
  [],
  FabricSlice
>;

export const createFabricSlice: FabricSliceCreator = (set, get) => ({
  addFabric: (config: FabricConfig): boolean => {
    const state = get();
    const { spines, leaves } = config;
    const uplinks = Math.max(1, config.uplinksPerPair);

    const spineIfaces = tierInterfaces(spines, leaves.count * uplinks);
    const leafIfaces = tierInterfaces(leaves, spines.count * uplinks);
    if (!spineIfaces) {
      state.setError(`${spines.platform} has fewer than ${leaves.count * uplinks} ports for leaf downlinks`);
      return false;
    }
    if (!leafIfaces) {
      state.setError(`${leaves.platform} has fewer than ${spines.count * uplinks} ports for spine uplinks`);
      return false;
    }

    const enums = getSchemaEnums(state.schemaVersion);
    const islTemplate = state.linkTemplates.find(t => t.type === enums.edgeLinkType)?.name;
    if (!islTemplate) {
      state.setError('No inter-switch link template defined');
      return false;
    }

    state.saveToUndoHistory();

    const createdTemplates: NodeTemplate[] = [];
    const spineTemplate = resolveTemplate('spine', spines, state.nodeTemplates, createdTemplates);
    const leafTemplate = resolveTemplate('leaf', leaves, state.nodeTemplates, createdTemplates);

    // New fabric lands below everything already on the canvas.
    const topoNodes = state.nodes;
    const baseY = topoNodes.length
      ? Math.max(...topoNodes.map(n => n.position.y)) + 500
      : 60;
    const baseX = 60;

    const leafSpacing = nodeSpacing(leaves);
    const spineSpacing = nodeSpacing(spines);
    const leavesWidth = (leaves.count - 1) * leafSpacing;
    const spinesWidth = (spines.count - 1) * spineSpacing;
    const spineX = baseX + Math.max(0, (leavesWidth - spinesWidth) / 2);

    const allNames = state.nodes.map(n => n.data.name);
    const buildNodes = (tier: FabricTierConfig, template: string, prefix: string, x0: number, spacing: number, y: number): UINode[] =>
      Array.from({ length: tier.count }, (_, i) => {
        const id = generateNodeId();
        const name = generateUniqueName(prefix, allNames, 1);
        allNames.push(name);
        return {
          id,
          type: 'topoNode' as const,
          position: { x: x0 + i * spacing, y },
          selected: false,
          data: { id, name, template },
        };
      });

    const spineNodes = buildNodes(spines, spineTemplate, 'spine', spineX, spineSpacing, baseY);
    const leafNodes = buildNodes(leaves, leafTemplate, 'leaf', baseX, leafSpacing, baseY + 460);

    // Leaf i uplink to spine j: leaf ports fill in spine order, spine ports in leaf order —
    // the deterministic wiring the validated designs use (leaf1:e1-1 ↔ spine1:e1-1, …).
    const newEdges: UIEdge[] = [];
    leafNodes.forEach((leaf, leafIndex) => {
      spineNodes.forEach((spine, spineIndex) => {
        const id = generateEdgeId();
        const memberLinks = Array.from({ length: uplinks }, (_, k) => ({
          name: `${spine.data.name}-${leaf.data.name}-${k + 1}`,
          template: islTemplate,
          sourceInterface: leafIfaces[spineIndex * uplinks + k],
          targetInterface: spineIfaces[leafIndex * uplinks + k],
        }));
        newEdges.push({
          id,
          type: 'linkEdge',
          source: leaf.id,
          target: spine.id,
          sourceHandle: null,
          targetHandle: null,
          selected: false,
          data: {
            id,
            sourceNode: leaf.data.name,
            targetNode: spine.data.name,
            edgeType: 'normal',
            memberLinks,
          },
        });
      });
    });

    set({
      nodes: [...state.nodes.map(n => ({ ...n, selected: false })), ...spineNodes, ...leafNodes],
      edges: [...state.edges.map(e => ({ ...e, selected: false })), ...newEdges],
      nodeTemplates: [...state.nodeTemplates, ...createdTemplates],
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedSimNodeName: null,
    } as Partial<FabricSlice>);
    get().triggerYamlRefresh();
    return true;
  },
});
