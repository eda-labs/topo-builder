import type { Endpoint } from '../../types/schema';
import {
  ANNOTATION_POS_X,
  ANNOTATION_POS_Y,
  ANNOTATION_SRC_HANDLE,
  ANNOTATION_DST_HANDLE,
  DEFAULT_INTERFACE,
  DEFAULT_SIM_INTERFACE,
} from '../constants';

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

// Generators are exported for internal use by converters.
export const generateNodeId = () => `node-${nodeIdCounter++}`;
export const generateEdgeId = () => `edge-${edgeIdCounter++}`;
export const generateSimNodeId = () => `sim-${simNodeIdCounter++}`;

// ============ Shared Helpers ============

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

export function fallbackIfEmptyString(value: string | undefined | null, fallback: string): string {
  if (value) return value;
  return fallback;
}

function hasTruthySimNodeName(sim: Endpoint['sim'] | null | undefined): boolean {
  if (!sim) return false;
  if (sim.simNode) return true;
  if (sim.node) return true;
  return false;
}

function pickSimNodeName(sim: Endpoint['sim']): string | null {
  if (!sim) return null;
  if (sim.simNode !== undefined && sim.simNode !== null) return sim.simNode;
  if (sim.node !== undefined && sim.node !== null) return sim.node;
  return null;
}

function pickSimNodeInterface(sim: Endpoint['sim']): string | undefined {
  if (!sim) return undefined;
  if (sim.simNodeInterface) return sim.simNodeInterface;
  if (sim.interface) return sim.interface;
  return undefined;
}

export function filterUserLabels(labels?: Record<string, string>): Record<string, string> | undefined {
  if (!labels || Object.keys(labels).length === 0) return undefined;
  return labels;
}

export function extractPosition(annotations?: Record<string, string>): { x: number; y: number } | null {
  if (!annotations) return null;
  const x = annotations[ANNOTATION_POS_X];
  const y = annotations[ANNOTATION_POS_Y];
  if (x && y) return { x: parseFloat(x), y: parseFloat(y) };
  return null;
}

export function extractHandles(annotations?: Record<string, string>): { sourceHandle?: string; targetHandle?: string } {
  if (!annotations) return {};
  const result: { sourceHandle?: string; targetHandle?: string } = {};
  if (annotations[ANNOTATION_SRC_HANDLE]) result.sourceHandle = annotations[ANNOTATION_SRC_HANDLE];
  if (annotations[ANNOTATION_DST_HANDLE]) result.targetHandle = annotations[ANNOTATION_DST_HANDLE];
  return result;
}

/**
 * Parse a YAML endpoint into source/target names and interfaces.
 */
export interface ParsedEndpoint {
  sourceName: string;
  targetName: string | null;
  sourceInterface: string;
  targetInterface: string | null;
}

export function parseYamlEndpoint(ep: Endpoint): ParsedEndpoint | null {
  const localNode = ep.local?.node;
  if (!localNode) return null;

  // Standard local/remote link
  const remoteNode = ep.remote?.node;
  if (remoteNode) {
    return {
      sourceName: remoteNode,
      targetName: localNode,
      sourceInterface: fallbackIfEmptyString(ep.remote?.interface, DEFAULT_INTERFACE),
      targetInterface: fallbackIfEmptyString(ep.local?.interface, DEFAULT_INTERFACE),
    };
  }

  // SimNode link (local + sim)
  const sim = ep.sim;
  if (hasTruthySimNodeName(sim)) {
    const simName = pickSimNodeName(sim);
    if (!simName) return null;

    return {
      sourceName: simName,
      targetName: localNode,
      sourceInterface: fallbackIfEmptyString(pickSimNodeInterface(sim), DEFAULT_SIM_INTERFACE),
      targetInterface: fallbackIfEmptyString(ep.local?.interface, DEFAULT_INTERFACE),
    };
  }

  // Single local endpoint (for ESI-LAG)
  return {
    sourceName: localNode,
    targetName: null,
    sourceInterface: fallbackIfEmptyString(ep.local?.interface, DEFAULT_INTERFACE),
    targetInterface: null,
  };
}
