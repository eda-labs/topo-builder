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
}

export interface MemberLink {
  name: string;
  template?: string;
  sourceInterface: string;
  targetInterface: string;
}

export interface TopologyEdgeData {
  [key: string]: unknown;
  id: string;
  sourceNode: string;
  targetNode: string;
  memberLinks?: MemberLink[];
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

export interface EdgeLinkEndpoint {
  local: {
    node: string;
    interface?: string;
  };
  remote?: {
    node: string;
    interface?: string;
  };
}

export interface EdgeLink {
  name: string;
  template?: string;
  endpoints: EdgeLinkEndpoint[];
}

export interface NetworkNode {
  name: string;
  platform?: string;
  template?: string;
  nodeProfile?: string;
  labels?: Record<string, string>;
}

export interface TopologyState {
  topologyName: string;
  namespace: string;
  operation: Operation;
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  nodes: import('@xyflow/react').Node<TopologyNodeData>[];
  edges: import('@xyflow/react').Edge<TopologyEdgeData>[];
  edgeLinks: EdgeLink[];
  simulation?: unknown;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedEdgeLinkIndex: number | null;
  yamlRefreshCounter: number;
}
