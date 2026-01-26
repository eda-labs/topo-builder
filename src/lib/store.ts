import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import yaml from 'js-yaml';
import baseTemplateYaml from '../static/base-template.yaml?raw';
import { LABEL_POS_X, LABEL_POS_Y, LABEL_SRC_HANDLE, LABEL_DST_HANDLE } from './constants';
import type {
  TopologyNodeData,
  TopologyEdgeData,
  TopologyState,
  NodeTemplate,
  LinkTemplate,
  MemberLink,
  Operation,
  SimNodeTemplate,
  SimNode,
  Simulation,
} from '../types/topology';

// Types for YAML parsing
interface ParsedYamlNode {
  name: string;
  platform?: string;
  nodeProfile?: string;
  template?: string;
  labels?: Record<string, string>;
}

interface ParsedYamlLink {
  name?: string;
  encapType?: string;
  template?: string;
  labels?: Record<string, string>;
  endpoints?: Array<{
    local?: { node: string; interface?: string };
    remote?: { node: string; interface?: string };
    sim?: { simNode?: string; simNodeInterface?: string; node?: string; interface?: string };
    type?: string;
  }>;
}

interface ParsedYaml {
  metadata?: {
    name?: string;
    namespace?: string;
  };
  spec?: {
    operation?: Operation;
    nodeTemplates?: NodeTemplate[];
    linkTemplates?: LinkTemplate[];
    nodes?: ParsedYamlNode[];
    links?: ParsedYamlLink[];
    simulation?: unknown;
  };
}

interface TopologyActions {
  setError: (error: string | null) => void;

  // Metadata actions
  setTopologyName: (name: string) => void;
  setNamespace: (namespace: string) => void;
  setOperation: (operation: Operation) => void;

  // Node actions
  addNode: (position: { x: number; y: number }, templateName?: string) => void;
  updateNode: (id: string, data: Partial<TopologyNodeData>) => void;
  deleteNode: (id: string) => void;
  onNodesChange: (changes: NodeChange<Node<TopologyNodeData>>[]) => void;

  // Edge actions
  addEdge: (connection: Connection) => void;
  updateEdge: (id: string, data: Partial<TopologyEdgeData>) => void;
  deleteEdge: (id: string) => void;
  onEdgesChange: (changes: EdgeChange<Edge<TopologyEdgeData>>[]) => void;
  onConnect: (connection: Connection) => void;

  // Member link actions
  addMemberLink: (edgeId: string, link: MemberLink) => void;
  updateMemberLink: (edgeId: string, index: number, link: Partial<MemberLink>) => void;
  deleteMemberLink: (edgeId: string, index: number) => void;

  // Template actions
  addNodeTemplate: (template: NodeTemplate) => boolean;
  updateNodeTemplate: (name: string, template: Partial<NodeTemplate>) => boolean;
  deleteNodeTemplate: (name: string) => void;
  addLinkTemplate: (template: LinkTemplate) => boolean;
  updateLinkTemplate: (name: string, template: Partial<LinkTemplate>) => boolean;
  deleteLinkTemplate: (name: string) => void;

  // Simulation actions
  addSimNodeTemplate: (template: SimNodeTemplate) => boolean;
  updateSimNodeTemplate: (name: string, template: Partial<SimNodeTemplate>) => boolean;
  deleteSimNodeTemplate: (name: string) => void;
  addSimNode: (simNode: Omit<SimNode, 'id'>) => void;
  updateSimNode: (name: string, simNode: Partial<SimNode>) => void;
  deleteSimNode: (name: string) => void;

  // Selection actions
  selectNode: (id: string | null, addToSelection?: boolean) => void;
  selectEdge: (id: string | null, addToSelection?: boolean) => void;
  selectSimNode: (name: string | null) => void;
  selectSimNodes: (names: Set<string>) => void;
  selectMemberLink: (edgeId: string, index: number | null, addToSelection?: boolean) => void;
  selectLag: (edgeId: string, lagId: string | null) => void;
  clearMemberLinkSelection: () => void;
  clearEdgeSelection: () => void;

  createLagFromMemberLinks: (edgeId: string, memberLinkIndices: number[]) => void;
  createMultihomedLag: (edgeId1: string, edgeId2: string, additionalEdgeIds?: string[]) => void;
  addLinkToLag: (edgeId: string, lagId: string) => void;
  removeLinkFromLag: (edgeId: string, lagId: string, memberLinkIndex: number) => void;
  addLinkToEsiLag: (edgeId: string) => void;
  removeLinkFromEsiLag: (edgeId: string, leafIndex: number) => void;
  mergeEdgesIntoEsiLag: (esiLagId: string, edgeIds: string[]) => void;

  toggleEdgeExpanded: (edgeId: string) => void;
  toggleAllEdgesExpanded: () => void;

  // Import from YAML
  importFromYaml: (yaml: string) => boolean;

  // Clear all
  clearAll: () => void;

  // Trigger YAML refresh
  triggerYamlRefresh: () => void;

  // Dark mode
  setDarkMode: (darkMode: boolean) => void;

  // Sim node visibility
  setShowSimNodes: (show: boolean) => void;

  // Update sim node position
  updateSimNodePosition: (name: string, position: { x: number; y: number }) => void;

  // Paste selection
  pasteSelection: (
    copiedNodes: Node<TopologyNodeData>[],
    copiedEdges: Edge<TopologyEdgeData>[],
    offset: { x: number; y: number }
  ) => void;
}

type TopologyStore = TopologyState & TopologyActions;

// Generate unique IDs
let nodeIdCounter = 1;
let edgeIdCounter = 1;
let simNodeIdCounter = 1;

const generateNodeId = () => `node-${nodeIdCounter++}`;
const generateEdgeId = () => `edge-${edgeIdCounter++}`;
const generateSimNodeId = () => `sim-${simNodeIdCounter++}`;

// Stable empty Set to avoid unnecessary re-renders
const EMPTY_STRING_SET: Set<string> = new Set<string>();

// Parse base template from YAML file
function parseBaseTemplate(): Partial<TopologyState> {
  try {
    const parsed = yaml.load(baseTemplateYaml) as ParsedYaml;
    return {
      topologyName: parsed.metadata?.name || 'my-topology',
      namespace: parsed.metadata?.namespace || 'eda',
      operation: (parsed.spec?.operation as Operation) || 'replaceAll',
      nodeTemplates: (parsed.spec?.nodeTemplates || []) as NodeTemplate[],
      linkTemplates: (parsed.spec?.linkTemplates || []) as LinkTemplate[],
      simulation: {
        simNodeTemplates: ((parsed.spec?.simulation as Simulation)?.simNodeTemplates || []) as SimNodeTemplate[],
        simNodes: [],
      },
    };
  } catch (e) {
    console.error('Failed to parse base template:', e);
    return {};
  }
}

const baseTemplate = parseBaseTemplate();

// Default initial state
const initialState: TopologyState = {
  topologyName: baseTemplate.topologyName || 'my-topology',
  namespace: baseTemplate.namespace || 'eda',
  operation: baseTemplate.operation || 'replaceAll',
  nodeTemplates: baseTemplate.nodeTemplates || [],
  linkTemplates: baseTemplate.linkTemplates || [],
  nodes: [],
  edges: [],
  simulation: baseTemplate.simulation || {
    simNodeTemplates: [],
    simNodes: [],
  },
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedEdgeIds: [],
  selectedSimNodeName: null,
  selectedSimNodeNames: EMPTY_STRING_SET,
  expandedEdges: new Set<string>(),
  selectedMemberLinkIndices: [],
  selectedLagId: null,
  yamlRefreshCounter: 0,
  layoutVersion: 0,
  darkMode: true,
  showSimNodes: true,
  error: null,
};

export const useTopologyStore = create<TopologyStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setError: (error: string | null) => set({ error }),

      // Metadata actions
      setTopologyName: (name: string) => set({ topologyName: name }),
      setNamespace: (namespace: string) => set({ namespace }),
      setOperation: (operation: Operation) => set({ operation }),

      // Node actions
      addNode: (position: { x: number; y: number }, templateName?: string) => {
        const id = generateNodeId();
        const allNodeNames = get().nodes.map(n => n.data.name);
        const allSimNodeNames = get().simulation.simNodes.map(n => n.name);
        const allNames = [...allNodeNames, ...allSimNodeNames];

        let counter = get().nodes.length + 1;
        let name = `node-${counter}`;
        while (allNames.includes(name)) {
          counter++;
          name = `node-${counter}`;
        }

        // Use provided template name, or fall back to first template
        const template = templateName || get().nodeTemplates[0]?.name;
        const newNode: Node<TopologyNodeData> = {
          id,
          type: 'deviceNode',
          position,
          selected: true,
          data: {
            id,
            name,
            template,
            isNew: true,
          },
        };
        const deselectedNodes = get().nodes.map(n => ({ ...n, selected: false }));
        const deselectedEdges = get().edges.map(e => ({ ...e, selected: false }));
        set({
          nodes: [...deselectedNodes, newNode],
          edges: deselectedEdges,
          selectedNodeId: id,
          selectedEdgeId: null,
          selectedSimNodeName: null,
        });
        get().triggerYamlRefresh();
      },

      updateNode: (id: string, data: Partial<TopologyNodeData>) => {
        const currentNode = get().nodes.find(n => n.id === id);
        const oldName = currentNode?.data.name;
        const newName = data.name;

        if (newName && newName !== oldName) {
          const allNodeNames = get().nodes.filter(n => n.id !== id).map(n => n.data.name);
          const allSimNodeNames = get().simulation.simNodes.map(n => n.name);
          if (allNodeNames.includes(newName) || allSimNodeNames.includes(newName)) {
            get().setError(`Node name "${newName}" already exists`);
            return;
          }
        }

        let updatedEdges = get().edges;
        if (newName && oldName && newName !== oldName) {
          updatedEdges = updatedEdges.map(edge => {
            const needsSourceUpdate = edge.source === id;
            const needsTargetUpdate = edge.target === id;
            const isEsiLeaf = edge.data?.esiLeaves?.some(leaf => leaf.nodeId === id);

            if (!needsSourceUpdate && !needsTargetUpdate && !isEsiLeaf) return edge;

            const updatedMemberLinks = edge.data?.memberLinks?.map(link => ({
              ...link,
              name: link.name.replace(new RegExp(`(^|-)${oldName}(-|$)`, 'g'), `$1${newName}$2`),
            }));

            const updatedEsiLeaves = edge.data?.esiLeaves?.map(leaf =>
              leaf.nodeId === id ? { ...leaf, nodeName: newName } : leaf
            );

            const updatedLagGroups = edge.data?.lagGroups?.map(lag => ({
              ...lag,
              name: lag.name.replace(new RegExp(`(^|-)${oldName}(-|$)`, 'g'), `$1${newName}$2`),
            }));

            return {
              ...edge,
              data: edge.data ? {
                ...edge.data,
                sourceNode: needsSourceUpdate ? newName : edge.data.sourceNode,
                targetNode: needsTargetUpdate ? newName : edge.data.targetNode,
                memberLinks: updatedMemberLinks,
                esiLeaves: updatedEsiLeaves,
                lagGroups: updatedLagGroups,
              } : edge.data,
            };
          });
        }

        set({
          edges: updatedEdges,
          nodes: get().nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, ...data } }
              : node
          ),
        });
      },

      deleteNode: (id: string) => {
        set({
          nodes: get().nodes.filter((node) => node.id !== id),
          edges: get().edges.filter(
            (edge) => edge.source !== id && edge.target !== id
          ),
          selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
        });
        get().triggerYamlRefresh();
      },

      onNodesChange: (changes: NodeChange<Node<TopologyNodeData>>[]) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
        // Trigger YAML refresh if any nodes were removed or position drag ended
        const hasRemove = changes.some(c => c.type === 'remove');
        const hasDragEnd = changes.some(c => c.type === 'position' && c.dragging === false);
        if (hasRemove || hasDragEnd) {
          get().triggerYamlRefresh();
        }
      },

      // Edge actions
      addEdge: (connection: Connection) => {
        const nodes = get().nodes;
        const edges = get().edges;
        const simNodes = get().simulation.simNodes;
        const linkTemplates = get().linkTemplates;
        const sourceNode = nodes.find(n => n.id === connection.source)?.data.name ||
          simNodes.find(n => n.id === connection.source)?.name || connection.source!;
        const targetNode = nodes.find(n => n.id === connection.target)?.data.name ||
          simNodes.find(n => n.id === connection.target)?.name || connection.target!;

        const sourceIsSimNode = connection.source?.startsWith('sim-');
        const targetIsSimNode = connection.target?.startsWith('sim-');
        const isSimNodeConnection = sourceIsSimNode || targetIsSimNode;
        const defaultTemplate = isSimNodeConnection
          ? linkTemplates.find(t => t.type === 'edge')?.name || 'edge'
          : 'isl';

        const handlesMatch = (edge: Edge<TopologyEdgeData>, conn: Connection, reversed: boolean) => {
          if (!reversed) {
            return edge.sourceHandle === conn.sourceHandle && edge.targetHandle === conn.targetHandle;
          }
          const connTargetAsSource = conn.targetHandle?.replace('-target', '') || null;
          const connSourceAsTarget = conn.sourceHandle ? `${conn.sourceHandle}-target` : null;
          return edge.sourceHandle === connTargetAsSource && edge.targetHandle === connSourceAsTarget;
        };

        const existingEdge = edges.find(e => {
          if (e.data?.isMultihomed) return false; // Don't add member links to ESI-LAG edges

          const sameDirection = e.source === connection.source && e.target === connection.target;
          const reversedDirection = e.source === connection.target && e.target === connection.source;

          if (sameDirection) return handlesMatch(e, connection, false);
          if (reversedDirection) return handlesMatch(e, connection, true);
          return false;
        });

        const extractPortNumber = (iface: string): number => {
          const ethernetMatch = iface.match(/ethernet-1-(\d+)/);
          if (ethernetMatch) return parseInt(ethernetMatch[1], 10);
          return 0;
        };

        // Find highest port number used by source node
        const sourcePortNumbers = edges.flatMap(e => {
          if (e.source === connection.source) {
            return e.data?.memberLinks?.map(ml => extractPortNumber(ml.sourceInterface)) || [];
          }
          if (e.target === connection.source) {
            return e.data?.memberLinks?.map(ml => extractPortNumber(ml.targetInterface)) || [];
          }
          return [];
        });
        const nextSourcePort = Math.max(0, ...sourcePortNumbers) + 1;

        // Find highest port number used by target node
        const targetPortNumbers = edges.flatMap(e => {
          if (e.source === connection.target) {
            return e.data?.memberLinks?.map(ml => extractPortNumber(ml.sourceInterface)) || [];
          }
          if (e.target === connection.target) {
            return e.data?.memberLinks?.map(ml => extractPortNumber(ml.targetInterface)) || [];
          }
          return [];
        });
        const nextTargetPort = Math.max(0, ...targetPortNumbers) + 1;

        const sourceInterface = sourceIsSimNode ? `ethernet-1-${nextSourcePort}` : `ethernet-1-${nextSourcePort}`;
        const targetInterface = targetIsSimNode ? `ethernet-1-${nextTargetPort}` : `ethernet-1-${nextTargetPort}`;

        const sortedPair = [sourceNode, targetNode].sort().join('-');
        const allLinksForPair = edges.flatMap(e => {
          const edgePair = [e.data?.sourceNode, e.data?.targetNode].sort().join('-');
          if (edgePair === sortedPair) {
            return e.data?.memberLinks || [];
          }
          return [];
        });
        const nextLinkNumber = allLinksForPair.length + 1;

        if (existingEdge && existingEdge.data) {
          const existingMemberLinks = existingEdge.data.memberLinks || [];
          const newMemberLink: MemberLink = {
            name: `${targetNode}-${sourceNode}-${nextLinkNumber}`,
            template: defaultTemplate,
            sourceInterface,
            targetInterface,
          };
          const updatedEdges = edges.map(e =>
            e.id === existingEdge.id
              ? {
                  ...e,
                  selected: true,
                  data: {
                    ...e.data,
                    memberLinks: [...existingMemberLinks, newMemberLink],
                  } as TopologyEdgeData,
                }
              : { ...e, selected: false }
          );
          const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
          set({
            nodes: deselectedNodes,
            edges: updatedEdges,
            selectedEdgeId: existingEdge.id,
            selectedNodeId: null,
            selectedSimNodeName: null,
            selectedMemberLinkIndices: [existingMemberLinks.length], // Select the newly added link
          });
          get().triggerYamlRefresh();
          return;
        }

        const id = generateEdgeId();
        const newEdge: Edge<TopologyEdgeData> = {
          id,
          type: 'linkEdge',
          source: connection.source!,
          target: connection.target!,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          selected: true,
          data: {
            id,
            sourceNode,
            targetNode,
            memberLinks: [{
              name: `${targetNode}-${sourceNode}-${nextLinkNumber}`,
              template: defaultTemplate,
              sourceInterface,
              targetInterface,
            }],
          },
        };
        const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
        const deselectedEdges = edges.map(e => ({ ...e, selected: false }));
        set({
          nodes: deselectedNodes,
          edges: [...deselectedEdges, newEdge],
          selectedEdgeId: id,
          selectedNodeId: null,
          selectedSimNodeName: null,
          selectedMemberLinkIndices: [],
          selectedLagId: null,
        });
        sessionStorage.setItem('topology-new-link-id', id);
        get().triggerYamlRefresh();
      },

      updateEdge: (id: string, data: Partial<TopologyEdgeData>) => {
        set({
          edges: get().edges.map((edge) =>
            edge.id === id
              ? { ...edge, data: { ...edge.data, ...data } as TopologyEdgeData }
              : edge
          ),
        });
      },

      deleteEdge: (id: string) => {
        const newExpandedEdges = new Set(get().expandedEdges);
        newExpandedEdges.delete(id);
        set({
          edges: get().edges.filter((edge) => edge.id !== id),
          selectedEdgeId: get().selectedEdgeId === id ? null : get().selectedEdgeId,
          selectedMemberLinkIndices: get().selectedEdgeId === id ? [] : get().selectedMemberLinkIndices,
          expandedEdges: newExpandedEdges,
        });
        get().triggerYamlRefresh();
      },

      // Member link actions
      addMemberLink: (edgeId: string, link: MemberLink) => {
        set({
          edges: get().edges.map((edge) =>
            edge.id === edgeId
              ? {
                ...edge,
                data: {
                  ...edge.data,
                  memberLinks: [...(edge.data?.memberLinks || []), link],
                } as TopologyEdgeData,
              }
              : edge
          ),
        });
      },

      updateMemberLink: (edgeId: string, index: number, link: Partial<MemberLink>) => {
        set({
          edges: get().edges.map((edge) =>
            edge.id === edgeId
              ? {
                ...edge,
                data: {
                  ...edge.data,
                  memberLinks: edge.data?.memberLinks?.map((m, i) =>
                    i === index ? { ...m, ...link } : m
                  ) || [],
                } as TopologyEdgeData,
              }
              : edge
          ),
        });
      },

      deleteMemberLink: (edgeId: string, index: number) => {
        set({
          edges: get().edges.map((edge) =>
            edge.id === edgeId
              ? {
                ...edge,
                data: {
                  ...edge.data,
                  memberLinks: edge.data?.memberLinks?.filter((_, i) => i !== index) || [],
                } as TopologyEdgeData,
              }
              : edge
          ),
        });
      },

      onEdgesChange: (changes: EdgeChange<Edge<TopologyEdgeData>>[]) => {
        const currentEdges = get().edges;
        const esiLagEdgeIds = new Set(currentEdges.filter(e => e.data?.isMultihomed).map(e => e.id));

        const nonSelectChanges = changes.filter(c => {
          if (c.type === 'select') return false;
          if (c.type === 'remove' && esiLagEdgeIds.has(c.id)) return false;
          return true;
        });

        if (nonSelectChanges.length > 0) {
          set({
            edges: applyEdgeChanges(nonSelectChanges, get().edges),
          });
          if (nonSelectChanges.some(c => c.type === 'remove')) {
            get().triggerYamlRefresh();
          }
        }
      },

      onConnect: (connection: Connection) => {
        get().addEdge(connection);
      },

      // Template actions
      addNodeTemplate: (template: NodeTemplate) => {
        const existingNames = get().nodeTemplates.map(t => t.name);
        if (existingNames.includes(template.name)) {
          get().setError(`Node template "${template.name}" already exists`);
          return false;
        }
        set({ nodeTemplates: [...get().nodeTemplates, template] });
        return true;
      },

      updateNodeTemplate: (name: string, template: Partial<NodeTemplate>) => {
        if (template.name && template.name !== name) {
          const existingNames = get().nodeTemplates.filter(t => t.name !== name).map(t => t.name);
          if (existingNames.includes(template.name)) {
            get().setError(`Node template "${template.name}" already exists`);
            return false;
          }
        }
        const current = get();
        set({
          nodeTemplates: current.nodeTemplates.map((t) =>
            t.name === name ? { ...t, ...template } : t
          ),
          // Sync YAML
          yamlRefreshCounter: current.yamlRefreshCounter + 1,
        });
        return true;
      },

      deleteNodeTemplate: (name: string) => {
        set({
          nodeTemplates: get().nodeTemplates.filter((t) => t.name !== name),
        });
      },

      addLinkTemplate: (template: LinkTemplate) => {
        const existingNames = get().linkTemplates.map(t => t.name);
        if (existingNames.includes(template.name)) {
          get().setError(`Link template "${template.name}" already exists`);
          return false;
        }
        set({ linkTemplates: [...get().linkTemplates, template] });
        return true;
      },

      updateLinkTemplate: (name: string, template: Partial<LinkTemplate>) => {
        if (template.name && template.name !== name) {
          const existingNames = get().linkTemplates.filter(t => t.name !== name).map(t => t.name);
          if (existingNames.includes(template.name)) {
            get().setError(`Link template "${template.name}" already exists`);
            return false;
          }
        }
        set({
          linkTemplates: get().linkTemplates.map((t) =>
            t.name === name ? { ...t, ...template } : t
          ),
        });
        return true;
      },

      deleteLinkTemplate: (name: string) => {
        set({
          linkTemplates: get().linkTemplates.filter((t) => t.name !== name),
        });
      },

      // Simulation actions
      addSimNodeTemplate: (template: SimNodeTemplate) => {
        const existingNames = get().simulation.simNodeTemplates.map(t => t.name);
        if (existingNames.includes(template.name)) {
          get().setError(`Sim node template "${template.name}" already exists`);
          return false;
        }
        set({
          simulation: {
            ...get().simulation,
            simNodeTemplates: [...get().simulation.simNodeTemplates, template],
          },
        });
        get().triggerYamlRefresh();
        return true;
      },

      updateSimNodeTemplate: (name: string, template: Partial<SimNodeTemplate>) => {
        if (template.name && template.name !== name) {
          const existingNames = get().simulation.simNodeTemplates.filter(t => t.name !== name).map(t => t.name);
          if (existingNames.includes(template.name)) {
            get().setError(`Sim node template "${template.name}" already exists`);
            return false;
          }
        }
        set({
          simulation: {
            ...get().simulation,
            simNodeTemplates: get().simulation.simNodeTemplates.map((t) =>
              t.name === name ? { ...t, ...template } : t
            ),
          },
        });
        get().triggerYamlRefresh();
        return true;
      },

      deleteSimNodeTemplate: (name: string) => {
        set({
          simulation: {
            ...get().simulation,
            simNodeTemplates: get().simulation.simNodeTemplates.filter((t) => t.name !== name),
          },
        });
        get().triggerYamlRefresh();
      },

      addSimNode: (simNodeData: Omit<SimNode, 'id'>) => {
        const allNodeNames = get().nodes.map(n => n.data.name);
        const allSimNodeNames = get().simulation.simNodes.map(n => n.name);
        if (allNodeNames.includes(simNodeData.name) || allSimNodeNames.includes(simNodeData.name)) {
          get().setError(`Node name "${simNodeData.name}" already exists`);
          return;
        }
        const simNode: SimNode = {
          ...simNodeData,
          id: generateSimNodeId(),
          isNew: true,
        };
        const deselectedNodes = get().nodes.map(n => ({ ...n, selected: false }));
        const deselectedEdges = get().edges.map(e => ({ ...e, selected: false }));
        set({
          nodes: deselectedNodes,
          edges: deselectedEdges,
          simulation: {
            ...get().simulation,
            simNodes: [...get().simulation.simNodes, simNode],
          },
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedSimNodeName: simNode.name,
        });
        get().triggerYamlRefresh();
      },

      updateSimNode: (name: string, simNodeUpdate: Partial<SimNode>) => {
        const existingSimNode = get().simulation.simNodes.find(n => n.name === name);
        if (!existingSimNode) return;

        const stableId = existingSimNode.id;
        const newName = simNodeUpdate.name || name;

        if (simNodeUpdate.name && simNodeUpdate.name !== name) {
          const allNodeNames = get().nodes.map(n => n.data.name);
          const allSimNodeNames = get().simulation.simNodes.filter(n => n.name !== name).map(n => n.name);
          if (allNodeNames.includes(simNodeUpdate.name) || allSimNodeNames.includes(simNodeUpdate.name)) {
            get().setError(`Node name "${simNodeUpdate.name}" already exists`);
            return;
          }
        }

        let updatedEdges = get().edges;
        if (simNodeUpdate.name && simNodeUpdate.name !== name) {
          updatedEdges = updatedEdges.map(edge => {
            const needsSourceUpdate = edge.source === stableId;
            const needsTargetUpdate = edge.target === stableId;
            if (!needsSourceUpdate && !needsTargetUpdate) return edge;

            const updatedMemberLinks = edge.data?.memberLinks?.map(link => ({
              ...link,
              name: link.name.replace(new RegExp(`(^|-)${name}(-|$)`, 'g'), `$1${newName}$2`),
            }));

            const updatedLagGroups = edge.data?.lagGroups?.map(lag => ({
              ...lag,
              name: lag.name.replace(new RegExp(`(^|-)${name}(-|$)`, 'g'), `$1${newName}$2`),
            }));

            return {
              ...edge,
              data: edge.data ? {
                ...edge.data,
                sourceNode: needsSourceUpdate ? newName : edge.data.sourceNode,
                targetNode: needsTargetUpdate ? newName : edge.data.targetNode,
                memberLinks: updatedMemberLinks,
                lagGroups: updatedLagGroups,
              } : edge.data,
            };
          });
        }

        set({
          edges: updatedEdges,
          simulation: {
            ...get().simulation,
            simNodes: get().simulation.simNodes.map((n) =>
              n.name === name ? { ...n, ...simNodeUpdate } : n
            ),
          },
        });
        get().triggerYamlRefresh();
      },

      deleteSimNode: (name: string) => {
        const simNode = get().simulation.simNodes.find(n => n.name === name);
        if (!simNode) return;

        set({
          edges: get().edges.filter(
            (edge) => edge.source !== simNode.id && edge.target !== simNode.id
          ),
          simulation: {
            ...get().simulation,
            simNodes: get().simulation.simNodes.filter((n) => n.name !== name),
          },
          selectedSimNodeName: get().selectedSimNodeName === name ? null : get().selectedSimNodeName,
        });
        get().triggerYamlRefresh();
      },

      // Selection actions
      selectNode: (id: string | null, addToSelection?: boolean) => {
        if (id === null) {
          set({
            selectedNodeId: null,
            selectedEdgeId: null,
            selectedEdgeIds: [],
            selectedSimNodeName: null,
            selectedSimNodeNames: EMPTY_STRING_SET,
            selectedMemberLinkIndices: [],
          selectedLagId: null,
            nodes: get().nodes.map(n => ({ ...n, selected: false })),
            edges: get().edges.map(e => ({ ...e, selected: false })),
          });
          return;
        }

        if (addToSelection) {
          const currentNode = get().nodes.find(n => n.id === id);
          const isCurrentlySelected = currentNode?.selected || false;
          set({
            selectedNodeId: isCurrentlySelected ? null : id,
            selectedEdgeId: null,
            selectedEdgeIds: [],
            selectedSimNodeName: null,
            selectedSimNodeNames: EMPTY_STRING_SET,
            selectedMemberLinkIndices: [],
          selectedLagId: null,
            nodes: get().nodes.map(n =>
              n.id === id ? { ...n, selected: !isCurrentlySelected } : n
            ),
            edges: get().edges.map(e => ({ ...e, selected: false })),
          });
        } else {
          set({
            selectedNodeId: id,
            selectedEdgeId: null,
            selectedEdgeIds: [],
            selectedSimNodeName: null,
            selectedSimNodeNames: EMPTY_STRING_SET,
            selectedMemberLinkIndices: [],
          selectedLagId: null,
            nodes: get().nodes.map(n => ({ ...n, selected: n.id === id })),
            edges: get().edges.map(e => ({ ...e, selected: false })),
          });
        }
      },

      selectEdge: (id: string | null, addToSelection?: boolean) => {
        const currentIds = get().selectedEdgeIds;

        if (id === null) {
          set({
            selectedEdgeId: null,
            selectedEdgeIds: [],
            selectedNodeId: null,
            selectedSimNodeName: null,
            selectedSimNodeNames: EMPTY_STRING_SET,
            selectedMemberLinkIndices: [],
          selectedLagId: null,
            edges: get().edges.map(e => ({ ...e, selected: false })),
            nodes: get().nodes.map(n => ({ ...n, selected: false })),
          });
          return;
        }

        let newIds: string[];
        if (addToSelection) {
          if (currentIds.includes(id)) {
            newIds = currentIds.filter(i => i !== id);
          } else {
            newIds = [...currentIds, id];
          }
        } else {
          newIds = [id];
        }

        set({
          selectedEdgeId: newIds.length === 1 ? newIds[0] : (newIds.length > 0 ? newIds[newIds.length - 1] : null),
          selectedEdgeIds: newIds,
          selectedNodeId: null,
          selectedSimNodeName: null,
          selectedSimNodeNames: EMPTY_STRING_SET,
          selectedMemberLinkIndices: [],
          selectedLagId: null,
          edges: get().edges.map(e => ({ ...e, selected: newIds.includes(e.id) })),
          nodes: get().nodes.map(n => ({ ...n, selected: false })),
        });
      },

      clearEdgeSelection: () => {
        set({
          selectedEdgeId: null,
          selectedEdgeIds: [],
          selectedMemberLinkIndices: [],
          selectedLagId: null,
          edges: get().edges.map(e => ({ ...e, selected: false })),
        });
      },

      selectMemberLink: (edgeId: string, index: number | null, addToSelection?: boolean) => {
        const currentIndices = get().selectedMemberLinkIndices;
        const currentEdgeId = get().selectedEdgeId;

        let newIndices: number[];
        if (index === null) {
          newIndices = [];
        } else if (addToSelection && currentEdgeId === edgeId) {
          if (currentIndices.includes(index)) {
            newIndices = currentIndices.filter(i => i !== index);
          } else {
            newIndices = [...currentIndices, index].sort((a, b) => a - b);
          }
        } else {
          newIndices = [index];
        }

        set({
          selectedEdgeId: edgeId,
          selectedNodeId: null,
          selectedSimNodeName: null,
          selectedSimNodeNames: EMPTY_STRING_SET,
          selectedMemberLinkIndices: newIndices,
          selectedLagId: null,
          edges: get().edges.map(e => ({ ...e, selected: e.id === edgeId })),
          nodes: get().nodes.map(n => ({ ...n, selected: false })),
        });
      },

      selectLag: (edgeId: string, lagId: string | null) => {
        set({
          selectedEdgeId: edgeId,
          selectedNodeId: null,
          selectedSimNodeName: null,
          selectedSimNodeNames: EMPTY_STRING_SET,
          selectedMemberLinkIndices: [],
          selectedLagId: lagId,
          edges: get().edges.map(e => ({ ...e, selected: e.id === edgeId })),
          nodes: get().nodes.map(n => ({ ...n, selected: false })),
        });
      },

      clearMemberLinkSelection: () => {
        set({ selectedMemberLinkIndices: [], selectedLagId: null });
      },

      toggleEdgeExpanded: (edgeId: string) => {
        const current = get().expandedEdges;
        const newSet = new Set(current);
        if (newSet.has(edgeId)) {
          newSet.delete(edgeId);
        } else {
          newSet.add(edgeId);
        }
        set({ expandedEdges: newSet });
      },

      toggleAllEdgesExpanded: () => {
        const edges = get().edges;
        const current = get().expandedEdges;
        const multiLinkEdges = edges.filter(e => (e.data?.memberLinks?.length || 0) > 1);
        const anyExpanded = multiLinkEdges.some(e => current.has(e.id));
        if (anyExpanded) {
          set({ expandedEdges: new Set() });
        } else {
          set({ expandedEdges: new Set(multiLinkEdges.map(e => e.id)) });
        }
      },

      createLagFromMemberLinks: (edgeId: string, memberLinkIndices: number[]) => {
        const edges = get().edges;
        const sourceEdge = edges.find(e => e.id === edgeId);
        if (!sourceEdge || !sourceEdge.data?.memberLinks) return;

        const allMemberLinks = sourceEdge.data.memberLinks;
        const validIndices = memberLinkIndices
          .filter(i => i >= 0 && i < allMemberLinks.length)
          .sort((a, b) => a - b);

        if (validIndices.length < 2) return;

        const existingLagGroups = sourceEdge.data.lagGroups || [];
        const alreadyInLag = existingLagGroups.some(lag =>
          validIndices.some(idx => lag.memberLinkIndices.includes(idx))
        );
        if (alreadyInLag) return;

        const lagGroupCount = existingLagGroups.length + 1;
        const newLagGroup = {
          id: `lag-${edgeId}-${lagGroupCount}`,
          name: `${sourceEdge.data.targetNode}-${sourceEdge.data.sourceNode}-lag-${lagGroupCount}`,
          template: 'isl',
          memberLinkIndices: validIndices,
        };

        const updatedEdges = edges.map(e => {
          if (e.id === edgeId) {
            return {
              ...e,
              data: {
                ...e.data!,
                lagGroups: [...existingLagGroups, newLagGroup],
              },
            };
          }
          return e;
        });

        set({
          edges: updatedEdges,
          selectedMemberLinkIndices: [],
          selectedLagId: null,
        });
        get().triggerYamlRefresh();
      },

      addLinkToLag: (edgeId: string, lagId: string) => {
        const edges = get().edges;
        const edge = edges.find(e => e.id === edgeId);
        if (!edge || !edge.data) return;

        const lagGroups = edge.data.lagGroups || [];
        const lag = lagGroups.find(l => l.id === lagId);
        if (!lag) return;

        const memberLinks = edge.data.memberLinks || [];
        const lagMemberLinks = lag.memberLinkIndices.map(i => memberLinks[i]).filter(Boolean);
        const lastLagLink = lagMemberLinks[lagMemberLinks.length - 1];

        const incrementInterface = (iface: string) => {
          const match = iface.match(/^(.+?)(\d+)$/);
          if (match) {
            return `${match[1]}${parseInt(match[2], 10) + 1}`;
          }
          return `${iface}-${lagMemberLinks.length + 1}`;
        };

        const newLink: MemberLink = {
          name: `${lag.name}-${lag.memberLinkIndices.length + 1}`,
          template: lag.template || lastLagLink?.template,
          sourceInterface: incrementInterface(lastLagLink?.sourceInterface || 'ethernet-1-1'),
          targetInterface: incrementInterface(lastLagLink?.targetInterface || 'ethernet-1-1'),
        };

        const newMemberLinkIndex = memberLinks.length;

        const updatedEdges = edges.map(e => {
          if (e.id === edgeId) {
            return {
              ...e,
              data: {
                ...e.data!,
                memberLinks: [...memberLinks, newLink],
                lagGroups: lagGroups.map(l =>
                  l.id === lagId
                    ? { ...l, memberLinkIndices: [...l.memberLinkIndices, newMemberLinkIndex] }
                    : l
                ),
              },
            };
          }
          return e;
        });

        set({
          edges: updatedEdges,
          selectedLagId: lagId,
        });
        get().triggerYamlRefresh();
      },

      removeLinkFromLag: (edgeId: string, lagId: string, memberLinkIndex: number) => {
        const edges = get().edges;
        const edge = edges.find(e => e.id === edgeId);
        if (!edge || !edge.data) return;

        const lagGroups = edge.data.lagGroups || [];
        const lag = lagGroups.find(l => l.id === lagId);
        if (!lag) return;

        if (lag.memberLinkIndices.length <= 2) {
          const updatedEdges = edges.map(e => {
            if (e.id === edgeId) {
              return {
                ...e,
                data: {
                  ...e.data!,
                  lagGroups: lagGroups.filter(l => l.id !== lagId),
                },
              };
            }
            return e;
          });
          set({ edges: updatedEdges, selectedLagId: null });
        } else {
          const updatedEdges = edges.map(e => {
            if (e.id === edgeId) {
              return {
                ...e,
                data: {
                  ...e.data!,
                  lagGroups: lagGroups.map(l =>
                    l.id === lagId
                      ? { ...l, memberLinkIndices: l.memberLinkIndices.filter(i => i !== memberLinkIndex) }
                      : l
                  ),
                },
              };
            }
            return e;
          });
          set({ edges: updatedEdges, selectedLagId: lagId });
        }
        get().triggerYamlRefresh();
      },

      createMultihomedLag: (edgeId1: string, edgeId2: string, additionalEdgeIds?: string[]) => {
        const edges = get().edges;
        const nodes = get().nodes;
        const simNodes = get().simulation.simNodes || [];

        const allEdgeIds = [edgeId1, edgeId2, ...(additionalEdgeIds || [])];
        const selectedEdges = allEdgeIds
          .map(id => edges.find(e => e.id === id))
          .filter((e): e is Edge<TopologyEdgeData> => e !== undefined && e.data !== undefined);

        if (selectedEdges.length < 2 || selectedEdges.length > 4) {
          get().setError('ESI-LAG requires 2-4 edges');
          return;
        }

        const findNodeById = (id: string) => {
          const topoNode = nodes.find(n => n.id === id);
          if (topoNode) return { id, name: topoNode.data.name, isSimNode: false };
          const simNode = simNodes.find(s => s.id === id);
          if (simNode) return { id, name: simNode.name, isSimNode: true };
          return null;
        };

        const allNodes = selectedEdges.flatMap(e => [e.source, e.target]);
        const nodeCounts = new Map<string, number>();
        allNodes.forEach(n => nodeCounts.set(n, (nodeCounts.get(n) || 0) + 1));

        const commonNodeEntries = [...nodeCounts.entries()].filter(([_, count]) => count === selectedEdges.length);
        if (commonNodeEntries.length !== 1) {
          get().setError('Selected edges must all share exactly one common node');
          return;
        }

        const commonNodeId = commonNodeEntries[0][0];
        const commonNodeInfo = findNodeById(commonNodeId);
        if (!commonNodeInfo) {
          get().setError('Could not find common node');
          return;
        }

        const toSourceHandle = (handle: string | null | undefined): string => {
          if (!handle) return 'bottom';
          return handle.replace('-target', '');
        };
        const toTargetHandle = (handle: string | null | undefined): string => {
          if (!handle) return 'bottom-target';
          if (handle.endsWith('-target')) return handle;
          return handle + '-target';
        };

        const leafConnections: Array<{
          nodeId: string;
          nodeName: string;
          leafHandle: string;
          sourceHandle: string;
          memberLinks: MemberLink[];
        }> = [];

        for (const edge of selectedEdges) {
          const leafId = edge.source === commonNodeId ? edge.target : edge.source;
          const leafInfo = findNodeById(leafId);
          if (!leafInfo) {
            get().setError('Could not find all leaf nodes');
            return;
          }

          const sourceHandle = edge.source === commonNodeId
            ? (edge.sourceHandle || 'bottom')
            : toSourceHandle(edge.targetHandle);
          const leafHandle = edge.source === commonNodeId
            ? (edge.targetHandle || 'bottom-target')
            : toTargetHandle(edge.sourceHandle);

          leafConnections.push({
            nodeId: leafId,
            nodeName: leafInfo.name,
            leafHandle,
            sourceHandle,
            memberLinks: edge.data?.memberLinks || [],
          });
        }

        const firstLeaf = leafConnections[0];

        const allMemberLinks = leafConnections.flatMap(lc => lc.memberLinks);

        const newEdgeId = generateEdgeId();

        const esiLeaves = leafConnections.map(lc => ({
          nodeId: lc.nodeId,
          nodeName: lc.nodeName,
          leafHandle: lc.leafHandle,
          sourceHandle: lc.sourceHandle,
        }));

        const newEdge: Edge<TopologyEdgeData> = {
          id: newEdgeId,
          source: commonNodeId,
          target: firstLeaf.nodeId,
          sourceHandle: firstLeaf.sourceHandle,
          targetHandle: firstLeaf.leafHandle,
          type: 'linkEdge',
          data: {
            id: newEdgeId,
            sourceNode: commonNodeInfo.name,
            targetNode: firstLeaf.nodeName,
            memberLinks: allMemberLinks,
            isMultihomed: true,
            esiLeaves,
            esiLagName: `${commonNodeInfo.name}-esi-lag`,
          },
        };

        const edgeIdsToRemove = new Set(allEdgeIds);
        const filteredEdges = edges.filter(e => !edgeIdsToRemove.has(e.id));

        set({
          edges: [...filteredEdges, newEdge],
          selectedEdgeId: newEdgeId,
          selectedEdgeIds: [newEdgeId],
          selectedMemberLinkIndices: [],
          selectedLagId: null,
        });
        get().triggerYamlRefresh();
      },

      addLinkToEsiLag: (edgeId: string) => {
        const edges = get().edges;
        const edge = edges.find(e => e.id === edgeId);
        if (!edge || !edge.data?.isMultihomed || !edge.data.esiLeaves) return;

        const esiLeaves = edge.data.esiLeaves;
        const memberLinks = edge.data.memberLinks || [];

        if (esiLeaves.length >= 4) return;

        const lastLeaf = esiLeaves[esiLeaves.length - 1];
        const lastMemberLink = memberLinks[memberLinks.length - 1];

        const incrementInterface = (iface: string) => {
          const match = iface.match(/^(.+?)(\d+)$/);
          if (match) {
            return `${match[1]}${parseInt(match[2], 10) + 1}`;
          }
          return `${iface}-${esiLeaves.length + 1}`;
        };

        const newMemberLink: MemberLink = {
          name: `${edge.data.sourceNode}-${lastLeaf.nodeName}-${memberLinks.length + 1}`,
          sourceInterface: incrementInterface(lastMemberLink?.sourceInterface || 'ethernet-1-1'),
          targetInterface: incrementInterface(lastMemberLink?.targetInterface || 'ethernet-1-1'),
        };

        const newLeaf = {
          nodeId: lastLeaf.nodeId,
          nodeName: lastLeaf.nodeName,
          leafHandle: lastLeaf.leafHandle,
          sourceHandle: lastLeaf.sourceHandle,
        };

        const updatedEdges = edges.map(e => {
          if (e.id === edgeId) {
            return {
              ...e,
              data: {
                ...e.data!,
                memberLinks: [...memberLinks, newMemberLink],
                esiLeaves: [...esiLeaves, newLeaf],
              },
            };
          }
          return e;
        });

        set({ edges: updatedEdges });
        get().triggerYamlRefresh();
      },

      removeLinkFromEsiLag: (edgeId: string, leafIndex: number) => {
        const edges = get().edges;
        const edge = edges.find(e => e.id === edgeId);
        if (!edge || !edge.data?.isMultihomed || !edge.data.esiLeaves) return;

        const esiLeaves = edge.data.esiLeaves;
        const memberLinks = edge.data.memberLinks || [];

        if (esiLeaves.length <= 2) return;

        const updatedEdges = edges.map(e => {
          if (e.id === edgeId) {
            return {
              ...e,
              data: {
                ...e.data!,
                memberLinks: memberLinks.filter((_, i) => i !== leafIndex),
                esiLeaves: esiLeaves.filter((_, i) => i !== leafIndex),
              },
            };
          }
          return e;
        });

        set({ edges: updatedEdges });
        get().triggerYamlRefresh();
      },

      mergeEdgesIntoEsiLag: (esiLagId: string, edgeIds: string[]) => {
        const edges = get().edges;
        const nodes = get().nodes;
        const simNodes = get().simulation.simNodes || [];

        const esiLagEdge = edges.find(e => e.id === esiLagId);
        if (!esiLagEdge || !esiLagEdge.data?.isMultihomed || !esiLagEdge.data.esiLeaves) return;

        const edgesToMerge = edgeIds
          .map(id => edges.find(e => e.id === id))
          .filter((e): e is Edge<TopologyEdgeData> => e !== undefined && !e.data?.isMultihomed);

        if (edgesToMerge.length === 0) return;

        const currentLeaves = esiLagEdge.data.esiLeaves;
        const currentMemberLinks = esiLagEdge.data.memberLinks || [];

        if (currentLeaves.length + edgesToMerge.length > 4) {
          get().setError('ESI-LAG cannot have more than 4 links');
          return;
        }

        const commonNodeId = esiLagEdge.source;

        const findNodeById = (id: string) => {
          const topoNode = nodes.find(n => n.id === id);
          if (topoNode) return { id, name: topoNode.data.name, isSimNode: false };
          const simNode = simNodes.find(s => s.id === id);
          if (simNode) return { id, name: simNode.name, isSimNode: true };
          return null;
        };

        const toSourceHandle = (handle: string | null | undefined): string => {
          if (!handle) return 'bottom';
          return handle.replace('-target', '');
        };
        const toTargetHandle = (handle: string | null | undefined): string => {
          if (!handle) return 'bottom-target';
          if (handle.endsWith('-target')) return handle;
          return handle + '-target';
        };

        const newLeaves = [...currentLeaves];
        const newMemberLinks = [...currentMemberLinks];

        for (const edge of edgesToMerge) {
          const leafId = edge.source === commonNodeId ? edge.target : edge.source;
          const leafInfo = findNodeById(leafId);
          if (!leafInfo) continue;

          const sourceHandle = edge.source === commonNodeId
            ? (edge.sourceHandle || 'bottom')
            : toSourceHandle(edge.targetHandle);
          const leafHandle = edge.source === commonNodeId
            ? (edge.targetHandle || 'bottom-target')
            : toTargetHandle(edge.sourceHandle);

          newLeaves.push({
            nodeId: leafId,
            nodeName: leafInfo.name,
            leafHandle,
            sourceHandle,
          });

          const edgeMemberLinks = edge.data?.memberLinks || [];
          newMemberLinks.push(...edgeMemberLinks);
        }

        const edgeIdsToRemove = new Set(edgeIds);
        const filteredEdges = edges.filter(e => !edgeIdsToRemove.has(e.id));

        const updatedEdges = filteredEdges.map(e => {
          if (e.id === esiLagId) {
            return {
              ...e,
              data: {
                ...e.data!,
                memberLinks: newMemberLinks,
                esiLeaves: newLeaves,
              },
            };
          }
          return e;
        });

        set({
          edges: updatedEdges,
          selectedEdgeId: esiLagId,
          selectedEdgeIds: [esiLagId],
          selectedMemberLinkIndices: [],
          selectedLagId: null,
        });
        get().triggerYamlRefresh();
      },

      selectSimNode: (name: string | null) => {
        set({
          selectedSimNodeName: name,
          selectedSimNodeNames: name ? new Set([name]) : new Set<string>(),
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedEdgeIds: [],
          selectedMemberLinkIndices: [],
          selectedLagId: null,
          nodes: get().nodes.map(n => ({ ...n, selected: false })),
          edges: get().edges.map(e => ({ ...e, selected: false })),
        });
      },

      selectSimNodes: (names: Set<string>) => {
        set({
          selectedSimNodeNames: names,
          selectedSimNodeName: names.size === 1 ? [...names][0] : (names.size > 0 ? [...names][names.size - 1] : null),
        });
      },

      // Clear all
      clearAll: () => {
        nodeIdCounter = 1;
        edgeIdCounter = 1;
        const { darkMode, showSimNodes, yamlRefreshCounter } = get();
        set({ ...initialState, darkMode, showSimNodes, yamlRefreshCounter: yamlRefreshCounter + 1 });
      },

      triggerYamlRefresh: () => {
        set({ yamlRefreshCounter: get().yamlRefreshCounter + 1 });
      },

      setDarkMode: (darkMode: boolean) => {
        set({ darkMode });
      },

      setShowSimNodes: (show: boolean) => {
        set({ showSimNodes: show });
      },

      updateSimNodePosition: (name: string, position: { x: number; y: number }) => {
        set({
          simulation: {
            ...get().simulation,
            simNodes: get().simulation.simNodes.map((n) =>
              n.name === name ? { ...n, position } : n
            ),
          },
        });
      },

      pasteSelection: (
        copiedNodes: Node<TopologyNodeData>[],
        copiedEdges: Edge<TopologyEdgeData>[],
        offset: { x: number; y: number }
      ) => {
        if (copiedNodes.length === 0) return;

        const existingNodes = get().nodes;
        const existingEdges = get().edges;
        const allNodeNames = existingNodes.map(n => n.data.name);
        const allSimNodeNames = get().simulation.simNodes.map(n => n.name);
        const allNames = [...allNodeNames, ...allSimNodeNames];

        // Map old node IDs to new node IDs and names
        const idMap = new Map<string, string>();
        const nameMap = new Map<string, string>();

        // Create new nodes with new IDs and names
        const newNodes: Node<TopologyNodeData>[] = copiedNodes.map((node) => {
          const newId = generateNodeId();
          idMap.set(node.id, newId);

          // Generate unique name
          const baseName = node.data.name.replace(/-copy(-\d+)?$/, '');
          let newName = `${baseName}-copy`;
          let counter = 1;
          while (allNames.includes(newName)) {
            newName = `${baseName}-copy-${counter}`;
            counter++;
          }
          allNames.push(newName);
          nameMap.set(node.data.name, newName);

          return {
            ...node,
            id: newId,
            position: {
              x: node.position.x + offset.x,
              y: node.position.y + offset.y,
            },
            selected: true,
            data: {
              ...node.data,
              id: newId,
              name: newName,
            },
          };
        });

        // Create new edges that connect the copied nodes
        const newEdges: Edge<TopologyEdgeData>[] = copiedEdges
          .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
          .map((edge) => {
            const newId = generateEdgeId();
            const newSourceId = idMap.get(edge.source)!;
            const newTargetId = idMap.get(edge.target)!;
            const newSourceName = nameMap.get(edge.data?.sourceNode || '') || edge.data?.sourceNode;
            const newTargetName = nameMap.get(edge.data?.targetNode || '') || edge.data?.targetNode;

            // Update member link names
            const memberLinks = edge.data?.memberLinks?.map((link) => ({
              ...link,
              name: `${newTargetName}-${newSourceName}-${link.name.split('-').pop() || '1'}`,
            }));

            return {
              ...edge,
              id: newId,
              source: newSourceId,
              target: newTargetId,
              selected: true,
              data: edge.data ? {
                ...edge.data,
                id: newId,
                sourceNode: newSourceName || '',
                targetNode: newTargetName || '',
                memberLinks,
              } : undefined,
            };
          });

        // Deselect existing nodes and edges
        const deselectedNodes = existingNodes.map(n => ({ ...n, selected: false }));
        const deselectedEdges = existingEdges.map(e => ({ ...e, selected: false }));

        set({
          nodes: [...deselectedNodes, ...newNodes],
          edges: [...deselectedEdges, ...newEdges],
        });
        get().triggerYamlRefresh();
      },

      // Import from YAML
      importFromYaml: (yamlString: string): boolean => {
        try {
          // Handle empty YAML - reset to defaults
          const trimmed = yamlString.trim();
          if (!trimmed) {
            set({
              nodes: [],
              edges: [],
              nodeTemplates: initialState.nodeTemplates,
              linkTemplates: initialState.linkTemplates,
              simulation: {
                simNodeTemplates: baseTemplate.simulation?.simNodeTemplates || [],
                simNodes: [],
              },
            });
            return true;
          }

          const parsed = yaml.load(yamlString) as ParsedYaml | null;
          if (!parsed || typeof parsed !== 'object') return false;

          const currentNodes = get().nodes;
          const currentEdges = get().edges;
          const currentSimNodes = get().simulation.simNodes;

          // Pre-generate stable IDs for simNodes (used for edges and final simulation)
          const simNodeIdMap = new Map<string, string>();
          const simData = parsed.spec?.simulation as Simulation | undefined;
          if (simData?.simNodes) {
            simData.simNodes.forEach(sn => {
              const existing = currentSimNodes.find(n => n.name === sn.name);
              simNodeIdMap.set(sn.name, existing?.id || generateSimNodeId());
            });
          }

          // Update metadata
          const updates: Partial<TopologyState> = {};

          if (parsed.metadata?.name) {
            updates.topologyName = parsed.metadata.name;
          }
          if (parsed.metadata?.namespace) {
            updates.namespace = parsed.metadata.namespace;
          }
          if (parsed.spec?.operation) {
            updates.operation = parsed.spec.operation;
          }

          // Update templates
          const nodeTemplates: NodeTemplate[] = parsed.spec?.nodeTemplates || [];
          const linkTemplates: LinkTemplate[] = parsed.spec?.linkTemplates || [];
          updates.nodeTemplates = nodeTemplates;
          updates.linkTemplates = linkTemplates;

          // Build template lookup maps
          const nodeTemplateMap = new Map<string, NodeTemplate>();
          nodeTemplates.forEach((t) => nodeTemplateMap.set(t.name, t));
          const linkTemplateMap = new Map<string, LinkTemplate>();
          linkTemplates.forEach((t) => linkTemplateMap.set(t.name, t));

          // Parse nodes from YAML and update existing or create new
          if (parsed.spec?.nodes && Array.isArray(parsed.spec.nodes)) {
            const nodeNameToId = new Map<string, string>();
            currentNodes.forEach(n => nodeNameToId.set(n.data.name, n.id));

            const newNodes: Node<TopologyNodeData>[] = parsed.spec.nodes.map((node: ParsedYamlNode, index: number) => {
              const existingId = nodeNameToId.get(node.name);
              const existingNode = existingId ? currentNodes.find(n => n.id === existingId) : null;

              const id = existingId || `node-${nodeIdCounter++}`;

              let platform: string | undefined = node.platform;
              let nodeProfile: string | undefined = node.nodeProfile;

              // If node references a template, get properties from template
              if (node.template && nodeTemplateMap.has(node.template)) {
                const template = nodeTemplateMap.get(node.template)!;
                if (!platform && template.platform) platform = template.platform;
                if (!nodeProfile && template.nodeProfile) nodeProfile = template.nodeProfile;
              }

              // Get position from labels or fall back to existing/default
              const labelX = node.labels?.[LABEL_POS_X];
              const labelY = node.labels?.[LABEL_POS_Y];
              const positionFromLabels = labelX && labelY
                ? { x: parseFloat(labelX), y: parseFloat(labelY) }
                : null;

              return {
                id,
                type: 'deviceNode',
                position: positionFromLabels || existingNode?.position || { x: 100 + (index % 4) * 200, y: 100 + Math.floor(index / 4) * 150 },
                data: {
                  id,
                  name: node.name,
                  platform,
                  template: node.template,
                  nodeProfile,
                  labels: node.labels,
                },
              };
            });
            updates.nodes = newNodes;

            // Parse links and map node names to IDs
            if (parsed.spec?.links && Array.isArray(parsed.spec.links)) {
              const nameToNewId = new Map<string, string>();
              newNodes.forEach(n => nameToNewId.set(n.data.name, n.id));

              // Add simNode IDs to the mapping (using pre-generated IDs)
              simNodeIdMap.forEach((id, name) => nameToNewId.set(name, id));

              // Group all links by node pair + handles
              interface EdgeData {
                memberLinks: MemberLink[];
                lagGroups: { id: string; name: string; template?: string; memberLinkIndices: number[] }[];
                sourceHandle: string;
                targetHandle: string;
              }
              const edgesByPair = new Map<string, EdgeData>();

              const esiLagEdges: Edge<TopologyEdgeData>[] = [];

              for (const link of parsed.spec.links) {
                const endpoints = link.endpoints || [];
                if (endpoints.length === 0) continue;

                const isSimEsiLag = endpoints.length >= 2 &&
                  endpoints.every(ep => ep.local?.node && (ep.sim?.node || ep.sim?.simNode) && !ep.remote?.node);

                if (isSimEsiLag) {
                  const firstSimName = endpoints[0].sim?.node || endpoints[0].sim?.simNode;
                  if (!firstSimName) continue;

                  const simNodeId = nameToNewId.get(firstSimName);
                  if (!simNodeId) continue;

                  const leafInfoList: Array<{ name: string; localInterface: string; simInterface: string }> = [];
                  for (const ep of endpoints) {
                    if (ep.local?.node) {
                      leafInfoList.push({
                        name: ep.local.node,
                        localInterface: ep.local.interface || 'ethernet-1-1',
                        simInterface: ep.sim?.interface || ep.sim?.simNodeInterface || 'ethernet-1-1',
                      });
                    }
                  }

                  if (leafInfoList.length >= 2 && leafInfoList.every(l => nameToNewId.has(l.name))) {
                    const edgeId = `edge-${edgeIdCounter++}`;
                    const firstLeaf = leafInfoList[0];

                    const esiLeaves = leafInfoList.map(leaf => ({
                      nodeId: nameToNewId.get(leaf.name)!,
                      nodeName: leaf.name,
                      leafHandle: 'top-target',
                      sourceHandle: 'bottom',
                    }));

                    const memberLinks = leafInfoList.map((leaf, i) => ({
                      name: `${firstSimName}-${leaf.name}-${i + 1}`,
                      sourceInterface: leaf.simInterface,
                      targetInterface: leaf.localInterface,
                    }));

                    esiLagEdges.push({
                      id: edgeId,
                      type: 'linkEdge',
                      source: simNodeId,
                      target: nameToNewId.get(firstLeaf.name)!,
                      sourceHandle: 'bottom',
                      targetHandle: 'top-target',
                      data: {
                        id: edgeId,
                        sourceNode: firstSimName,
                        targetNode: firstLeaf.name,
                        isMultihomed: true,
                        esiLeaves,
                        memberLinks,
                        esiLagName: link.name || `${firstSimName}-esi-lag`,
                      },
                    });
                  }
                  continue;
                }

                const isEsiLag = endpoints.length >= 3 &&
                  endpoints.every(ep => ep.local?.node && !ep.remote?.node);

                if (isEsiLag) {
                  const nodeInfoList: Array<{ name: string; interface: string }> = [];
                  for (const ep of endpoints) {
                    if (ep.local?.node) {
                      nodeInfoList.push({
                        name: ep.local.node,
                        interface: ep.local.interface || 'ethernet-1-1',
                      });
                    }
                  }

                  if (nodeInfoList.length >= 2 && nodeInfoList.every(n => nameToNewId.has(n.name))) {
                    const sourceNode = nodeInfoList[0];
                    const leafNodes = nodeInfoList.slice(1);

                    const edgeId = `edge-${edgeIdCounter++}`;
                    const firstLeaf = leafNodes[0];

                    const esiLeaves = leafNodes.map(leaf => ({
                      nodeId: nameToNewId.get(leaf.name)!,
                      nodeName: leaf.name,
                      leafHandle: 'top-target',
                      sourceHandle: 'bottom',
                    }));

                    const memberLinks = leafNodes.map((leaf, i) => ({
                      name: `${sourceNode.name}-${leaf.name}-${i + 1}`,
                      sourceInterface: sourceNode.interface,
                      targetInterface: leaf.interface,
                    }));

                    esiLagEdges.push({
                      id: edgeId,
                      type: 'linkEdge',
                      source: nameToNewId.get(sourceNode.name)!,
                      target: nameToNewId.get(firstLeaf.name)!,
                      sourceHandle: 'bottom',
                      targetHandle: 'top-target',
                      data: {
                        id: edgeId,
                        sourceNode: sourceNode.name,
                        targetNode: firstLeaf.name,
                        isMultihomed: true,
                        esiLeaves,
                        memberLinks,
                        esiLagName: link.name || `${sourceNode.name}-esi-lag`,
                      },
                    });
                  }
                  continue;
                }

                const firstEndpoint = endpoints[0];
                const hasRemote = firstEndpoint?.remote?.node;
                const hasLocal = firstEndpoint?.local?.node;

                if (!hasRemote || !hasLocal) {
                  // Skip non-ISL links (edge links, sim links, etc.)
                  continue;
                }

                const sourceName = firstEndpoint.local!.node;
                const targetName = firstEndpoint.remote!.node;

                // Skip if source or target node doesn't exist
                if (!nameToNewId.has(sourceName) || !nameToNewId.has(targetName)) {
                  continue;
                }

                const sourceHandle = link.labels?.[LABEL_SRC_HANDLE] || 'bottom';
                const targetHandle = link.labels?.[LABEL_DST_HANDLE] || 'top-target';
                const pairKey = [sourceName, targetName].sort().join('|') + `|${sourceHandle}|${targetHandle}`;

                if (!edgesByPair.has(pairKey)) {
                  edgesByPair.set(pairKey, { memberLinks: [], lagGroups: [], sourceHandle, targetHandle });
                }
                const edgeData = edgesByPair.get(pairKey)!;

                const isLag = endpoints.length > 1 && endpoints.every(ep => ep.local?.node && ep.remote?.node);

                if (isLag) {
                  const startIdx = edgeData.memberLinks.length;
                  const lagMemberIndices: number[] = [];

                  endpoints.forEach((ep, idx) => {
                    edgeData.memberLinks.push({
                      name: `${link.name}-${idx + 1}`,
                      template: link.template,
                      sourceInterface: ep.local!.interface || 'ethernet-1-1',
                      targetInterface: ep.remote!.interface || 'ethernet-1-1',
                    });
                    lagMemberIndices.push(startIdx + idx);
                  });

                  edgeData.lagGroups.push({
                    id: `lag-${pairKey}-${edgeData.lagGroups.length + 1}`,
                    name: link.name,
                    template: link.template,
                    memberLinkIndices: lagMemberIndices,
                  });
                } else {
                  edgeData.memberLinks.push({
                    name: link.name,
                    template: link.template,
                    sourceInterface: firstEndpoint.local!.interface || 'ethernet-1-1',
                    targetInterface: firstEndpoint.remote!.interface || 'ethernet-1-1',
                  });
                }
              }

              // Create one edge per node pair + handle combination
              const newEdges: Edge<TopologyEdgeData>[] = [];
              for (const [pairKey, { memberLinks, lagGroups, sourceHandle, targetHandle }] of edgesByPair) {
                const [nodeName1, nodeName2] = pairKey.split('|');
                const sourceId = nameToNewId.get(nodeName1)!;
                const targetId = nameToNewId.get(nodeName2)!;

                // Check if edge already exists with same handles
                const existingEdge = currentEdges.find(
                  e => ((e.source === sourceId && e.target === targetId) ||
                    (e.source === targetId && e.target === sourceId)) &&
                    e.sourceHandle === sourceHandle && e.targetHandle === targetHandle
                );
                const id = existingEdge?.id || `edge-${edgeIdCounter++}`;

                newEdges.push({
                  id,
                  type: 'linkEdge',
                  source: sourceId,
                  target: targetId,
                  sourceHandle,
                  targetHandle,
                  data: {
                    id,
                    sourceNode: nodeName1,
                    targetNode: nodeName2,
                    memberLinks,
                    lagGroups: lagGroups.length > 0 ? lagGroups : undefined,
                  },
                });
              }

              updates.edges = [...newEdges, ...esiLagEdges];
            }
          }

          if (parsed.spec?.simulation) {
            const simDataFromYaml = parsed.spec.simulation as Simulation;
            const simNodes = (simDataFromYaml.simNodes || []).map((simNode, index) => {
              const labelX = simNode.labels?.[LABEL_POS_X];
              const labelY = simNode.labels?.[LABEL_POS_Y];
              const positionFromLabels = labelX && labelY
                ? { x: parseFloat(labelX), y: parseFloat(labelY) }
                : null;
              const existing = currentSimNodes.find(n => n.name === simNode.name);
              const position = positionFromLabels || existing?.position || { x: 400 + (index % 3) * 180, y: 50 + Math.floor(index / 3) * 140 };
              const id = simNodeIdMap.get(simNode.name) || generateSimNodeId();
              return { ...simNode, id, position };
            });
            updates.simulation = {
              simNodeTemplates: baseTemplate.simulation?.simNodeTemplates || [],
              simNodes,
              topology: simDataFromYaml.topology,
            };
          } else {
            updates.simulation = {
              simNodeTemplates: baseTemplate.simulation?.simNodeTemplates || [],
              simNodes: [],
            };
          }

          set(updates);
          return true;
        } catch (e) {
          console.error('Failed to parse YAML:', e);
          return false;
        }
      },
    }),
    {
      name: 'topology-storage',
      partialize: (state) => ({
        ...state,
        expandedEdges: Array.from(state.expandedEdges),
        selectedSimNodeNames: Array.from(state.selectedSimNodeNames),
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<TopologyState> & { expandedEdges?: string[]; selectedSimNodeNames?: string[] };
        const nodes = persisted.nodes?.map(node => ({ ...node, data: { ...node.data, isNew: false } })) || currentState.nodes;
        const persistedSimulation = persisted.simulation as Simulation | undefined;
        const simulation: Simulation = persistedSimulation ? {
          ...persistedSimulation,
          simNodes: persistedSimulation.simNodes?.map((simNode: SimNode) => ({ ...simNode, isNew: false })) || [],
        } : currentState.simulation;
        const expandedEdges = persisted.expandedEdges
          ? new Set(persisted.expandedEdges)
          : currentState.expandedEdges;
        const selectedSimNodeNames = persisted.selectedSimNodeNames
          ? new Set(persisted.selectedSimNodeNames)
          : currentState.selectedSimNodeNames;
        return {
          ...currentState,
          ...persisted,
          nodes,
          simulation,
          expandedEdges,
          selectedSimNodeNames,
          // Ensure default templates if persisted state has empty arrays
          nodeTemplates: persisted.nodeTemplates?.length ? persisted.nodeTemplates : initialState.nodeTemplates,
          linkTemplates: persisted.linkTemplates?.length ? persisted.linkTemplates : initialState.linkTemplates,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Restore node/edge ID counters
          const maxNodeId = state.nodes.reduce((max, node) => {
            const num = parseInt(node.id.split('-')[1] || '0', 10);
            return Math.max(max, num);
          }, 0);
          const maxEdgeId = state.edges.reduce((max, edge) => {
            const num = parseInt(edge.id.split('-')[1] || '0', 10);
            return Math.max(max, num);
          }, 0);
          nodeIdCounter = maxNodeId + 1;
          edgeIdCounter = maxEdgeId + 1;
        }
      },
    }
  )
);
