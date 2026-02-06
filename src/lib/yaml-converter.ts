/**
 * YAML Converter - Pure functions for converting between YAML and UI types
 *
 * This module provides bidirectional conversion:
 * - yamlToUI(): Parse YAML string → UI state
 * - exportToYaml(): UI state → YAML string
 */

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
  ParsedTopology,
} from '../types/schema';
import type {
  UINode,
  UIEdge,
  UIMemberLink,
  UILagGroup,
  UIEsiLeaf,
  UISimNode,
  UISimulation,
} from '../types/ui';
import {
  LABEL_POS_X,
  LABEL_POS_Y,
  LABEL_EDGE_ID,
  LABEL_MEMBER_INDEX,
  DEFAULT_INTERFACE,
  DEFAULT_SIM_INTERFACE,
  INTERNAL_LABEL_PREFIX,
} from './constants';

// ============ ID Counters ============
let nodeIdCounter = 1;
let edgeIdCounter = 1;
let simNodeIdCounter = 1;

export const resetIdCounters = () => {
  nodeIdCounter = 1;
  edgeIdCounter = 1;
  simNodeIdCounter = 1;
};

export const setIdCounters = (nodeId: number, edgeId: number, simNodeId: number) => {
  nodeIdCounter = nodeId;
  edgeIdCounter = edgeId;
  simNodeIdCounter = simNodeId;
};

export const getIdCounters = () => ({
  nodeId: nodeIdCounter,
  edgeId: edgeIdCounter,
  simNodeId: simNodeIdCounter,
});

const generateNodeId = () => `node-${nodeIdCounter++}`;
const generateEdgeId = () => `edge-${edgeIdCounter++}`;
const generateSimNodeId = () => `sim-${simNodeIdCounter++}`;

// ============ Utility Functions ============

/**
 * Filter out internal topobuilder labels, returning only user labels
 */
export function filterUserLabels(labels?: Record<string, string>): Record<string, string> | undefined {
  if (!labels) return undefined;
  const filtered = Object.fromEntries(
    Object.entries(labels).filter(([k]) => !k.startsWith(INTERNAL_LABEL_PREFIX)),
  );
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

/**
 * Extract position from labels
 */
export function extractPosition(labels?: Record<string, string>): { x: number; y: number } | null {
  if (!labels) return null;
  const x = labels[LABEL_POS_X];
  const y = labels[LABEL_POS_Y];
  if (x && y) {
    return { x: parseFloat(x), y: parseFloat(y) };
  }
  return null;
}

/**
 * Parse a YAML endpoint into source/target names and interfaces
 */
export interface ParsedEndpoint {
  sourceName: string;
  targetName: string | null;
  sourceInterface: string;
  targetInterface: string | null;
}

export function parseYamlEndpoint(ep: Endpoint): ParsedEndpoint | null {
  // Standard local/remote link
  if (ep.local?.node && ep.remote?.node) {
    return {
      sourceName: ep.local.node,
      targetName: ep.remote.node,
      sourceInterface: ep.local.interface || DEFAULT_INTERFACE,
      targetInterface: ep.remote.interface || DEFAULT_INTERFACE,
    };
  }
  // SimNode link (local + sim)
  if (ep.local?.node && (ep.sim?.simNode || ep.sim?.node)) {
    const simName = ep.sim.simNode ?? ep.sim.node;
    if (!simName) return null;
    return {
      sourceName: simName,
      targetName: ep.local.node,
      sourceInterface: ep.sim?.simNodeInterface || ep.sim?.interface || DEFAULT_SIM_INTERFACE,
      targetInterface: ep.local.interface || DEFAULT_INTERFACE,
    };
  }
  // Single local endpoint (for ESI-LAG)
  if (ep.local?.node) {
    return {
      sourceName: ep.local.node,
      targetName: null,
      sourceInterface: ep.local.interface || DEFAULT_INTERFACE,
      targetInterface: null,
    };
  }
  return null;
}

// ============ YAML → UI Conversion ============

export interface YamlToUIOptions {
  existingNodes?: UINode[];
  existingEdges?: UIEdge[];
  existingSimNodes?: UISimNode[];
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
}

/**
 * Convert YAML string to UI state
 */
export function yamlToUI(yamlString: string, options: YamlToUIOptions = {}): YamlToUIResult | null {
  try {
    const trimmed = yamlString.trim();

    // Handle empty YAML
    if (!trimmed) {
      return {
        topologyName: 'my-topology',
        namespace: 'eda',
        operation: 'replaceAll',
        nodeTemplates: [],
        linkTemplates: [],
        nodes: [],
        edges: [],
        simulation: { simNodeTemplates: [], simNodes: [] },
      };
    }

    const parsed = yaml.load(yamlString) as ParsedTopology | null;
    if (!parsed || typeof parsed !== 'object') return null;

    const {
      existingNodes = [],
      existingEdges = [],
      existingSimNodes = [],
    } = options;

    // Build name-to-ID maps from existing data
    const nodeNameToId = new Map<string, string>();
    existingNodes.forEach(n => nodeNameToId.set(n.data.name, n.id));

    const simNodeNameToId = new Map<string, string>();
    existingSimNodes.forEach(n => simNodeNameToId.set(n.name, n.id));
    existingNodes
      .filter(n => n.data.nodeType === 'simnode')
      .forEach(n => simNodeNameToId.set(n.data.name, n.id));

    // Parse metadata
    const topologyName = parsed.metadata?.name || 'my-topology';
    const namespace = parsed.metadata?.namespace || 'eda';
    const operation = (parsed.spec?.operation as Operation) || 'replaceAll';

    // Parse templates
    const nodeTemplates = (parsed.spec?.nodeTemplates || []);
    const linkTemplates = (parsed.spec?.linkTemplates || []);

    // Build template lookup maps
    const nodeTemplateMap = new Map<string, NodeTemplate>();
    nodeTemplates.forEach(t => nodeTemplateMap.set(t.name, t));

    // Parse nodes
    const nodes: UINode[] = [];
    const nameToId = new Map<string, string>();

    if (parsed.spec?.nodes && Array.isArray(parsed.spec.nodes)) {
      parsed.spec.nodes.forEach((node: TopoNode, index: number) => {
        const existingId = nodeNameToId.get(node.name);
        const existingNode = existingId ? existingNodes.find(n => n.id === existingId) : null;
        const id = existingId || generateNodeId();
        nameToId.set(node.name, id);

        // Get position from labels or existing node or default
        const positionFromLabels = extractPosition(node.labels);
        const position = positionFromLabels ||
          existingNode?.position ||
          { x: 100 + (index % 4) * 200, y: 100 + Math.floor(index / 4) * 150 };

        // Get platform/nodeProfile from node or template
        let platform = node.platform;
        let nodeProfile = node.nodeProfile;
        if (node.template) {
          const template = nodeTemplateMap.get(node.template);
          if (template) {
            if (!platform && template.platform) platform = template.platform;
            if (!nodeProfile && template.nodeProfile) nodeProfile = template.nodeProfile;
          }
        }

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
            nodeProfile,
            labels: userLabels,
          },
        });
      });
    }

    // Parse simulation (simNodes now go into nodes[])
    const simData = parsed.spec?.simulation;
    const simNodeTemplates = simData?.simNodeTemplates || [];

    if (simData?.simNodes && Array.isArray(simData.simNodes)) {
      simData.simNodes.forEach((simNode: SimNode, index: number) => {
        const existingId = simNodeNameToId.get(simNode.name);
        const existingSimNode = existingId
          ? existingSimNodes.find(n => n.id === existingId) ||
            existingNodes.find(n => n.id === existingId)
          : null;
        const id = existingId || generateSimNodeId();
        nameToId.set(simNode.name, id);

        const positionFromLabels = extractPosition(simNode.labels);
        const position = positionFromLabels ||
          (existingSimNode && 'position' in existingSimNode ? existingSimNode.position : null) ||
          { x: 400 + (index % 3) * 180, y: 50 + Math.floor(index / 3) * 140 };

        const userLabels = filterUserLabels(simNode.labels);

        nodes.push({
          id,
          type: 'simNode',
          position: position || { x: 400, y: 50 },
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
      });
    }

    // Parse links
    const edges: UIEdge[] = [];

    if (parsed.spec?.links && Array.isArray(parsed.spec.links)) {
      edges.push(...yamlLinksToUIEdges(
        parsed.spec.links,
        nameToId,
        existingEdges,
      ));
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
        simNodes: [], // SimNodes are now in nodes[]
        topology: simData?.topology,
      },
    };
  } catch (e) {
    console.error('Failed to parse YAML:', e);
    return null;
  }
}

/**
 * Convert YAML links to UI edges
 */
function yamlLinksToUIEdges(
  links: Link[],
  nameToId: Map<string, string>,
  existingEdges: UIEdge[] = [],
): UIEdge[] {
  interface EdgeGroup {
    memberLinks: UIMemberLink[];
    lagGroups: UILagGroup[];
    sourceName: string;
    targetName: string;
  }

  const edgesByPair = new Map<string, EdgeGroup>();
  const esiLagEdges: UIEdge[] = [];

  for (const link of links) {
    const endpoints = link.endpoints || [];
    if (endpoints.length === 0) continue;

    const userLabels = filterUserLabels(link.labels);

    const parsedEndpoints = endpoints.map(ep => parseYamlEndpoint(ep)).filter(Boolean);
    const uniqueTargets = new Set(parsedEndpoints.map(p => p?.targetName).filter(Boolean));
    const isEsiLag = parsedEndpoints.length >= 2 && uniqueTargets.size >= 2;

    if (isEsiLag) {
      const first = parsedEndpoints[0];
      if (!first) continue;
      const commonName = first.sourceName;
      const commonId = nameToId.get(commonName);
      if (!commonId) continue;

      const leaves = parsedEndpoints
        .filter((p): p is ParsedEndpoint => p !== null && p.targetName !== null && nameToId.has(p.targetName))
        .map(p => {
          const nodeId = nameToId.get(p.targetName as string);
          return {
            name: p.targetName as string,
            nodeId: nodeId as string,
            sourceInterface: p.sourceInterface,
            targetInterface: p.targetInterface ?? DEFAULT_INTERFACE,
          };
        });

      if (leaves.length < 2) continue;

      const edgeId = generateEdgeId();
      const esiLeaves: UIEsiLeaf[] = leaves.map(l => ({
        nodeId: l.nodeId,
        nodeName: l.name,
      }));

      const memberLinks: UIMemberLink[] = leaves.map((l, i) => ({
        name: `${commonName}-${l.name}-${i + 1}`,
        sourceInterface: l.sourceInterface,
        targetInterface: l.targetInterface,
        labels: i === 0 ? userLabels : undefined,
      }));

      esiLagEdges.push({
        id: edgeId,
        type: 'linkEdge',
        source: commonId,
        target: leaves[0].nodeId,
        data: {
          id: edgeId,
          sourceNode: commonName,
          targetNode: leaves[0].name,
          edgeType: 'esilag',
          esiLeaves,
          memberLinks,
          esiLagName: link.name || `${commonName}-esi-lag`,
        },
      });
      continue;
    }

    // Standard link or LAG
    const first = parsedEndpoints[0];
    if (!first || !first.targetName) continue;

    const { sourceName, targetName } = first;
    if (!nameToId.has(sourceName) || !nameToId.has(targetName)) continue;

    const pairKey = [sourceName, targetName].sort().join('|');

    let edgeGroup = edgesByPair.get(pairKey);
    if (!edgeGroup) {
      edgeGroup = {
        memberLinks: [],
        lagGroups: [],
        sourceName,
        targetName,
      };
      edgesByPair.set(pairKey, edgeGroup);
    }

    const linkName = link.name || `${sourceName}-${targetName}`;

    // Multi-endpoint link = LAG
    if (endpoints.length > 1) {
      const startIdx = edgeGroup.memberLinks.length;
      const lagIndices: number[] = [];

      parsedEndpoints.forEach((p, idx) => {
        if (!p) return;
        edgeGroup.memberLinks.push({
          name: `${linkName}-${idx + 1}`,
          template: link.template,
          sourceInterface: p.sourceInterface,
          targetInterface: p.targetInterface || DEFAULT_INTERFACE,
        });
        lagIndices.push(startIdx + idx);
      });

      edgeGroup.lagGroups.push({
        id: `lag-${pairKey}-${edgeGroup.lagGroups.length + 1}`,
        name: linkName,
        template: link.template,
        memberLinkIndices: lagIndices,
        labels: userLabels,
      });
    } else {
      // Single endpoint link
      edgeGroup.memberLinks.push({
        name: linkName,
        template: link.template,
        sourceInterface: first.sourceInterface,
        targetInterface: first.targetInterface || DEFAULT_INTERFACE,
        labels: userLabels,
      });
    }
  }

  // Convert edge groups to edges
  const edges: UIEdge[] = [];

  for (const [, group] of edgesByPair) {
    const { memberLinks, lagGroups, sourceName, targetName } = group;
    const sourceId = nameToId.get(sourceName);
    const targetId = nameToId.get(targetName);
    if (!sourceId || !targetId) continue;

    // Try to find existing edge for stable ID
    const existingEdge = existingEdges.find(
      e => (e.source === sourceId && e.target === targetId) ||
           (e.source === targetId && e.target === sourceId),
    );
    const id = existingEdge?.id || generateEdgeId();

    const edgeType = lagGroups.length > 0 ? 'lag' : 'normal';

    edges.push({
      id,
      type: 'linkEdge',
      source: sourceId,
      target: targetId,
      data: {
        id,
        sourceNode: sourceName,
        targetNode: targetName,
        edgeType,
        memberLinks,
        lagGroups: lagGroups.length > 0 ? lagGroups : undefined,
      },
    });
  }

  return [...edges, ...esiLagEdges];
}

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
 * Convert UI state to YAML string
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
 * Build CRD object from UI state
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
    const simNode: SimNode = {
      name: node.data.name,
    };
    // Only include user-provided labels, not position labels
    if (node.data.labels && Object.keys(node.data.labels).length > 0) {
      simNode.labels = node.data.labels;
    }
    if (node.data.template) simNode.template = node.data.template;
    if (node.data.simNodeType) simNode.type = node.data.simNodeType;
    if (node.data.image) simNode.image = node.data.image;
    return simNode;
  });

  const hasSimData = simulation && (
    (simulation.simNodeTemplates && simulation.simNodeTemplates.length > 0) ||
    (simulation.topology && Array.isArray(simulation.topology) && simulation.topology.length > 0)
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
 * Convert UI edges to YAML links
 */
function uiEdgesToYamlLinks(
  edges: UIEdge[],
  nodeIdToName: Map<string, string>,
  simNodeIdToName: Map<string, string>,
): Link[] {
  const islLinks: Link[] = [];
  const simLinks: Link[] = [];
  const esiLagLinks: Link[] = [];

  const processedEsiLagIds = new Set<string>();
  let esiLagCounter = 1;

  const createPosLabels = (edge: UIEdge, memberIndex: number) => ({
    [LABEL_EDGE_ID]: edge.id,
    [LABEL_MEMBER_INDEX]: String(memberIndex),
  });

  // Process ESI-LAG edges first
  for (const edge of edges) {
    if (edge.data?.edgeType === 'esilag' && edge.data.esiLeaves?.length) {
      const sourceName = edge.data.sourceNode;
      const esiLeaves = edge.data.esiLeaves;
      const memberLinks = edge.data.memberLinks || [];
      const sourceIsSimNode = edge.source.startsWith('sim-');

      if (sourceIsSimNode) {
        const simNodeName = simNodeIdToName.get(edge.source) || sourceName;

        const endpoints: Endpoint[] = esiLeaves.map((leaf, i) => ({
          local: {
            node: leaf.nodeName,
            interface: memberLinks[i]?.targetInterface || DEFAULT_INTERFACE,
          },
          sim: {
            simNode: simNodeName,
            simNodeInterface: memberLinks[i]?.sourceInterface || `eth${i + 1}`,
          },
        }));

        const link: Link = {
          name: edge.data.esiLagName || `${sourceName}-esi-lag-${esiLagCounter++}`,
          labels: memberLinks[0]?.labels,
          endpoints,
        };
        if (memberLinks[0]?.template) link.template = memberLinks[0].template;
        esiLagLinks.push(link);
      } else {
        const endpoints: Endpoint[] = [
          {
            local: {
              node: sourceName,
              interface: memberLinks[0]?.sourceInterface || DEFAULT_INTERFACE,
            },
          },
          ...esiLeaves.map((leaf, i) => ({
            local: {
              node: leaf.nodeName,
              interface: memberLinks[i]?.targetInterface || DEFAULT_INTERFACE,
            },
          })),
        ];

        const link: Link = {
          name: edge.data.esiLagName || `${sourceName}-esi-lag-${esiLagCounter++}`,
          labels: memberLinks[0]?.labels,
          endpoints,
        };
        if (memberLinks[0]?.template) link.template = memberLinks[0].template;
        esiLagLinks.push(link);
      }

      processedEsiLagIds.add(edge.id);
    }
  }

  // Process remaining edges
  for (const edge of edges) {
    if (processedEsiLagIds.has(edge.id)) continue;

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

    // Process LAG groups
    for (const lag of lagGroups) {
      const lagMemberLinks = lag.memberLinkIndices
        .filter(idx => idx >= 0 && idx < memberLinks.length)
        .map(idx => memberLinks[idx]);

      if (lagMemberLinks.length === 0) continue;

      const firstMemberIndex = lag.memberLinkIndices[0];
      let lagLink: Link;

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

      if (lag.template) lagLink.template = lag.template;
      islLinks.push(lagLink);
    }

    // Process individual member links (not in LAGs)
    for (let i = 0; i < memberLinks.length; i++) {
      if (indicesInLags.has(i)) continue;

      const member = memberLinks[i];

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
        const link: Link = {
          name: member.name,
          labels: { ...member.labels, ...createPosLabels(edge, i) },
          endpoints: [{
            local: {
              node: sourceName,
              interface: member.sourceInterface || DEFAULT_INTERFACE,
            },
            remote: {
              node: targetName,
              interface: member.targetInterface || DEFAULT_INTERFACE,
            },
          }],
        };

        if (member.template) link.template = member.template;
        islLinks.push(link);
      }
    }
  }

  return [...islLinks, ...simLinks, ...esiLagLinks];
}

/**
 * Download YAML content as a file
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
