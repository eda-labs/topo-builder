import yaml from 'js-yaml';

import type {
  TopoNode,
  SimNode,
  SimNodeTemplate,
  Simulation,
  Link,
  Endpoint,
  NodeTemplate,
  LinkTemplate,
  ParsedTopology,
} from '../../types/schema';
import { getSchemaEnums } from '../schemaEnums';
import type {
  UINode,
  UIEdge,
  UIEdgeLink,
  UIMemberLink,
  UILagGroup,
  UIEsiLeaf,
  UISimulation,
  UIAnnotation,
} from '../../types/ui';
import { DEFAULT_INTERFACE, ANNOTATION_DRAWING, ANNOTATION_BREAKOUTS } from '../constants';
import { deriveBreakoutsFromComponents } from '../connectors';
import { isSrosNode } from '../interfaces';
import { parseBreakouts, portAddressForInterface, resolveNodePanel } from '../frontpanel';

import { generateUniqueName } from '../utils';
import { collapseBreakoutVariants, harvestTemplateBreakouts } from './breakoutTemplates';
import {
  asArray,
  extractPosition,
  extractHandles,
  fallbackIfEmptyString,
  filterUserLabels,
  generateEdgeId,
  generateExternalNodeId,
  generateNodeId,
  generateSimNodeId,
  parseYamlEndpoint,
  type ParsedEndpoint,
} from './shared';

// ============ YAML → UI Conversion ============

export interface YamlToUIOptions {
  existingNodes?: UINode[];
  existingEdges?: UIEdge[];
}

export interface YamlToUIResult {
  topologyName: string;
  namespace: string;
  operation: string;
  nodeTemplates: NodeTemplate[];
  linkTemplates: LinkTemplate[];
  nodes: UINode[];
  edges: UIEdge[];
  simulation: UISimulation;
  annotations: UIAnnotation[];
}

function buildEmptyYamlToUIResult(): YamlToUIResult {
  return {
    topologyName: 'my-topology',
    namespace: 'eda',
    operation: getSchemaEnums().defaultOperation,
    nodeTemplates: [],
    linkTemplates: [],
    nodes: [],
    edges: [],
    simulation: { simNodeTemplates: [] },
    annotations: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function indexExistingNodesById(existingNodes: UINode[]): Map<string, UINode> {
  const map = new Map<string, UINode>();
  for (const node of existingNodes) {
    map.set(node.id, node);
  }
  return map;
}

function buildNodeNameToIdMap(existingNodes: UINode[]): Map<string, string> {
  const nodeNameToId = new Map<string, string>();
  for (const node of existingNodes) {
    nodeNameToId.set(node.data.name, node.id);
  }
  return nodeNameToId;
}

function buildSimNodeNameToIdMap(existingNodes: UINode[]): Map<string, string> {
  const simNodeNameToId = new Map<string, string>();

  for (const node of existingNodes) {
    if (node.data.nodeType === 'simnode') {
      simNodeNameToId.set(node.data.name, node.id);
    }
  }

  return simNodeNameToId;
}

function resolvePosition(
  positionFromLabels: { x: number; y: number } | null,
  existingPosition: { x: number; y: number } | null | undefined,
  fallbackPosition: { x: number; y: number },
): { x: number; y: number } {
  if (positionFromLabels) return positionFromLabels;
  if (existingPosition) return existingPosition;
  return fallbackPosition;
}

function defaultTopoNodePosition(index: number): { x: number; y: number } {
  return { x: 100 + (index % 4) * 200, y: 100 + Math.floor(index / 4) * 150 };
}

function defaultSimNodePosition(index: number): { x: number; y: number } {
  return { x: 400 + (index % 3) * 180, y: 50 + Math.floor(index / 3) * 140 };
}

function buildNodeTemplateMap(nodeTemplates: NodeTemplate[]): Map<string, NodeTemplate> {
  const map = new Map<string, NodeTemplate>();
  for (const template of nodeTemplates) {
    map.set(template.name, template);
  }
  return map;
}

function resolvePlatformAndProfile(
  node: TopoNode,
  nodeTemplateMap: Map<string, NodeTemplate>,
): { platform?: string; nodeProfile?: string } {
  let platform = node.platform;
  let nodeProfile = node.nodeProfile;

  const templateName = node.template;
  if (!templateName) return { platform, nodeProfile };

  const template = nodeTemplateMap.get(templateName);
  if (!template) return { platform, nodeProfile };

  if (!platform) {
    if (template.platform) platform = template.platform;
  }
  if (!nodeProfile) {
    if (template.nodeProfile) nodeProfile = template.nodeProfile;
  }

  return { platform, nodeProfile };
}

function parseYamlMetadata(parsed: ParsedTopology): { topologyName: string; namespace: string; operation: string } {
  const topologyName = fallbackIfEmptyString(parsed.metadata?.name, 'my-topology');
  const namespace = fallbackIfEmptyString(parsed.metadata?.namespace, 'eda');
  const operation = fallbackIfEmptyString(parsed.spec?.operation, getSchemaEnums().defaultOperation);
  return { topologyName, namespace, operation };
}

function parseYamlTopoNodes(options: {
  topoNodes: TopoNode[];
  existingNodesById: Map<string, UINode>;
  nodeNameToId: Map<string, string>;
  nodeTemplateMap: Map<string, NodeTemplate>;
}): { nodes: UINode[]; nameToId: Map<string, string> } {
  const { topoNodes, existingNodesById, nodeNameToId, nodeTemplateMap } = options;

  const nodes: UINode[] = [];
  const nameToId = new Map<string, string>();

  for (let index = 0; index < topoNodes.length; index++) {
    const node = topoNodes[index];

    const existingId = nodeNameToId.get(node.name);
    const existingNode = existingId ? existingNodesById.get(existingId) : undefined;

    let id = existingId;
    if (!id) id = generateNodeId();
    nameToId.set(node.name, id);

    const positionFromLabels = extractPosition(node.annotations);
    const position = resolvePosition(positionFromLabels, existingNode?.position, defaultTopoNodePosition(index));

    const { platform, nodeProfile } = resolvePlatformAndProfile(node, nodeTemplateMap);
    const userLabels = filterUserLabels(node.labels);
    const parsedBreakouts = parseBreakouts(node.annotations?.[ANNOTATION_BREAKOUTS]);

    nodes.push({
      id,
      type: 'topoNode',
      position,
      data: {
        id,
        name: node.name,
        nodeType: 'node',
        platform,
        template: node.template,
        serialNumber: node.serialNumber,
        productionAddress: node.productionAddress,
        nodeProfile,
        labels: userLabels,
        breakouts: parsedBreakouts?.breakouts,
        breakoutSpeeds: parsedBreakouts?.breakoutSpeeds,
        components: node.components?.length ? node.components : undefined,
      },
    });
  }

  return { nodes, nameToId };
}

function getExistingSimNodePosition(
  existingId: string,
  existingNodesById: Map<string, UINode>,
): { x: number; y: number } | undefined {
  return existingNodesById.get(existingId)?.position;
}

function parseYamlSimulation(options: {
  simData: Simulation | undefined;
  existingNodesById: Map<string, UINode>;
  simNodeNameToId: Map<string, string>;
  nameToId: Map<string, string>;
}): { simNodeTemplates: SimNodeTemplate[]; simNodeNodes: UINode[]; topology: unknown[] | undefined; topologies: unknown[] | undefined } {
  const { simData, existingNodesById, simNodeNameToId, nameToId } = options;

  const simNodeTemplates = asArray<SimNodeTemplate>(simData?.simNodeTemplates);
  const simNodes = asArray<SimNode>(simData?.simNodes);

  const simNodeNodes: UINode[] = [];

  for (let index = 0; index < simNodes.length; index++) {
    const simNode = simNodes[index];

    const existingId = simNodeNameToId.get(simNode.name);
    const existingPosition = existingId
      ? getExistingSimNodePosition(existingId, existingNodesById)
      : undefined;

    let id = existingId;
    if (!id) id = generateSimNodeId();
    nameToId.set(simNode.name, id);

    const positionFromLabels = extractPosition(simNode.annotations);
    const position = resolvePosition(positionFromLabels, existingPosition, defaultSimNodePosition(index));

    const userLabels = filterUserLabels(simNode.labels);

    simNodeNodes.push({
      id,
      type: 'simNode',
      position,
      data: {
        id,
        name: simNode.name,
        nodeType: 'simnode',
        template: simNode.template,
        simNodeType: simNode.type,
        image: simNode.image,
        labels: userLabels,
      },
    });
  }

  return {
    simNodeTemplates,
    simNodeNodes,
    topology: simData?.topology,
    topologies: simData?.topologies,
  };
}

// SR Linux breakout channel interface: ethernet-<lc>-<port>-<channel> (three numeric segments).
const SRL_CHANNEL_RE = /^ethernet-\d+-(\d+)-(\d+)$/;

/**
 * A channelised interface on a link implies its cage is broken out, even when the breakout
 * annotation/template is absent (hand-written YAML). Infer a sensible channel count so the
 * front panel renders the cage split. On SR OS, channel 1 also exists on plain c1 connectors
 * ("ethernet-1-a-3-1"), so only channels >= 2 imply a breakout there.
 */
function inferBreakoutsFromEdges(nodes: UINode[], edges: UIEdge[], nodeTemplates: NodeTemplate[]): void {
  const nodesById = new Map(nodes.map(n => [n.id, n]));
  const note = (nodeId: string, iface: string | undefined) => {
    if (!iface) return;
    const node = nodesById.get(nodeId);
    if (!node || node.data.nodeType === 'simnode') return;

    const sros = isSrosNode(node, nodeTemplates);
    const panel = resolveNodePanel(node.data, nodeTemplates);
    let cage: string;
    let channel: number;
    if (panel) {
      const address = portAddressForInterface(iface, panel.meta);
      if (!address?.channel || !panel.meta.layout.some(p => p.p === address.cage)) return;
      cage = address.cage;
      channel = address.channel;
    } else {
      const match = SRL_CHANNEL_RE.exec(iface);
      if (!match) return;
      cage = match[1];
      channel = Number(match[2]);
    }
    if (sros && channel < 2) return;

    let needed = 10;
    if (channel <= 2) needed = 2;
    else if (channel <= 4) needed = 4;
    else if (channel <= 8) needed = 8;
    const breakouts = node.data.breakouts ?? {};
    if ((breakouts[cage] ?? 0) >= needed) return;
    node.data.breakouts = { ...breakouts, [cage]: needed };
  };
  for (const edge of edges) {
    const members = asArray<UIMemberLink>(edge.data?.memberLinks);
    // ESI-LAG members fan out to a different leaf node each; plain edges share one target.
    const esiLeaves = edge.data?.edgeType === 'esilag' ? asArray<UIEsiLeaf>(edge.data?.esiLeaves) : null;
    members.forEach((member, index) => {
      note(edge.source, member.sourceInterface);
      note(esiLeaves ? esiLeaves[index]?.nodeId ?? '' : edge.target, member.targetInterface);
    });
  }
  for (const node of nodes) {
    for (const edgeLink of node.data.edgeLinks ?? []) {
      note(node.id, edgeLink.interface);
    }
  }
}

/**
 * Convert YAML string to UI state.
 */
export function yamlToUI(yamlString: string, options: YamlToUIOptions = {}): YamlToUIResult | null {
  try {
    const trimmed = yamlString.trim();
    if (!trimmed) return buildEmptyYamlToUIResult();

    const parsed = yaml.load(yamlString) as ParsedTopology | null;
    if (!parsed || typeof parsed !== 'object') return null;

    const {
      existingNodes = [],
      existingEdges = [],
    } = options;

    const existingNodesById = indexExistingNodesById(existingNodes);
    const nodeNameToId = buildNodeNameToIdMap(existingNodes);
    const simNodeNameToId = buildSimNodeNameToIdMap(existingNodes);

    const { topologyName, namespace, operation } = parseYamlMetadata(parsed);

    const nodeTemplates = asArray<NodeTemplate>(parsed.spec?.nodeTemplates);
    const linkTemplates = asArray<LinkTemplate>(parsed.spec?.linkTemplates);

    const nodeTemplateMap = buildNodeTemplateMap(nodeTemplates);

    const { nodes, nameToId } = parseYamlTopoNodes({
      topoNodes: asArray<TopoNode>(parsed.spec?.nodes),
      existingNodesById,
      nodeNameToId,
      nodeTemplateMap,
    });

    const simData = parsed.spec?.simulation;
    const { simNodeTemplates, simNodeNodes, topology, topologies } = parseYamlSimulation({
      simData,
      existingNodesById,
      simNodeNameToId,
      nameToId,
    });

    nodes.push(...simNodeNodes);

    const allLinks = asArray<Link>(parsed.spec?.links);

    // Breakout intent on link templates lands on the nodes' front panels; derived variant
    // templates then collapse back onto their base so the template list stays clean.
    harvestTemplateBreakouts({ nodes, links: allLinks, linkTemplates, nodeTemplates });
    const collapsedLinkTemplates = collapseBreakoutVariants(allLinks, linkTemplates);

    const edgeLinksByNode = parseEdgeOnlyLinks(allLinks);
    const { externalNodes, externalEdges } = buildExternalNodesAndEdges({
      edgeLinksByNode,
      nodes,
      nameToId,
      existingNodes,
      existingEdges,
    });
    nodes.push(...externalNodes);

    const edges = yamlLinksToUIEdges(allLinks, nameToId, existingEdges);
    edges.push(...externalEdges);
    deriveBreakoutsFromComponents(nodes, nodeTemplates);
    inferBreakoutsFromEdges(nodes, edges, nodeTemplates);

    let annotations: UIAnnotation[] = [];
    const metadataAnnotations = parsed.metadata &&
      'annotations' in parsed.metadata &&
      isRecord(parsed.metadata.annotations)
      ? parsed.metadata.annotations
      : undefined;
    const drawingData = metadataAnnotations?.[ANNOTATION_DRAWING];
    if (Array.isArray(drawingData)) {
      annotations = drawingData as UIAnnotation[];
    } else if (typeof drawingData === 'string') {
      try {
        annotations = JSON.parse(drawingData) as UIAnnotation[];
      } catch { /* empty */ }
    }

    return {
      topologyName,
      namespace,
      operation,
      nodeTemplates,
      linkTemplates: collapsedLinkTemplates,
      nodes,
      edges,
      simulation: {
        simNodeTemplates,
        topology,
        topologies,
      },
      annotations,
    };
  } catch (e) {
    console.error('Failed to parse YAML:', e);
    return null;
  }
}

// ============ Link Parsing (YAML → UI) ============

interface EdgeGroup {
  memberLinks: UIMemberLink[];
  lagGroups: UILagGroup[];
  sourceName: string;
  targetName: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface EsiLagLeafWithInterfaces {
  name: string;
  nodeId: string;
  sourceInterface: string;
  targetInterface: string;
}

function parseYamlLinkEndpoints(endpoints: Endpoint[]): ParsedEndpoint[] {
  const parsed: ParsedEndpoint[] = [];
  for (const endpoint of endpoints) {
    const parsedEndpoint = parseYamlEndpoint(endpoint);
    if (parsedEndpoint) parsed.push(parsedEndpoint);
  }
  return parsed;
}

function isEsiLagLink(parsedEndpoints: ParsedEndpoint[]): boolean {
  if (parsedEndpoints.length < 2) return false;

  const targets = new Set<string>();
  for (const endpoint of parsedEndpoints) {
    if (endpoint.targetName) targets.add(endpoint.targetName);
  }

  return targets.size >= 2;
}

function buildEsiLagLeaves(
  parsedEndpoints: ParsedEndpoint[],
  nameToId: Map<string, string>,
): EsiLagLeafWithInterfaces[] {
  const leaves: EsiLagLeafWithInterfaces[] = [];

  for (const endpoint of parsedEndpoints) {
    const targetName = endpoint.targetName;
    if (!targetName) continue;

    const nodeId = nameToId.get(targetName);
    if (!nodeId) continue;

    leaves.push({
      name: targetName,
      nodeId,
      sourceInterface: endpoint.sourceInterface,
      targetInterface: fallbackIfEmptyString(endpoint.targetInterface, DEFAULT_INTERFACE),
    });
  }

  return leaves;
}

function buildEsiLagMemberLinks(
  commonName: string,
  leaves: EsiLagLeafWithInterfaces[],
  userLabels: Record<string, string> | undefined,
  template: string,
): UIMemberLink[] {
  const memberLinks: UIMemberLink[] = [];

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    memberLinks.push({
      name: `${commonName}-${leaf.name}-${i + 1}`,
      sourceInterface: leaf.sourceInterface,
      targetInterface: leaf.targetInterface,
      labels: i === 0 ? userLabels : undefined,
      template,
    });
  }

  return memberLinks;
}

function buildEsiLagEdgeFromLink(options: {
  link: Link;
  parsedEndpoints: ParsedEndpoint[];
  nameToId: Map<string, string>;
  userLabels: Record<string, string> | undefined;
  sourceHandle?: string;
  targetHandle?: string;
}): UIEdge | null {
  const { link, parsedEndpoints, nameToId, userLabels, sourceHandle, targetHandle } = options;

  const first = parsedEndpoints[0];
  if (!first) return null;

  const commonName = first.sourceName;
  const commonId = nameToId.get(commonName);
  if (!commonId) return null;

  const leaves = buildEsiLagLeaves(parsedEndpoints, nameToId);
  if (leaves.length < 2) return null;

  const edgeId = generateEdgeId();
  const esiLeaves: UIEsiLeaf[] = leaves.map(l => ({ nodeId: l.nodeId, nodeName: l.name }));
  const memberLinks = buildEsiLagMemberLinks(commonName, leaves, userLabels, link.template ?? '');

  return {
    id: edgeId,
    type: 'linkEdge',
    source: commonId,
    target: leaves[0].nodeId,
    sourceHandle: sourceHandle ?? null,
    targetHandle: targetHandle ?? null,
    data: {
      id: edgeId,
      sourceNode: commonName,
      targetNode: leaves[0].name,
      edgeType: 'esilag',
      esiLeaves,
      memberLinks,
      esiLagName: fallbackIfEmptyString(link.name, `${commonName}-esi-lag`),
    },
  };
}

function edgePairKey(a: string, b: string, srcHandle?: string, dstHandle?: string): string {
  const nodeKey = [a, b].sort().join('|');
  const handleKey = `${srcHandle ?? ''}:${dstHandle ?? ''}`;
  return `${nodeKey}#${handleKey}`;
}

function getOrCreateEdgeGroup(
  edgesByPair: Map<string, EdgeGroup>,
  pairKey: string,
  sourceName: string,
  targetName: string,
): EdgeGroup {
  const existing = edgesByPair.get(pairKey);
  if (existing) return existing;

  const group: EdgeGroup = { memberLinks: [], lagGroups: [], sourceName, targetName };
  edgesByPair.set(pairKey, group);
  return group;
}

function addLagToEdgeGroup(options: {
  edgeGroup: EdgeGroup;
  link: Link;
  parsedEndpoints: ParsedEndpoint[];
  pairKey: string;
  linkName: string;
  userLabels: Record<string, string> | undefined;
}): void {
  const { edgeGroup, link, parsedEndpoints, pairKey, linkName, userLabels } = options;

  const startIdx = edgeGroup.memberLinks.length;
  const lagIndices: number[] = [];

  for (let idx = 0; idx < parsedEndpoints.length; idx++) {
    const endpoint = parsedEndpoints[idx];
    edgeGroup.memberLinks.push({
      name: `${linkName}-${idx + 1}`,
      template: link.template ?? '',
      sourceInterface: endpoint.sourceInterface,
      targetInterface: fallbackIfEmptyString(endpoint.targetInterface, DEFAULT_INTERFACE),
    });
    lagIndices.push(startIdx + idx);
  }

  edgeGroup.lagGroups.push({
    id: `lag-${pairKey}-${edgeGroup.lagGroups.length + 1}`,
    name: linkName,
    template: link.template ?? '',
    memberLinkIndices: lagIndices,
    labels: userLabels,
  });
}

function addSingleLinkToEdgeGroup(options: {
  edgeGroup: EdgeGroup;
  link: Link;
  firstEndpoint: ParsedEndpoint;
  linkName: string;
  userLabels: Record<string, string> | undefined;
}): void {
  const { edgeGroup, link, firstEndpoint, linkName, userLabels } = options;

  edgeGroup.memberLinks.push({
    name: linkName,
    template: link.template ?? '',
    sourceInterface: firstEndpoint.sourceInterface,
    targetInterface: fallbackIfEmptyString(firstEndpoint.targetInterface, DEFAULT_INTERFACE),
    labels: userLabels,
  });
}

function addStandardLinkToEdgeGroups(options: {
  link: Link;
  endpoints: Endpoint[];
  parsedEndpoints: ParsedEndpoint[];
  nameToId: Map<string, string>;
  edgesByPair: Map<string, EdgeGroup>;
  userLabels: Record<string, string> | undefined;
}): void {
  const { link, endpoints, parsedEndpoints, nameToId, edgesByPair, userLabels } = options;

  const first = parsedEndpoints[0];
  if (!first) return;

  const targetName = first.targetName;
  if (!targetName) return;

  const sourceName = first.sourceName;
  if (!nameToId.has(sourceName)) return;
  if (!nameToId.has(targetName)) return;

  const handles = extractHandles(link.annotations);
  const pairKey = edgePairKey(sourceName, targetName, handles.sourceHandle, handles.targetHandle);
  const edgeGroup = getOrCreateEdgeGroup(edgesByPair, pairKey, sourceName, targetName);
  const linkName = fallbackIfEmptyString(link.name, `${sourceName}-${targetName}`);

  if (!edgeGroup.sourceHandle && !edgeGroup.targetHandle) {
    if (handles.sourceHandle) edgeGroup.sourceHandle = handles.sourceHandle;
    if (handles.targetHandle) edgeGroup.targetHandle = handles.targetHandle;
  }

  if (endpoints.length > 1) {
    addLagToEdgeGroup({ edgeGroup, link, parsedEndpoints, pairKey, linkName, userLabels });
    return;
  }

  addSingleLinkToEdgeGroup({ edgeGroup, link, firstEndpoint: first, linkName, userLabels });
}

function findExistingEdgeForPair(existingEdges: UIEdge[], sourceId: string, targetId: string): UIEdge | undefined {
  for (const edge of existingEdges) {
    if (edge.source === sourceId && edge.target === targetId) return edge;
    if (edge.source === targetId && edge.target === sourceId) return edge;
  }
  return undefined;
}

function buildEdgesFromGroups(options: {
  edgesByPair: Map<string, EdgeGroup>;
  nameToId: Map<string, string>;
  existingEdges: UIEdge[];
}): UIEdge[] {
  const { edgesByPair, nameToId, existingEdges } = options;

  const edges: UIEdge[] = [];

  for (const group of edgesByPair.values()) {
    const sourceId = nameToId.get(group.sourceName);
    const targetId = nameToId.get(group.targetName);
    if (!sourceId || !targetId) continue;

    const existingEdge = findExistingEdgeForPair(existingEdges, sourceId, targetId);
    let id = existingEdge?.id;
    if (!id) id = generateEdgeId();

    const edgeType = group.lagGroups.length > 0 ? 'lag' : 'normal';
    const lagGroups = group.lagGroups.length > 0 ? group.lagGroups : undefined;

    edges.push({
      id,
      type: 'linkEdge',
      source: sourceId,
      target: targetId,
      sourceHandle: group.sourceHandle ?? null,
      targetHandle: group.targetHandle ?? null,
      data: {
        id,
        sourceNode: group.sourceName,
        targetNode: group.targetName,
        edgeType,
        memberLinks: group.memberLinks,
        lagGroups,
      },
    });
  }

  return edges;
}

function isEdgeOnlyLink(parsedEndpoints: ParsedEndpoint[]): boolean {
  if (parsedEndpoints.length === 0) return false;
  return parsedEndpoints.every(ep => ep.targetName === null);
}

function parseEdgeOnlyLinks(links: Link[]): Map<string, UIEdgeLink[]> {
  const edgeLinksByNode = new Map<string, UIEdgeLink[]>();

  for (const link of links) {
    const endpoints = asArray<Endpoint>(link.endpoints);
    if (endpoints.length === 0) continue;

    const parsedEndpoints = parseYamlLinkEndpoints(endpoints);
    if (!isEdgeOnlyLink(parsedEndpoints)) continue;

    const userLabels = filterUserLabels(link.labels);

    for (const ep of parsedEndpoints) {
      const nodeName = ep.sourceName;
      let nodeEdgeLinks = edgeLinksByNode.get(nodeName);
      if (!nodeEdgeLinks) {
        nodeEdgeLinks = [];
        edgeLinksByNode.set(nodeName, nodeEdgeLinks);
      }
      nodeEdgeLinks.push({
        name: link.name || `${nodeName}-${ep.sourceInterface}`,
        template: link.template,
        interface: ep.sourceInterface,
        labels: userLabels,
      });
    }
  }

  return edgeLinksByNode;
}

/**
 * Edge links (single-endpoint links) materialise as cables to UI-only external nodes: one
 * external node per real node, carrying all its edge links as member links. External nodes are
 * never written to YAML, so their identity/position is recovered from the current canvas when
 * possible — a YAML edit must not move or replace the chip the user has already placed.
 */
function buildExternalNodesAndEdges(options: {
  edgeLinksByNode: Map<string, UIEdgeLink[]>;
  nodes: UINode[];
  nameToId: Map<string, string>;
  existingNodes: UINode[];
  existingEdges: UIEdge[];
}): { externalNodes: UINode[]; externalEdges: UIEdge[] } {
  const { edgeLinksByNode, nodes, nameToId, existingNodes, existingEdges } = options;

  const externalNodes: UINode[] = [];
  const externalEdges: UIEdge[] = [];
  const usedExternalNames = existingNodes
    .filter(n => n.data.nodeType === 'external')
    .map(n => n.data.name);

  for (const [nodeName, edgeLinks] of edgeLinksByNode) {
    const realId = nameToId.get(nodeName);
    if (!realId) continue;
    const realNode = nodes.find(n => n.id === realId);

    const existingEdge = existingEdges.find(e =>
      (e.source.startsWith('ext-') && e.target === realId)
      || (e.target.startsWith('ext-') && e.source === realId));
    let existingExtId: string | undefined;
    if (existingEdge) {
      existingExtId = existingEdge.source.startsWith('ext-') ? existingEdge.source : existingEdge.target;
    }
    const existingExt = existingExtId
      ? existingNodes.find(n => n.id === existingExtId)
      : undefined;

    const extId = existingExt?.id ?? generateExternalNodeId();
    let extName = existingExt?.data.name;
    if (!extName) {
      extName = generateUniqueName('external', usedExternalNames, usedExternalNames.length + 1);
      usedExternalNames.push(extName);
    }
    const position = existingExt?.position
      ?? (realNode
        ? { x: realNode.position.x + 40, y: realNode.position.y + 220 }
        : { x: 100, y: 400 });

    externalNodes.push({
      id: extId,
      type: 'externalNode',
      position,
      data: { id: extId, name: extName, nodeType: 'external' },
    });

    const edgeId = existingEdge?.id ?? generateEdgeId();
    externalEdges.push({
      id: edgeId,
      type: 'linkEdge',
      source: extId,
      target: realId,
      sourceHandle: null,
      targetHandle: null,
      data: {
        id: edgeId,
        sourceNode: extName,
        targetNode: nodeName,
        edgeType: 'normal',
        memberLinks: edgeLinks.map((link, index) => ({
          name: link.name,
          template: link.template ?? '',
          sourceInterface: `eth${index + 1}`,
          targetInterface: link.interface,
          labels: link.labels,
        })),
      },
    });
  }

  return { externalNodes, externalEdges };
}

function yamlLinksToUIEdges(
  links: Link[],
  nameToId: Map<string, string>,
  existingEdges: UIEdge[] = [],
): UIEdge[] {
  const edgesByPair = new Map<string, EdgeGroup>();
  const esiLagEdges: UIEdge[] = [];

  for (const link of links) {
    const endpoints = asArray<Endpoint>(link.endpoints);
    if (endpoints.length === 0) continue;

    const parsedEndpoints = parseYamlLinkEndpoints(endpoints);

    if (isEdgeOnlyLink(parsedEndpoints)) continue;

    const userLabels = filterUserLabels(link.labels);

    if (isEsiLagLink(parsedEndpoints)) {
      const handles = extractHandles(link.annotations);
      const esiLagEdge = buildEsiLagEdgeFromLink({
        link,
        parsedEndpoints,
        nameToId,
        userLabels,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
      });
      if (esiLagEdge) esiLagEdges.push(esiLagEdge);
      continue;
    }

    addStandardLinkToEdgeGroups({
      link,
      endpoints,
      parsedEndpoints,
      nameToId,
      edgesByPair,
      userLabels,
    });
  }

  const edges = buildEdgesFromGroups({ edgesByPair, nameToId, existingEdges });
  return [...edges, ...esiLagEdges];
}
