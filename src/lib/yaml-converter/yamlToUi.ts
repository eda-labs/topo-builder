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
  Operation,
  ParsedTopology,
} from '../../types/schema';
import type {
  UINode,
  UIEdge,
  UIMemberLink,
  UILagGroup,
  UIEsiLeaf,
  UISimulation,
  UIAnnotation,
} from '../../types/ui';
import { DEFAULT_INTERFACE, ANNOTATION_DRAWING } from '../constants';

import {
  asArray,
  extractPosition,
  extractHandles,
  fallbackIfEmptyString,
  filterUserLabels,
  generateEdgeId,
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
  operation: Operation;
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
    operation: 'replaceAll',
    nodeTemplates: [],
    linkTemplates: [],
    nodes: [],
    edges: [],
    simulation: { simNodeTemplates: [] },
    annotations: [],
  };
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

function parseYamlMetadata(parsed: ParsedTopology): { topologyName: string; namespace: string; operation: Operation } {
  const topologyName = fallbackIfEmptyString(parsed.metadata?.name, 'my-topology');
  const namespace = fallbackIfEmptyString(parsed.metadata?.namespace, 'eda');
  const operation = fallbackIfEmptyString(parsed.spec?.operation as Operation | undefined, 'replaceAll') as Operation;
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
        nodeProfile,
        labels: userLabels,
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
}): { simNodeTemplates: SimNodeTemplate[]; simNodeNodes: UINode[]; topology: unknown[] | undefined } {
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
  };
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
    const { simNodeTemplates, simNodeNodes, topology } = parseYamlSimulation({
      simData,
      existingNodesById,
      simNodeNameToId,
      nameToId,
    });

    nodes.push(...simNodeNodes);

    const edges = yamlLinksToUIEdges(asArray<Link>(parsed.spec?.links), nameToId, existingEdges);

    let annotations: UIAnnotation[] = [];
    const metadataAnnotations = (parsed.metadata as Record<string, unknown> | undefined)?.annotations as Record<string, unknown> | undefined;
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
      linkTemplates,
      nodes,
      edges,
      simulation: {
        simNodeTemplates,
        topology,
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
): UIMemberLink[] {
  const memberLinks: UIMemberLink[] = [];

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    memberLinks.push({
      name: `${commonName}-${leaf.name}-${i + 1}`,
      sourceInterface: leaf.sourceInterface,
      targetInterface: leaf.targetInterface,
      labels: i === 0 ? userLabels : undefined,
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
  const memberLinks = buildEsiLagMemberLinks(commonName, leaves, userLabels);

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
      template: link.template,
      sourceInterface: endpoint.sourceInterface,
      targetInterface: fallbackIfEmptyString(endpoint.targetInterface, DEFAULT_INTERFACE),
    });
    lagIndices.push(startIdx + idx);
  }

  edgeGroup.lagGroups.push({
    id: `lag-${pairKey}-${edgeGroup.lagGroups.length + 1}`,
    name: linkName,
    template: link.template,
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
    template: link.template,
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

    const userLabels = filterUserLabels(link.labels);
    const parsedEndpoints = parseYamlLinkEndpoints(endpoints);

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
