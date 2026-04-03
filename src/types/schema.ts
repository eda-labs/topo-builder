// DO NOT EDIT THIS GENERATED FILE.
// Run: node scripts/generate-types.js

export type Operation = 'Create' | 'Replace' | 'ReplaceAll' | 'Delete' | 'DeleteAll' | 'Reconcile';

export type LinkType = 'Edge' | 'InterSwitch' | 'Loopback';

export type LinkSpeed = '800G' | '400G' | '200G' | '100G' | '50G' | '40G' | '25G' | '10G' | '2.5G' | '1G' | '100M';

export type EncapType = 'Null' | 'Dot1q';

export type SimNodeType = 'Linux' | 'TestMan' | 'SrlTest';

export type ComponentKind = 'controlCard' | 'lineCard' | 'fabric' | 'mda' | 'connector' | 'xiom' | 'powerShelf' | 'powerModule';

export interface Component {
  kind: ComponentKind;
  type: string;
  slot?: string;
}

export interface NodeTemplate {
  name: string;
  platform?: string;
  nodeProfile?: string;
  components?: Component[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface LinkTemplate {
  name: string;
  type?: LinkType;
  speed?: LinkSpeed;
  encapType?: EncapType;
  labels?: Record<string, string>;
}

export interface SimNodeTemplate {
  name: string;
  type?: SimNodeType;
  image?: string;
  imagePullSecret?: string;
  labels?: Record<string, string>;
}

export interface TopoNode {
  name: string;
  template?: string;
  serialNumber?: string;
  platform?: string;
  nodeProfile?: string;
  components?: Component[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface SimNode {
  name: string;
  template?: string;
  type?: SimNodeType;
  image?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface EndpointLocal {
  node: string;
  interface?: string;
}

export interface EndpointRemote {
  node: string;
  interface?: string;
}

export interface EndpointSim {
  simNode?: string;
  simNodeInterface?: string;
  node?: string;
  interface?: string;
}

export interface Endpoint {
  local?: EndpointLocal;
  remote?: EndpointRemote;
  sim?: EndpointSim;
  type?: LinkType;
  speed?: LinkSpeed;
}

export interface Link {
  name?: string;
  template?: string;
  encapType?: EncapType;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  endpoints: Endpoint[];
}

export interface Simulation {
  simNodeTemplates?: SimNodeTemplate[];
  simNodes?: SimNode[];
  topology?: unknown[];
}

export interface TopologyMetadata {
  name: string;
  namespace?: string;
}

export interface TopologySpec {
  operation?: Operation;
  nodeTemplates?: NodeTemplate[];
  linkTemplates?: LinkTemplate[];
  nodes?: TopoNode[];
  links?: Link[];
  simulation?: Simulation;
}

export interface Topology {
  apiVersion: 'topologies.eda.nokia.com/v1alpha1';
  kind: 'NetworkTopology';
  metadata: TopologyMetadata;
  spec: TopologySpec;
}

export interface ParsedTopology {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
  };
  spec?: {
    operation?: string;
    nodeTemplates?: NodeTemplate[];
    linkTemplates?: LinkTemplate[];
    nodes?: TopoNode[];
    links?: Link[];
    simulation?: Simulation;
  };
}
