// DO NOT EDIT THIS GENERATED FILE.
// Run: node scripts/generate-types.js

export type Operation = 'create' | 'replace' | 'replaceAll' | 'delete' | 'deleteAll';

export type LinkType = 'edge' | 'interSwitch' | 'loopback';

export type LinkSpeed = '800G' | '400G' | '200G' | '100G' | '50G' | '40G' | '25G' | '10G' | '2.5G' | '1G' | '100M';

export type EncapType = 'null' | 'dot1q';

export type SimNodeType = 'Linux' | 'TestMan' | 'SrlTest';

export interface TopologyNodeData {
  [key: string]: unknown;
  id: string;
  name: string;
  platform?: string;
  template?: string;
  nodeProfile?: string;
  labels?: Record<string, string>;
  isNew?: boolean;
}

export interface MemberLink {
  name: string;
  template?: string;
  sourceInterface: string;
  targetInterface: string;
  labels?: Record<string, string>;
}

export interface LagGroup {
  id: string;
  name: string;
  template?: string;
  memberLinkIndices: number[];
  labels?: Record<string, string>;
}

export interface MultihomeMemberLink {
  name: string;
  template?: string;
  nodeInterfaces: Array<{
    node: string;
    interface: string;
  }>;
}

export interface EsiLeafConnection {
  nodeId: string;
  nodeName: string;
  leafHandle: string;
  sourceHandle: string;
}

export interface TopologyEdgeData {
  [key: string]: unknown;
  id: string;
  sourceNode: string;
  targetNode: string;
  memberLinks?: MemberLink[];
  lagGroups?: LagGroup[];
  isMultihomed?: boolean;
  esiLeaves?: EsiLeafConnection[];
  esiLagName?: string;
}

export interface NodeTemplate {
  name: string;
  platform?: string;
  nodeProfile?: string;
  labels?: Record<string, string>;
}

export interface LinkTemplate {
  name: string;
  type?: LinkType;
  speed?: LinkSpeed;
  encapType?: EncapType;
  labels?: Record<string, string>;
}

export interface NetworkNode {
  name: string;
  platform?: string;
  template?: string;
  nodeProfile?: string;
  labels?: Record<string, string>;
}

export interface SimNodeTemplate {
  name: string;
  type?: SimNodeType;
  image?: string;
  imagePullSecret?: string;
  labels?: Record<string, string>;
}

export interface SimNode {
  id: string;
  name: string;
  template?: string;
  type?: SimNodeType;
  image?: string;
  labels?: Record<string, string>;
  position?: { x: number; y: number };
  isNew?: boolean;
}

export interface Simulation {
  simNodeTemplates: SimNodeTemplate[];
  simNodes: SimNode[];
  topology?: unknown;
}

export interface Clipboard {
  nodes: import('@xyflow/react').Node<TopologyNodeData>[];
  edges: import('@xyflow/react').Edge<TopologyEdgeData>[];
  simNodes: SimNode[];
  copiedLink?: {
    edgeId: string;
    template?: string;
  };
}

export interface TopologyState {
  topologyName: string;
  namespace: string;
  operation: Operation;
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  nodes: import('@xyflow/react').Node<TopologyNodeData>[];
  edges: import('@xyflow/react').Edge<TopologyEdgeData>[];
  simulation: Simulation;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedEdgeIds: string[];
  selectedSimNodeName: string | null;
  selectedSimNodeNames: Set<string>;
  expandedEdges: Set<string>;
  selectedMemberLinkIndices: number[];
  selectedLagId: string | null;
  yamlRefreshCounter: number;
  layoutVersion: number;
  darkMode: boolean;
  showSimNodes: boolean;
  error: string | null;
  clipboard: Clipboard;
}
