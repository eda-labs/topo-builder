import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import yaml from 'js-yaml';
import baseTemplateYaml from '../static/base-template.yaml?raw';
import { LABEL_POS_X, LABEL_POS_Y, LABEL_SRC_HANDLE, LABEL_DST_HANDLE } from './constants';
import type {
  TopologyNodeData,
  TopologyEdgeData,
  TopologyState,
  NodeTemplate,
  LinkTemplate,
  EdgeLink,
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
  name: string;
  template?: string;
  labels?: Record<string, string>;
  endpoints?: Array<{
    local?: { node: string; interface?: string };
    remote?: { node: string; interface?: string };
    sim?: { simNode: string; simNodeInterface?: string };
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

  // Edge link actions
  addEdgeLink: (nodeId: string) => void;
  updateEdgeLink: (index: number, link: Partial<EdgeLink>) => void;
  deleteEdgeLink: (index: number) => void;

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
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  selectEdgeLink: (index: number | null) => void;
  selectSimNode: (name: string | null) => void;

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
  edgeLinks: [],
  simulation: baseTemplate.simulation || {
    simNodeTemplates: [],
    simNodes: [],
  },
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedEdgeLinkIndex: null,
  selectedSimNodeName: null,
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
        let name = `node${counter}`;
        while (allNames.includes(name)) {
          counter++;
          name = `node${counter}`;
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
            if (!needsSourceUpdate && !needsTargetUpdate) return edge;

            return {
              ...edge,
              data: edge.data ? {
                ...edge.data,
                sourceNode: needsSourceUpdate ? newName : edge.data.sourceNode,
                targetNode: needsTargetUpdate ? newName : edge.data.targetNode,
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
        const id = generateEdgeId();
        const nodes = get().nodes;
        const edges = get().edges;
        const sourceNode = nodes.find(n => n.id === connection.source)?.data.name || connection.source!;
        const targetNode = nodes.find(n => n.id === connection.target)?.data.name || connection.target!;

        // Count existing edges between these nodes to increment link name
        const existingCount = edges.filter(e =>
          (e.source === connection.source && e.target === connection.target) ||
          (e.source === connection.target && e.target === connection.source)
        ).length;

        // Find highest port number used by source node
        const sourcePortNumbers = edges.flatMap(e => {
          if (e.source === connection.source) {
            return e.data?.memberLinks?.map(ml => {
              const match = ml.sourceInterface.match(/ethernet-1-(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            }) || [];
          }
          if (e.target === connection.source) {
            return e.data?.memberLinks?.map(ml => {
              const match = ml.targetInterface.match(/ethernet-1-(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            }) || [];
          }
          return [];
        });
        const nextSourcePort = Math.max(0, ...sourcePortNumbers) + 1;

        // Find highest port number used by target node
        const targetPortNumbers = edges.flatMap(e => {
          if (e.source === connection.target) {
            return e.data?.memberLinks?.map(ml => {
              const match = ml.sourceInterface.match(/ethernet-1-(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            }) || [];
          }
          if (e.target === connection.target) {
            return e.data?.memberLinks?.map(ml => {
              const match = ml.targetInterface.match(/ethernet-1-(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            }) || [];
          }
          return [];
        });
        const nextTargetPort = Math.max(0, ...targetPortNumbers) + 1;

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
              name: `${sourceNode}-${targetNode}-${existingCount + 1}`,
              template: 'isl',
              sourceInterface: `ethernet-1-${nextSourcePort}`,
              targetInterface: `ethernet-1-${nextTargetPort}`,
            }],
          },
        };
        const deselectedNodes = get().nodes.map(n => ({ ...n, selected: false }));
        const deselectedEdges = get().edges.map(e => ({ ...e, selected: false }));
        set({
          nodes: deselectedNodes,
          edges: addEdge(newEdge, deselectedEdges),
          selectedEdgeId: id,
          selectedNodeId: null,
          selectedSimNodeName: null,
        });
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
        set({
          edges: get().edges.filter((edge) => edge.id !== id),
          selectedEdgeId: get().selectedEdgeId === id ? null : get().selectedEdgeId,
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
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
        // Trigger YAML refresh if any edges were removed
        if (changes.some(c => c.type === 'remove')) {
          get().triggerYamlRefresh();
        }
      },

      onConnect: (connection: Connection) => {
        get().addEdge(connection);
      },

      // Edge link actions
      addEdgeLink: (nodeId: string) => {
        const node = get().nodes.find(n => n.id === nodeId);
        if (!node) return;

        const nodeName = node.data.name;
        const existingCount = get().edgeLinks.filter(
          el => el.endpoints[0]?.local?.node === nodeName
        ).length;

        const newEdgeLink: EdgeLink = {
          name: `${nodeName}-ethernet-1-${existingCount + 1}`,
          template: 'edge',
          endpoints: [{
            local: {
              node: nodeName,
              interface: `ethernet-1-${existingCount + 1}`,
            },
          }],
        };

        set({ edgeLinks: [...get().edgeLinks, newEdgeLink] });
        get().triggerYamlRefresh();
      },

      updateEdgeLink: (index: number, link: Partial<EdgeLink>) => {
        set({
          edgeLinks: get().edgeLinks.map((el, i) =>
            i === index ? { ...el, ...link } : el
          ),
        });
      },

      deleteEdgeLink: (index: number) => {
        set({
          edgeLinks: get().edgeLinks.filter((_, i) => i !== index),
        });
        get().triggerYamlRefresh();
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

        // Update edge data when name changes (ID stays stable)
        let updatedEdges = get().edges;
        if (simNodeUpdate.name && simNodeUpdate.name !== name) {
          updatedEdges = updatedEdges.map(edge => {
            const needsSourceUpdate = edge.source === stableId;
            const needsTargetUpdate = edge.target === stableId;
            if (!needsSourceUpdate && !needsTargetUpdate) return edge;

            return {
              ...edge,
              data: edge.data ? {
                ...edge.data,
                sourceNode: needsSourceUpdate ? newName : edge.data.sourceNode,
                targetNode: needsTargetUpdate ? newName : edge.data.targetNode,
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
      selectNode: (id: string | null) => {
        set({ selectedNodeId: id, selectedEdgeId: null, selectedEdgeLinkIndex: null, selectedSimNodeName: null });
      },

      selectEdge: (id: string | null) => {
        set({
          selectedEdgeId: id,
          selectedNodeId: null,
          selectedEdgeLinkIndex: null,
          selectedSimNodeName: null,
          edges: get().edges.map(e => ({ ...e, selected: e.id === id })),
          nodes: get().nodes.map(n => ({ ...n, selected: false })),
        });
      },

      selectEdgeLink: (index: number | null) => {
        set({ selectedEdgeLinkIndex: index, selectedNodeId: null, selectedEdgeId: null, selectedSimNodeName: null });
      },

      selectSimNode: (name: string | null) => {
        set({ selectedSimNodeName: name, selectedNodeId: null, selectedEdgeId: null, selectedEdgeLinkIndex: null });
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
              name: `${newSourceName}-${newTargetName}-${link.name.split('-').pop() || '1'}`,
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
              edgeLinks: [],
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

              const newEdgeLinks: EdgeLink[] = [];
              // Group ISL links by node pair
              const islLinksByPair = new Map<string, { memberLinks: MemberLink[], sourceHandle: string, targetHandle: string }>();

              for (const link of parsed.spec.links) {
                // Check if this is an ISL (has remote to another topology node) or edge link (sim or external)
                const endpoint = link.endpoints?.[0];
                const hasRemote = endpoint?.remote?.node;
                const hasSim = endpoint?.sim?.simNode;
                const hasLocal = endpoint?.local?.node;

                if (!hasRemote || !hasLocal || hasSim) {
                  // Edge link - store as-is for export (convert to EdgeLink format)
                  // This includes links with sim: endpoints
                  if (link.endpoints) {
                    newEdgeLinks.push({
                      name: link.name,
                      template: link.template,
                      endpoints: link.endpoints.map(ep => ({
                        local: {
                          node: ep.local?.node || '',
                          interface: ep.local?.interface,
                        },
                        remote: ep.remote ? {
                          node: ep.remote.node,
                          interface: ep.remote.interface,
                        } : undefined,
                        sim: ep.sim ? {
                          simNode: ep.sim.simNode,
                          simNodeInterface: ep.sim.simNodeInterface,
                        } : undefined,
                      })),
                    });
                  }
                  continue;
                }

                const sourceName = endpoint.local!.node;
                const targetName = endpoint.remote!.node;

                // Skip if source or target node doesn't exist
                if (!nameToNewId.has(sourceName) || !nameToNewId.has(targetName)) {
                  continue;
                }

                // Create key including handles (allows multiple edges between same node pair)
                const sourceHandle = link.labels?.[LABEL_SRC_HANDLE] || 'bottom';
                const targetHandle = link.labels?.[LABEL_DST_HANDLE] || 'top-target';
                const pairKey = [sourceName, targetName].sort().join('|') + `|${sourceHandle}|${targetHandle}`;

                // Add to member links for this pair+handle combo
                if (!islLinksByPair.has(pairKey)) {
                  islLinksByPair.set(pairKey, { memberLinks: [], sourceHandle, targetHandle });
                }
                islLinksByPair.get(pairKey)!.memberLinks.push({
                  name: link.name,
                  template: link.template,
                  sourceInterface: endpoint.local!.interface || 'ethernet-1-1',
                  targetInterface: endpoint.remote!.interface || 'ethernet-1-1',
                });
              }

              // Create one edge per node pair + handle combination
              const newEdges: Edge<TopologyEdgeData>[] = [];
              for (const [pairKey, { memberLinks, sourceHandle, targetHandle }] of islLinksByPair) {
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
                  },
                });
              }

              updates.edges = newEdges;
              updates.edgeLinks = newEdgeLinks;
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
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<TopologyState>;
        return {
          ...currentState,
          ...persisted,
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
