import yaml from 'js-yaml';
import type { Node, Edge } from '@xyflow/react';
import type {
  TopologyNodeData,
  TopologyEdgeData,
  NetworkNode,
  NodeTemplate,
  LinkTemplate,
  Operation,
  Simulation,
} from '../types/topology';
import { LABEL_POS_X, LABEL_POS_Y, LABEL_SRC_HANDLE, LABEL_DST_HANDLE, LABEL_EDGE_ID, LABEL_MEMBER_INDEX, DEFAULT_INTERFACE, DEFAULT_SIM_INTERFACE } from './constants';

interface ExportOptions {
  topologyName: string;
  namespace: string;
  operation: Operation;
  nodes: Node<TopologyNodeData>[];
  edges: Edge<TopologyEdgeData>[];
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  simulation?: Simulation;
}

interface YamlLink {
  name?: string;
  encapType?: string | null;
  template?: string;
  labels?: Record<string, string>;
  endpoints: Array<{
    local?: { node: string; interface?: string };
    remote?: { node: string; interface?: string };
    sim?: { simNode?: string; simNodeInterface?: string; node?: string; interface?: string };
    type?: string;
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
    links: YamlLink[];
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
  const simLinks: YamlLink[] = [];
  const esiLagLinks: YamlLink[] = [];

  const processedMultihomedEdgeIds = new Set<string>();
  let esiLagCounter = 1;

  for (const edge of edges) {
    if (edge.data?.isMultihomed && edge.data.esiLeaves?.length) {
      const sourceName = edge.data.sourceNode;
      const esiLeaves = edge.data.esiLeaves;
      const memberLinks = edge.data.memberLinks || [];
      const sourceIsSimNode = edge.source.startsWith('sim-');

      if (sourceIsSimNode) {
        const simNodeName = simNodeIdToName.get(edge.source) || sourceName;

        const endpoints: Array<{
          local: { node: string; interface: string };
          sim: { simNode: string; simNodeInterface: string };
        }> = [];

        esiLeaves.forEach((leaf, i) => {
          endpoints.push({
            local: {
              node: leaf.nodeName,
              interface: memberLinks[i]?.targetInterface || DEFAULT_INTERFACE,
            },
            sim: {
              simNode: simNodeName,
              simNodeInterface: memberLinks[i]?.sourceInterface || `eth${i + 1}`,
            },
          });
        });

        const link: YamlLink = {
          name: edge.data?.esiLagName || `${sourceName}-esi-lag-${esiLagCounter++}`,
          endpoints,
        };
        if (memberLinks[0]?.template) {
          link.template = memberLinks[0].template;
        }
        esiLagLinks.push(link);
      } else {
        const endpoints: Array<{ local: { node: string; interface: string } }> = [];

        endpoints.push({
          local: {
            node: sourceName,
            interface: memberLinks[0]?.sourceInterface || DEFAULT_INTERFACE,
          },
        });

        esiLeaves.forEach((leaf, i) => {
          endpoints.push({
            local: {
              node: leaf.nodeName,
              interface: memberLinks[i]?.targetInterface || DEFAULT_INTERFACE,
            },
          });
        });

        const link: YamlLink = {
          name: edge.data?.esiLagName || `${sourceName}-esi-lag-${esiLagCounter++}`,
          endpoints,
        };
        if (memberLinks[0]?.template) {
          link.template = memberLinks[0].template;
        }
        esiLagLinks.push(link);
      }

      processedMultihomedEdgeIds.add(edge.id);
    }
  }

  for (const edge of edges) {
    if (processedMultihomedEdgeIds.has(edge.id)) {
      continue;
    }

    const sourceName = edge.data?.sourceNode || nodeIdToName.get(edge.source) || edge.source;
    const targetName = edge.data?.targetNode || nodeIdToName.get(edge.target) || edge.target;

    // Check if either endpoint is a sim node
    const sourceIsSimNode = edge.source.startsWith('sim-');
    const targetIsSimNode = edge.target.startsWith('sim-');

    const memberLinks = edge.data?.memberLinks || [];
    const lagGroups = edge.data?.lagGroups || [];

    const indicesInLags = new Set<number>();
    for (const lag of lagGroups) {
      for (const idx of lag.memberLinkIndices) {
        indicesInLags.add(idx);
      }
    }

    const createPosLabels = (memberIndex: number) => ({
      [LABEL_EDGE_ID]: edge.id,
      [LABEL_MEMBER_INDEX]: String(memberIndex),
      ...(edge.sourceHandle && { [LABEL_SRC_HANDLE]: edge.sourceHandle }),
      ...(edge.targetHandle && { [LABEL_DST_HANDLE]: edge.targetHandle }),
    });

    for (const lag of lagGroups) {
      const lagMemberLinks = lag.memberLinkIndices
        .filter(idx => idx >= 0 && idx < memberLinks.length)
        .map(idx => memberLinks[idx]);

      if (lagMemberLinks.length === 0) continue;

      const firstMemberIndex = lag.memberLinkIndices[0];

      let lagLink: YamlLink;

      if (sourceIsSimNode || targetIsSimNode) {
        const topoNodeName = sourceIsSimNode ? targetName : sourceName;
        const simNodeName = sourceIsSimNode
          ? (simNodeIdToName.get(edge.source) || sourceName)
          : (simNodeIdToName.get(edge.target) || targetName);

        lagLink = {
          name: lag.name,
          labels: createPosLabels(firstMemberIndex),
          endpoints: lagMemberLinks.map(member => ({
            local: {
              node: topoNodeName,
              interface: sourceIsSimNode
                ? (member.targetInterface || DEFAULT_INTERFACE)
                : (member.sourceInterface || DEFAULT_INTERFACE),
            },
            sim: {
              simNode: simNodeName,
              simNodeInterface: sourceIsSimNode
                ? (member.sourceInterface || DEFAULT_SIM_INTERFACE)
                : (member.targetInterface || DEFAULT_SIM_INTERFACE),
            },
          })),
        };
      } else {
        lagLink = {
          name: lag.name,
          labels: createPosLabels(firstMemberIndex),
          endpoints: [
            ...lagMemberLinks.map(member => ({
              local: {
                node: sourceName,
                interface: member.sourceInterface || DEFAULT_INTERFACE,
              },
            })),
            ...lagMemberLinks.map(member => ({
              local: {
                node: targetName,
                interface: member.targetInterface || DEFAULT_INTERFACE,
              },
            })),
          ],
        };
      }

      if (lag.template) {
        lagLink.template = lag.template;
      }

      islLinks.push(lagLink);
    }

    for (let i = 0; i < memberLinks.length; i++) {
      if (indicesInLags.has(i)) continue; // Skip links that are part of a LAG

      const member = memberLinks[i];

      // If connecting to a sim node, create an edge link with sim: endpoint
      if (targetIsSimNode) {
        const simNodeName = simNodeIdToName.get(edge.target) || edge.target;
        simLinks.push({
          name: member.name,
          template: member.template,
          labels: createPosLabels(i),
          endpoints: [{
            local: {
              node: sourceName,
              interface: member.sourceInterface || DEFAULT_INTERFACE,
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
        simLinks.push({
          name: member.name,
          template: member.template,
          labels: createPosLabels(i),
          endpoints: [{
            local: {
              node: targetName,
              interface: member.targetInterface || DEFAULT_INTERFACE,
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
          labels: createPosLabels(i),
          endpoints: [
            {
              local: {
                node: sourceName,
                interface: member.sourceInterface || DEFAULT_INTERFACE,
              },
              remote: {
                node: targetName,
                interface: member.targetInterface || DEFAULT_INTERFACE,
              },
            },
          ],
        };

        if (member.template) {
          link.template = member.template;
        }

        islLinks.push(link);
      }
    }
  }

  // Combine ISL links and sim edge links
  const allLinks = [...islLinks, ...simLinks, ...esiLagLinks];

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
      simNodes: simulation.simNodes?.map(({ position: _position, id: _id, labels: _labels, isNew: _isNew, ...rest }) => rest),
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
