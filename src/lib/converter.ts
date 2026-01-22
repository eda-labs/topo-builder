import yaml from 'js-yaml';
import type { Node, Edge } from '@xyflow/react';
import type {
  TopologyNodeData,
  TopologyEdgeData,
  NetworkNode,
  NodeTemplate,
  LinkTemplate,
  EdgeLink,
  Operation,
  Simulation,
} from '../types/topology';
import { LABEL_POS_X, LABEL_POS_Y, LABEL_SRC_HANDLE, LABEL_DST_HANDLE } from './constants';

interface ExportOptions {
  topologyName: string;
  namespace: string;
  operation: Operation;
  nodes: Node<TopologyNodeData>[];
  edges: Edge<TopologyEdgeData>[];
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  edgeLinks?: EdgeLink[];
  simulation?: Simulation;
}

interface YamlLink {
  name: string;
  template?: string;
  labels?: Record<string, string>;
  endpoints: Array<{
    local: { node: string; interface: string };
    remote: { node: string; interface: string };
  }>;
}

interface NetworkTopologyCrd {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    operation: Operation;
    nodeTemplates: NodeTemplate[];
    nodes: NetworkNode[];
    linkTemplates: LinkTemplate[];
    links: Array<YamlLink | EdgeLink>;
    simulation?: Simulation;
  };
}

export function exportToYaml(options: ExportOptions): string {
  const {
    topologyName,
    namespace,
    operation,
    nodes,
    edges,
    nodeTemplates,
    linkTemplates,
    edgeLinks = [],
    simulation,
  } = options;

  const nodeIdToName = new Map<string, string>();
  nodes.forEach((node) => {
    nodeIdToName.set(node.id, node.data.name);
  });

  // Map simNode IDs to names
  const simNodeIdToName = new Map<string, string>();
  simulation?.simNodes?.forEach((simNode) => {
    simNodeIdToName.set(simNode.id, simNode.name);
  });

  const networkNodes: NetworkNode[] = nodes.map((node) => {
    const networkNode: NetworkNode = {
      name: node.data.name,
    };

    const labels: Record<string, string> = {};
    labels[LABEL_POS_X] = String(Math.round(node.position.x));
    labels[LABEL_POS_Y] = String(Math.round(node.position.y));

    if (node.data.template) {
      networkNode.template = node.data.template;
    } else {
      if (node.data.platform) {
        networkNode.platform = node.data.platform;
      }
      if (node.data.nodeProfile) {
        networkNode.nodeProfile = node.data.nodeProfile;
      }
      if (node.data.labels) {
        Object.assign(labels, node.data.labels);
      }
    }

    networkNode.labels = labels;
    return networkNode;
  });

  // Convert React Flow edges to ISL links (expand member links)
  // Skip edges to sim nodes - those should be created as edge links with sim: endpoint
  const islLinks: YamlLink[] = [];
  const simEdgeLinks: EdgeLink[] = [];

  for (const edge of edges) {
    const sourceName = edge.data?.sourceNode || nodeIdToName.get(edge.source) || edge.source;
    const targetName = edge.data?.targetNode || nodeIdToName.get(edge.target) || edge.target;

    // Check if either endpoint is a sim node
    const sourceIsSimNode = edge.source.startsWith('sim-');
    const targetIsSimNode = edge.target.startsWith('sim-');

    // Output each member link as a separate link in YAML
    const memberLinks = edge.data?.memberLinks || [];
    for (const member of memberLinks) {
      // If connecting to a sim node, create an edge link with sim: endpoint
      if (targetIsSimNode) {
        const simNodeName = simNodeIdToName.get(edge.target) || edge.target;
        const labels: Record<string, string> = {};
        if (edge.sourceHandle) labels[LABEL_SRC_HANDLE] = edge.sourceHandle;
        if (edge.targetHandle) labels[LABEL_DST_HANDLE] = edge.targetHandle;
        simEdgeLinks.push({
          name: member.name,
          template: member.template,
          labels: Object.keys(labels).length > 0 ? labels : undefined,
          endpoints: [{
            local: {
              node: sourceName,
              interface: member.sourceInterface || 'ethernet-1-1',
            },
            sim: {
              simNode: simNodeName,
              simNodeInterface: member.targetInterface,
            },
          }],
        });
      } else if (sourceIsSimNode) {
        // Sim node is the source, topology node is target
        const simNodeName = simNodeIdToName.get(edge.source) || edge.source;
        const labels: Record<string, string> = {};
        if (edge.sourceHandle) labels[LABEL_SRC_HANDLE] = edge.sourceHandle;
        if (edge.targetHandle) labels[LABEL_DST_HANDLE] = edge.targetHandle;
        simEdgeLinks.push({
          name: member.name,
          template: member.template,
          labels: Object.keys(labels).length > 0 ? labels : undefined,
          endpoints: [{
            local: {
              node: targetName,
              interface: member.targetInterface || 'ethernet-1-1',
            },
            sim: {
              simNode: simNodeName,
              simNodeInterface: member.sourceInterface,
            },
          }],
        });
      } else {
        // Regular ISL link between two topology nodes
        const link: YamlLink = {
          name: member.name,
          endpoints: [
            {
              local: {
                node: sourceName,
                interface: member.sourceInterface || 'ethernet-1-1',
              },
              remote: {
                node: targetName,
                interface: member.targetInterface || 'ethernet-1-1',
              },
            },
          ],
        };

        if (member.template) {
          link.template = member.template;
        }

        // Store handles as labels
        const labels: Record<string, string> = {};
        if (edge.sourceHandle) {
          labels[LABEL_SRC_HANDLE] = edge.sourceHandle;
        }
        if (edge.targetHandle) {
          labels[LABEL_DST_HANDLE] = edge.targetHandle;
        }
        if (Object.keys(labels).length > 0) {
          link.labels = labels;
        }

        islLinks.push(link);
      }
    }
  }

  // Combine ISL links, sim edge links, and user-defined edge links
  const allLinks = [...islLinks, ...simEdgeLinks, ...edgeLinks];

  // Build the full CRD object
  const crd: NetworkTopologyCrd = {
    apiVersion: 'topologies.eda.nokia.com/v1alpha1',
    kind: 'NetworkTopology',
    metadata: {
      name: topologyName,
      namespace: namespace,
    },
    spec: {
      operation: operation,
      nodeTemplates: nodeTemplates,
      nodes: networkNodes,
      linkTemplates: linkTemplates,
      links: allLinks,
    },
  };

  // Only include simulation if it has data
  if (simulation && (
    (simulation.simNodeTemplates && simulation.simNodeTemplates.length > 0) ||
    (simulation.simNodes && simulation.simNodes.length > 0) ||
    (simulation.topology && simulation.topology.length > 0)
  )) {
    // Convert position to labels for simNodes, strip internal id field
    const cleanSimulation = {
      ...simulation,
      simNodes: simulation.simNodes?.map(({ position, id: _id, ...rest }) => ({
        ...rest,
        labels: {
          ...rest.labels,
          ...(position ? {
            [LABEL_POS_X]: String(Math.round(position.x)),
            [LABEL_POS_Y]: String(Math.round(position.y)),
          } : {}),
        },
      })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    crd.spec.simulation = cleanSimulation as any;
  }

  return yaml.dump(crd, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}

export function downloadYaml(yamlContent: string, filename: string): void {
  const blob = new Blob([yamlContent], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
