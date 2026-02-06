import yaml from 'js-yaml';

import type {
  Topology,
  TopoNode,
  SimNode,
  Link,
  Endpoint,
  NodeTemplate,
  LinkTemplate,
  Operation,
} from '../../types/schema';
import type {
  UINode,
  UIEdge,
  UIMemberLink,
  UILagGroup,
  UIEsiLeaf,
  UISimulation,
} from '../../types/ui';
import {
  LABEL_POS_X,
  LABEL_POS_Y,
  LABEL_EDGE_ID,
  LABEL_MEMBER_INDEX,
  DEFAULT_INTERFACE,
  DEFAULT_SIM_INTERFACE,
} from '../constants';

import { asArray, fallbackIfEmptyString } from './shared';

// ============ UI → YAML Conversion ============

export interface UIToYamlOptions {
  topologyName: string;
  namespace: string;
  operation: Operation;
  nodes: UINode[];
  edges: UIEdge[];
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  simulation?: UISimulation;
}

/**
 * Convert UI state to YAML string.
 */
export function exportToYaml(options: UIToYamlOptions): string {
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

// if nodes are negative, calculate an offset to make the node positive
// and offset everything else by that so the topo layout stays the same.
export function normalizeNodeCoordinates<T extends { position: { x: number; y: number }; data: { nodeType?: string } }>(nodes: T[]): T[] {
  const topoNodes = nodes.filter(n => n.data.nodeType !== 'simnode');
  if (topoNodes.length === 0) return nodes;

  const minX = Math.min(...topoNodes.map(n => n.position.x));
  const minY = Math.min(...topoNodes.map(n => n.position.y));
  const offsetX = minX < 50 ? 50 - minX : 0;
  const offsetY = minY < 50 ? 50 - minY : 0;

  if (offsetX === 0 && offsetY === 0) return nodes;

  return nodes.map(n => ({ ...n, position: { x: n.position.x + offsetX, y: n.position.y + offsetY } }));
}

/**
 * Build CRD object from UI state.
 */
export function buildCrd(options: UIToYamlOptions): Topology {
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

  // Separate TopoNodes from SimNodes
  const topoNodes = nodes.filter(n => n.data.nodeType !== 'simnode');
  const simNodes = nodes.filter(n => n.data.nodeType === 'simnode');

  // Build node maps
  const nodeIdToName = new Map<string, string>();
  topoNodes.forEach(node => nodeIdToName.set(node.id, node.data.name));

  const simNodeIdToName = new Map<string, string>();
  simNodes.forEach(node => simNodeIdToName.set(node.id, node.data.name));

  // Convert TopoNodes
  const yamlNodes: TopoNode[] = topoNodes.map(node => {
    const labels: Record<string, string> = {};
    labels[LABEL_POS_X] = String(Math.round(node.position.x));
    labels[LABEL_POS_Y] = String(Math.round(node.position.y));

    const yamlNode: TopoNode = { name: node.data.name };

    if (node.data.template) {
      yamlNode.template = node.data.template;
    } else {
      if (node.data.platform) yamlNode.platform = node.data.platform;
      if (node.data.nodeProfile) yamlNode.nodeProfile = node.data.nodeProfile;
    }

    if (node.data.serialNumber) {
      yamlNode.serialNumber = node.data.serialNumber;
    }

    if (node.data.labels) {
      Object.assign(labels, node.data.labels);
    }

    yamlNode.labels = labels;
    return yamlNode;
  });

  // Convert edges to links
  const yamlLinks = uiEdgesToYamlLinks(edges, nodeIdToName, simNodeIdToName);

  // Build CRD
  const crd: Topology = {
    apiVersion: 'topologies.eda.nokia.com/v1alpha1',
    kind: 'NetworkTopology',
    metadata: {
      name: topologyName,
      namespace,
    },
    spec: {
      operation,
      nodeTemplates,
      nodes: yamlNodes,
      linkTemplates,
      links: yamlLinks,
    },
  };

  // Add simulation if needed
  // SimNodes don't get position labels in YAML output (unlike regular nodes)
  // The original converter stripped position, id, labels, and isNew from simNodes
  const exportSimNodes: SimNode[] = simNodes.map(node => {
    const simNode: SimNode = { name: node.data.name };

    // Only include user-provided labels, not position labels
    if (node.data.labels && Object.keys(node.data.labels).length > 0) {
      simNode.labels = node.data.labels;
    }
    if (node.data.template) simNode.template = node.data.template;
    if (node.data.simNodeType) simNode.type = node.data.simNodeType;
    if (node.data.image) simNode.image = node.data.image;

    return simNode;
  });

  const hasSimData = !!simulation && (
    (!!simulation.simNodeTemplates && simulation.simNodeTemplates.length > 0) ||
    (Array.isArray(simulation.topology) && simulation.topology.length > 0)
  );
  const hasSimNodes = exportSimNodes.length > 0;

  if (hasSimData || hasSimNodes) {
    crd.spec.simulation = {
      simNodeTemplates: simulation?.simNodeTemplates,
      // Always include simNodes array when simulation section exists (even if empty)
      simNodes: exportSimNodes,
      topology: Array.isArray(simulation?.topology) ? simulation.topology : undefined,
    };
  }

  return crd;
}

/**
 * Convert UI edges to YAML links.
 */
function uiEdgesToYamlLinks(
  edges: UIEdge[],
  nodeIdToName: Map<string, string>,
  simNodeIdToName: Map<string, string>,
): Link[] {
  const { links: esiLagLinks, processedIds } = collectEsiLagLinks({ edges, simNodeIdToName });

  const islLinks: Link[] = [];
  const simLinks: Link[] = [];

  for (const edge of edges) {
    if (processedIds.has(edge.id)) continue;

    const { islLinks: edgeIslLinks, simLinks: edgeSimLinks } = getLinksForNonEsiLagEdge({
      edge,
      nodeIdToName,
      simNodeIdToName,
    });

    islLinks.push(...edgeIslLinks);
    simLinks.push(...edgeSimLinks);
  }

  return [...islLinks, ...simLinks, ...esiLagLinks];
}

function getLinksForNonEsiLagEdge(options: {
  edge: UIEdge;
  nodeIdToName: Map<string, string>;
  simNodeIdToName: Map<string, string>;
}): { islLinks: Link[]; simLinks: Link[] } {
  const { edge, nodeIdToName, simNodeIdToName } = options;

  const { sourceName, targetName } = resolveEdgeNodeNames(edge, nodeIdToName);
  const sourceIsSimNode = isSimNodeId(edge.source);
  const targetIsSimNode = isSimNodeId(edge.target);

  const memberLinks = asArray<UIMemberLink>(edge.data?.memberLinks);
  const lagGroups = asArray<UILagGroup>(edge.data?.lagGroups);

  const indicesInLags = collectIndicesInLags(lagGroups);

  const lagLinks = buildLagLinksForEdge({
    edge,
    lagGroups,
    memberLinks,
    sourceName,
    targetName,
    sourceIsSimNode,
    targetIsSimNode,
    simNodeIdToName,
  });

  const unlagged = buildUnlaggedLinksForEdge({
    edge,
    memberLinks,
    indicesInLags,
    sourceName,
    targetName,
    sourceIsSimNode,
    targetIsSimNode,
    simNodeIdToName,
  });

  return {
    islLinks: [...lagLinks, ...unlagged.islLinks],
    simLinks: unlagged.simLinks,
  };
}

function buildLagLinksForEdge(options: {
  edge: UIEdge;
  lagGroups: UILagGroup[];
  memberLinks: UIMemberLink[];
  sourceName: string;
  targetName: string;
  sourceIsSimNode: boolean;
  targetIsSimNode: boolean;
  simNodeIdToName: Map<string, string>;
}): Link[] {
  const { edge, lagGroups, memberLinks, sourceName, targetName, sourceIsSimNode, targetIsSimNode, simNodeIdToName } = options;

  const links: Link[] = [];

  for (const lag of lagGroups) {
    const lagLink = buildLagLinkFromGroup({
      edge,
      lag,
      memberLinks,
      sourceName,
      targetName,
      sourceIsSimNode,
      targetIsSimNode,
      simNodeIdToName,
    });
    if (lagLink) links.push(lagLink);
  }

  return links;
}

function buildUnlaggedLinksForEdge(options: {
  edge: UIEdge;
  memberLinks: UIMemberLink[];
  indicesInLags: Set<number>;
  sourceName: string;
  targetName: string;
  sourceIsSimNode: boolean;
  targetIsSimNode: boolean;
  simNodeIdToName: Map<string, string>;
}): { islLinks: Link[]; simLinks: Link[] } {
  const {
    edge,
    memberLinks,
    indicesInLags,
    sourceName,
    targetName,
    sourceIsSimNode,
    targetIsSimNode,
    simNodeIdToName,
  } = options;

  const unlaggedMembers = collectUnlaggedMemberLinks(memberLinks, indicesInLags);

  if (targetIsSimNode) {
    const simNodeName = resolveSimNodeNameOrId(simNodeIdToName, edge.target);
    const simLinks: Link[] = [];
    for (const { index, member } of unlaggedMembers) {
      simLinks.push(buildSimMemberLinkWithTargetSim({ edge, sourceName, simNodeName, member, memberIndex: index }));
    }
    return { islLinks: [], simLinks };
  }

  if (sourceIsSimNode) {
    const simNodeName = resolveSimNodeNameOrId(simNodeIdToName, edge.source);
    const simLinks: Link[] = [];
    for (const { index, member } of unlaggedMembers) {
      simLinks.push(buildSimMemberLinkWithSourceSim({ edge, targetName, simNodeName, member, memberIndex: index }));
    }
    return { islLinks: [], simLinks };
  }

  const islLinks: Link[] = [];
  for (const { index, member } of unlaggedMembers) {
    islLinks.push(buildIslMemberLink({ edge, sourceName, targetName, member, memberIndex: index }));
  }

  return { islLinks, simLinks: [] };
}

// ============ ESI-LAG Processing ============

function createPosLabels(edge: Pick<UIEdge, 'id'>, memberIndex: number): Record<string, string> {
  return {
    [LABEL_EDGE_ID]: edge.id,
    [LABEL_MEMBER_INDEX]: String(memberIndex),
  };
}

function isSimNodeId(nodeId: string): boolean {
  return nodeId.startsWith('sim-');
}

function resolveEdgeNodeName(
  explicitName: unknown,
  mappedName: string | undefined,
  fallbackName: string,
): string {
  if (typeof explicitName === 'string' && explicitName) return explicitName;
  if (mappedName) return mappedName;
  return fallbackName;
}

function resolveEdgeNodeNames(edge: UIEdge, nodeIdToName: Map<string, string>): { sourceName: string; targetName: string } {
  return {
    sourceName: resolveEdgeNodeName(edge.data?.sourceNode, nodeIdToName.get(edge.source), edge.source),
    targetName: resolveEdgeNodeName(edge.data?.targetNode, nodeIdToName.get(edge.target), edge.target),
  };
}

function resolveSimNodeNameOrFallback(
  simNodeIdToName: Map<string, string>,
  simNodeId: string,
  fallbackName: string,
): string {
  const resolved = simNodeIdToName.get(simNodeId);
  if (resolved) return resolved;
  return fallbackName;
}

function resolveSimNodeNameOrId(simNodeIdToName: Map<string, string>, simNodeId: string): string {
  const resolved = simNodeIdToName.get(simNodeId);
  if (resolved) return resolved;
  return simNodeId;
}

function getEsiLagLinkName(options: {
  edge: UIEdge;
  sourceName: string;
  counter: number;
}): { name: string; nextCounter: number } {
  const { edge, sourceName, counter } = options;

  const explicitName = edge.data?.esiLagName;
  if (explicitName) return { name: explicitName, nextCounter: counter };

  return {
    name: `${sourceName}-esi-lag-${counter}`,
    nextCounter: counter + 1,
  };
}

function buildEsiLagEndpointsForSimSource(options: {
  esiLeaves: UIEsiLeaf[];
  memberLinks: UIMemberLink[];
  simNodeName: string;
}): Endpoint[] {
  const { esiLeaves, memberLinks, simNodeName } = options;

  const endpoints: Endpoint[] = [];

  for (let i = 0; i < esiLeaves.length; i++) {
    const leaf = esiLeaves[i];
    const member = memberLinks[i];

    endpoints.push({
      local: {
        node: leaf.nodeName,
        interface: fallbackIfEmptyString(member?.targetInterface, DEFAULT_INTERFACE),
      },
      sim: {
        simNode: simNodeName,
        simNodeInterface: fallbackIfEmptyString(member?.sourceInterface, `eth${i + 1}`),
      },
    });
  }

  return endpoints;
}

function buildEsiLagEndpointsForTopoSource(options: {
  sourceName: string;
  esiLeaves: UIEsiLeaf[];
  memberLinks: UIMemberLink[];
}): Endpoint[] {
  const { sourceName, esiLeaves, memberLinks } = options;

  const endpoints: Endpoint[] = [
    {
      local: {
        node: sourceName,
        interface: fallbackIfEmptyString(memberLinks[0]?.sourceInterface, DEFAULT_INTERFACE),
      },
    },
  ];

  for (let i = 0; i < esiLeaves.length; i++) {
    const leaf = esiLeaves[i];
    const member = memberLinks[i];
    endpoints.push({
      local: {
        node: leaf.nodeName,
        interface: fallbackIfEmptyString(member?.targetInterface, DEFAULT_INTERFACE),
      },
    });
  }

  return endpoints;
}

function collectEsiLagLinks(options: {
  edges: UIEdge[];
  simNodeIdToName: Map<string, string>;
}): { links: Link[]; processedIds: Set<string> } {
  const { edges, simNodeIdToName } = options;

  const links: Link[] = [];
  const processedIds = new Set<string>();
  let counter = 1;

  for (const edge of edges) {
    if (edge.data?.edgeType !== 'esilag') continue;

    const esiLeaves = asArray<UIEsiLeaf>(edge.data?.esiLeaves);
    if (esiLeaves.length === 0) continue;

    const sourceName = edge.data?.sourceNode;
    if (!sourceName) continue;

    const memberLinks = asArray<UIMemberLink>(edge.data?.memberLinks);

    const { name, nextCounter } = getEsiLagLinkName({ edge, sourceName, counter });
    counter = nextCounter;

    let endpoints: Endpoint[];
    if (isSimNodeId(edge.source)) {
      endpoints = buildEsiLagEndpointsForSimSource({
        esiLeaves,
        memberLinks,
        simNodeName: resolveSimNodeNameOrFallback(simNodeIdToName, edge.source, sourceName),
      });
    } else {
      endpoints = buildEsiLagEndpointsForTopoSource({ sourceName, esiLeaves, memberLinks });
    }

    const link: Link = {
      name,
      labels: memberLinks[0]?.labels,
      endpoints,
    };

    const template = memberLinks[0]?.template;
    if (template) link.template = template;

    links.push(link);
    processedIds.add(edge.id);
  }

  return { links, processedIds };
}

// ============ LAG Helpers ============

function collectIndicesInLags(lagGroups: UILagGroup[]): Set<number> {
  const indices = new Set<number>();
  for (const lag of lagGroups) {
    for (const idx of lag.memberLinkIndices) {
      indices.add(idx);
    }
  }
  return indices;
}

function getLagMemberLinks(lag: UILagGroup, memberLinks: UIMemberLink[]): UIMemberLink[] {
  const lagMemberLinks: UIMemberLink[] = [];

  for (const idx of lag.memberLinkIndices) {
    if (idx < 0) continue;
    if (idx >= memberLinks.length) continue;
    lagMemberLinks.push(memberLinks[idx]);
  }

  return lagMemberLinks;
}

function buildLagLinkForSimOnSource(options: {
  edge: UIEdge;
  lag: UILagGroup;
  lagMemberLinks: UIMemberLink[];
  firstMemberIndex: number;
  targetName: string;
  sourceName: string;
  simNodeIdToName: Map<string, string>;
}): Link {
  const { edge, lag, lagMemberLinks, firstMemberIndex, targetName, sourceName, simNodeIdToName } = options;

  const topoNodeName = targetName;
  const simNodeName = resolveSimNodeNameOrFallback(simNodeIdToName, edge.source, sourceName);

  return {
    name: lag.name,
    labels: { ...lag.labels, ...createPosLabels(edge, firstMemberIndex) },
    endpoints: lagMemberLinks.map(member => ({
      local: {
        node: topoNodeName,
        interface: fallbackIfEmptyString(member.targetInterface, DEFAULT_INTERFACE),
      },
      sim: {
        simNode: simNodeName,
        simNodeInterface: fallbackIfEmptyString(member.sourceInterface, DEFAULT_SIM_INTERFACE),
      },
    })),
  };
}

function buildLagLinkForSimOnTarget(options: {
  edge: UIEdge;
  lag: UILagGroup;
  lagMemberLinks: UIMemberLink[];
  firstMemberIndex: number;
  sourceName: string;
  targetName: string;
  simNodeIdToName: Map<string, string>;
}): Link {
  const { edge, lag, lagMemberLinks, firstMemberIndex, sourceName, targetName, simNodeIdToName } = options;

  const topoNodeName = sourceName;
  const simNodeName = resolveSimNodeNameOrFallback(simNodeIdToName, edge.target, targetName);

  return {
    name: lag.name,
    labels: { ...lag.labels, ...createPosLabels(edge, firstMemberIndex) },
    endpoints: lagMemberLinks.map(member => ({
      local: {
        node: topoNodeName,
        interface: fallbackIfEmptyString(member.sourceInterface, DEFAULT_INTERFACE),
      },
      sim: {
        simNode: simNodeName,
        simNodeInterface: fallbackIfEmptyString(member.targetInterface, DEFAULT_SIM_INTERFACE),
      },
    })),
  };
}

function buildLagLinkForTopoOnly(options: {
  edge: UIEdge;
  lag: UILagGroup;
  lagMemberLinks: UIMemberLink[];
  firstMemberIndex: number;
  sourceName: string;
  targetName: string;
}): Link {
  const { edge, lag, lagMemberLinks, firstMemberIndex, sourceName, targetName } = options;

  const endpoints: Endpoint[] = [];

  for (const member of lagMemberLinks) {
    endpoints.push({
      local: {
        node: sourceName,
        interface: fallbackIfEmptyString(member.sourceInterface, DEFAULT_INTERFACE),
      },
    });
  }

  for (const member of lagMemberLinks) {
    endpoints.push({
      local: {
        node: targetName,
        interface: fallbackIfEmptyString(member.targetInterface, DEFAULT_INTERFACE),
      },
    });
  }

  return {
    name: lag.name,
    labels: { ...lag.labels, ...createPosLabels(edge, firstMemberIndex) },
    endpoints,
  };
}

function buildLagLinkFromGroup(options: {
  edge: UIEdge;
  lag: UILagGroup;
  memberLinks: UIMemberLink[];
  sourceName: string;
  targetName: string;
  sourceIsSimNode: boolean;
  targetIsSimNode: boolean;
  simNodeIdToName: Map<string, string>;
}): Link | null {
  const { edge, lag, memberLinks, sourceName, targetName, sourceIsSimNode, targetIsSimNode, simNodeIdToName } = options;

  const lagMemberLinks = getLagMemberLinks(lag, memberLinks);
  if (lagMemberLinks.length === 0) return null;

  const firstMemberIndex = lag.memberLinkIndices[0];

  let lagLink: Link;
  if (sourceIsSimNode || targetIsSimNode) {
    if (sourceIsSimNode) {
      lagLink = buildLagLinkForSimOnSource({
        edge,
        lag,
        lagMemberLinks,
        firstMemberIndex,
        targetName,
        sourceName,
        simNodeIdToName,
      });
    } else {
      lagLink = buildLagLinkForSimOnTarget({
        edge,
        lag,
        lagMemberLinks,
        firstMemberIndex,
        sourceName,
        targetName,
        simNodeIdToName,
      });
    }
  } else {
    lagLink = buildLagLinkForTopoOnly({
      edge,
      lag,
      lagMemberLinks,
      firstMemberIndex,
      sourceName,
      targetName,
    });
  }

  if (lag.template) lagLink.template = lag.template;
  return lagLink;
}

// ============ Member Link Helpers ============

function collectUnlaggedMemberLinks(
  memberLinks: UIMemberLink[],
  indicesInLags: Set<number>,
): Array<{ index: number; member: UIMemberLink }> {
  const results: Array<{ index: number; member: UIMemberLink }> = [];

  for (let i = 0; i < memberLinks.length; i++) {
    if (indicesInLags.has(i)) continue;
    results.push({ index: i, member: memberLinks[i] });
  }

  return results;
}

function buildSimMemberLinkWithTargetSim(options: {
  edge: UIEdge;
  sourceName: string;
  simNodeName: string;
  member: UIMemberLink;
  memberIndex: number;
}): Link {
  const { edge, sourceName, simNodeName, member, memberIndex } = options;

  return {
    name: member.name,
    template: member.template,
    labels: { ...member.labels, ...createPosLabels(edge, memberIndex) },
    endpoints: [
      {
        local: {
          node: sourceName,
          interface: fallbackIfEmptyString(member.sourceInterface, DEFAULT_INTERFACE),
        },
        sim: {
          simNode: simNodeName,
          simNodeInterface: member.targetInterface,
        },
      },
    ],
  };
}

function buildSimMemberLinkWithSourceSim(options: {
  edge: UIEdge;
  targetName: string;
  simNodeName: string;
  member: UIMemberLink;
  memberIndex: number;
}): Link {
  const { edge, targetName, simNodeName, member, memberIndex } = options;

  return {
    name: member.name,
    template: member.template,
    labels: { ...member.labels, ...createPosLabels(edge, memberIndex) },
    endpoints: [
      {
        local: {
          node: targetName,
          interface: fallbackIfEmptyString(member.targetInterface, DEFAULT_INTERFACE),
        },
        sim: {
          simNode: simNodeName,
          simNodeInterface: member.sourceInterface,
        },
      },
    ],
  };
}

function buildIslMemberLink(options: {
  edge: UIEdge;
  sourceName: string;
  targetName: string;
  member: UIMemberLink;
  memberIndex: number;
}): Link {
  const { edge, sourceName, targetName, member, memberIndex } = options;

  const link: Link = {
    name: member.name,
    labels: { ...member.labels, ...createPosLabels(edge, memberIndex) },
    endpoints: [
      {
        local: {
          node: sourceName,
          interface: fallbackIfEmptyString(member.sourceInterface, DEFAULT_INTERFACE),
        },
        remote: {
          node: targetName,
          interface: fallbackIfEmptyString(member.targetInterface, DEFAULT_INTERFACE),
        },
      },
    ],
  };

  if (member.template) link.template = member.template;
  return link;
}

/**
 * Download YAML content as a file.
 */
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
