export interface Component {
  kind: string;
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
  type?: string;
  speed?: string;
  encapType?: string;
  labels?: Record<string, string>;
}

export interface SimNodeTemplate {
  name: string;
  type?: string;
  image?: string;
  imagePullSecret?: string;
  labels?: Record<string, string>;
}

export interface TopoNode {
  name: string;
  template?: string;
  serialNumber?: string;
  productionAddress?: { ipv4?: string; ipv6?: string };
  platform?: string;
  nodeProfile?: string;
  components?: Component[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface SimNode {
  name: string;
  template?: string;
  type?: string;
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
  type?: string;
  speed?: string;
}

export interface Link {
  name?: string;
  template?: string;
  encapType?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  endpoints: Endpoint[];
}

export interface Simulation {
  simNodeTemplates?: SimNodeTemplate[];
  simNodes?: SimNode[];
  topology?: unknown[];
  topologies?: unknown[];
}

export interface TopologyMetadata {
  name: string;
  namespace?: string;
}

export interface TopologySpec {
  operation?: string;
  nodeTemplates?: NodeTemplate[];
  linkTemplates?: LinkTemplate[];
  nodes?: TopoNode[];
  links?: Link[];
  simulation?: Simulation;
}

export interface Topology {
  apiVersion: string;
  kind: string;
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
