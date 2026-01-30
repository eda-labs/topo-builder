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

export interface ExportOptions {
  topologyName: string;
  namespace: string;
  operation: Operation;
  nodes: Node<TopologyNodeData>[];
  edges: Edge<TopologyEdgeData>[];
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  simulation?: Simulation;
}

export interface YamlLink {
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

export interface NetworkTopologyCrd {
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
    simulation?: SimulationCrd;
  };
}

type SimNodeCrd = Omit<Simulation['simNodes'][number], 'id' | 'position' | 'labels' | 'isNew'>;
type SimulationCrd = Omit<Simulation, 'simNodes'> & { simNodes?: SimNodeCrd[] };

function buildNodeIdToName(nodes: Node<TopologyNodeData>[]) {
  const nodeIdToName = new Map<string, string>();
  nodes.forEach((node) => {
    nodeIdToName.set(node.id, node.data.name);
  });
  return nodeIdToName;
}

function buildSimNodeIdToName(simulation?: Simulation) {
  const simNodeIdToName = new Map<string, string>();
  simulation?.simNodes?.forEach((simNode) => {
    simNodeIdToName.set(simNode.id, simNode.name);
  });
  return simNodeIdToName;
}

function buildNetworkNodes(nodes: Node<TopologyNodeData>[]): NetworkNode[] {
  return nodes.map((node) => {
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
    }

    if (node.data.labels) {
      Object.assign(labels, node.data.labels);
    }

    networkNode.labels = labels;
    return networkNode;
  });
}

function buildEsiLagName(sourceName: string, edge: Edge<TopologyEdgeData>, counter: number) {
  return edge.data?.esiLagName || `${sourceName}-esi-lag-${counter}`;
}

function buildSimEsiLagEndpoints(
  edge: Edge<TopologyEdgeData>,
  sourceName: string,
  memberLinks: TopologyEdgeData['memberLinks'],
  esiLeaves: NonNullable<TopologyEdgeData['esiLeaves']>,
  simNodeIdToName: Map<string, string>,
) {
  const simNodeName = simNodeIdToName.get(edge.source) || sourceName;
  return esiLeaves.map((leaf, i) => ({
    local: {
      node: leaf.nodeName,
      interface: memberLinks?.[i]?.targetInterface || DEFAULT_INTERFACE,
    },
    sim: {
      simNode: simNodeName,
      simNodeInterface: memberLinks?.[i]?.sourceInterface || `eth${i + 1}`,
    },
  }));
}

function buildTopoEsiLagEndpoints(
  sourceName: string,
  memberLinks: TopologyEdgeData['memberLinks'],
  esiLeaves: NonNullable<TopologyEdgeData['esiLeaves']>,
) {
  const endpoints: Array<{ local: { node: string; interface: string } }> = [{
    local: {
      node: sourceName,
      interface: memberLinks?.[0]?.sourceInterface || DEFAULT_INTERFACE,
    },
  }];

  esiLeaves.forEach((leaf, i) => {
    endpoints.push({
      local: {
        node: leaf.nodeName,
        interface: memberLinks?.[i]?.targetInterface || DEFAULT_INTERFACE,
      },
    });
  });

  return endpoints;
}

function createEsiLagLink(
  name: string,
  memberLinks: TopologyEdgeData['memberLinks'],
  endpoints: YamlLink['endpoints'],
) {
  const link: YamlLink = {
    name,
    labels: memberLinks?.[0]?.labels,
    endpoints,
  };
  if (memberLinks?.[0]?.template) {
    link.template = memberLinks[0].template;
  }
  return link;
}

function buildEsiLagLinks(edges: Edge<TopologyEdgeData>[], simNodeIdToName: Map<string, string>) {
  const esiLagLinks: YamlLink[] = [];
  const processedMultihomedEdgeIds = new Set<string>();
  let esiLagCounter = 1;

  for (const edge of edges) {
    if (!edge.data?.isMultihomed || !edge.data.esiLeaves?.length) continue;

    const sourceName = edge.data.sourceNode;
    const esiLeaves = edge.data.esiLeaves;
    const memberLinks = edge.data.memberLinks || [];
    const sourceIsSimNode = edge.source.startsWith('sim-');
    const name = buildEsiLagName(sourceName, edge, esiLagCounter++);

    const endpoints = sourceIsSimNode
      ? buildSimEsiLagEndpoints(edge, sourceName, memberLinks, esiLeaves, simNodeIdToName)
      : buildTopoEsiLagEndpoints(sourceName, memberLinks, esiLeaves);

    esiLagLinks.push(createEsiLagLink(name, memberLinks, endpoints));
    processedMultihomedEdgeIds.add(edge.id);
  }

  return { esiLagLinks, processedMultihomedEdgeIds };
}

function createPosLabels(edge: Edge<TopologyEdgeData>, memberIndex: number) {
  return {
    [LABEL_EDGE_ID]: edge.id,
    [LABEL_MEMBER_INDEX]: String(memberIndex),
    ...(edge.sourceHandle && { [LABEL_SRC_HANDLE]: edge.sourceHandle }),
    ...(edge.targetHandle && { [LABEL_DST_HANDLE]: edge.targetHandle }),
  };
}

function buildLagLinks(params: {
  edge: Edge<TopologyEdgeData>;
  lagGroups: TopologyEdgeData['lagGroups'];
  memberLinks: TopologyEdgeData['memberLinks'];
  sourceName: string;
  targetName: string;
  sourceIsSimNode: boolean;
  targetIsSimNode: boolean;
  simNodeIdToName: Map<string, string>;
}) {
  const {
    edge,
    lagGroups,
    memberLinks,
    sourceName,
    targetName,
    sourceIsSimNode,
    targetIsSimNode,
    simNodeIdToName,
  } = params;

  const islLinks: YamlLink[] = [];

  for (const lag of lagGroups || []) {
    const lagMemberLinks = lag.memberLinkIndices
      .filter(idx => idx >= 0 && idx < (memberLinks?.length || 0))
      .map(idx => memberLinks![idx]);

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
        labels: { ...lag.labels, ...createPosLabels(edge, firstMemberIndex) },
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
        labels: { ...lag.labels, ...createPosLabels(edge, firstMemberIndex) },
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

  return islLinks;
}

function buildMemberLinks(params: {
  edge: Edge<TopologyEdgeData>;
  memberLinks: TopologyEdgeData['memberLinks'];
  indicesInLags: Set<number>;
  sourceName: string;
  targetName: string;
  sourceIsSimNode: boolean;
  targetIsSimNode: boolean;
  simNodeIdToName: Map<string, string>;
}) {
  const {
    edge,
    memberLinks,
    indicesInLags,
    sourceName,
    targetName,
    sourceIsSimNode,
    targetIsSimNode,
    simNodeIdToName,
  } = params;

  const islLinks: YamlLink[] = [];
  const simLinks: YamlLink[] = [];

  for (let i = 0; i < (memberLinks?.length || 0); i++) {
    if (indicesInLags.has(i)) continue;

    const member = memberLinks![i];

    if (targetIsSimNode) {
      const simNodeName = simNodeIdToName.get(edge.target) || edge.target;
      simLinks.push({
        name: member.name,
        template: member.template,
        labels: { ...member.labels, ...createPosLabels(edge, i) },
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
      const simNodeName = simNodeIdToName.get(edge.source) || edge.source;
      simLinks.push({
        name: member.name,
        template: member.template,
        labels: { ...member.labels, ...createPosLabels(edge, i) },
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
      const link: YamlLink = {
        name: member.name,
        labels: { ...member.labels, ...createPosLabels(edge, i) },
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

  return { islLinks, simLinks };
}

function buildStandardLinks(params: {
  edges: Edge<TopologyEdgeData>[];
  processedMultihomedEdgeIds: Set<string>;
  nodeIdToName: Map<string, string>;
  simNodeIdToName: Map<string, string>;
}) {
  const { edges, processedMultihomedEdgeIds, nodeIdToName, simNodeIdToName } = params;
  const islLinks: YamlLink[] = [];
  const simLinks: YamlLink[] = [];

  for (const edge of edges) {
    if (processedMultihomedEdgeIds.has(edge.id)) continue;

    const sourceName = edge.data?.sourceNode || nodeIdToName.get(edge.source) || edge.source;
    const targetName = edge.data?.targetNode || nodeIdToName.get(edge.target) || edge.target;

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

    const lagLinks = buildLagLinks({
      edge,
      lagGroups,
      memberLinks,
      sourceName,
      targetName,
      sourceIsSimNode,
      targetIsSimNode,
      simNodeIdToName,
    });
    islLinks.push(...lagLinks);

    const memberLinkResults = buildMemberLinks({
      edge,
      memberLinks,
      indicesInLags,
      sourceName,
      targetName,
      sourceIsSimNode,
      targetIsSimNode,
      simNodeIdToName,
    });
    islLinks.push(...memberLinkResults.islLinks);
    simLinks.push(...memberLinkResults.simLinks);
  }

  return { islLinks, simLinks };
}

function shouldIncludeSimulation(simulation?: Simulation) {
  if (!simulation) return false;
  return (
    (simulation.simNodeTemplates && simulation.simNodeTemplates.length > 0) ||
    (simulation.simNodes && simulation.simNodes.length > 0) ||
    (simulation.topology && Array.isArray(simulation.topology) && simulation.topology.length > 0)
  );
}

function cleanSimulation(simulation: Simulation): SimulationCrd {
  return {
    ...simulation,
    simNodes: simulation.simNodes?.map(({ position: _position, id: _id, labels: _labels, isNew: _isNew, ...rest }) => rest),
  };
}

export function buildCrd(options: ExportOptions): NetworkTopologyCrd {
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

  const nodeIdToName = buildNodeIdToName(nodes);
  const simNodeIdToName = buildSimNodeIdToName(simulation);
  const networkNodes = buildNetworkNodes(nodes);

  const { esiLagLinks, processedMultihomedEdgeIds } = buildEsiLagLinks(edges, simNodeIdToName);
  const { islLinks, simLinks } = buildStandardLinks({
    edges,
    processedMultihomedEdgeIds,
    nodeIdToName,
    simNodeIdToName,
  });

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
  if (shouldIncludeSimulation(simulation)) {
    crd.spec.simulation = cleanSimulation(simulation!);
  }

  return crd;
}

export function exportToYaml(options: ExportOptions): string {
  const crd = buildCrd(options);
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
