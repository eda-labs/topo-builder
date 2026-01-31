// Central place for stable DOM hooks used by e2e tests.
// Keep these small and deterministic; they should not change with styling or layout.

export function sanitizeTestIdPart(value: string): string {
  // data-testid can technically contain anything, but keeping it CSS/selector-friendly
  // avoids escaping headaches in tests.
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function topologyNodeTestId(nodeName: string): string {
  return `topology-node-${sanitizeTestIdPart(nodeName)}`;
}

export function topologySimNodeTestId(simNodeName: string): string {
  return `topology-simnode-${sanitizeTestIdPart(simNodeName)}`;
}

export function topologyEdgeKey(a: string, b: string): string {
  const left = sanitizeTestIdPart(a);
  const right = sanitizeTestIdPart(b);
  return [left, right].sort().join('--');
}

export function topologyEdgeTestId(a: string, b: string): string {
  return `topology-edge-${topologyEdgeKey(a, b)}`;
}

export function topologyMemberLinkTestId(a: string, b: string, memberIndex: number): string {
  return `topology-memberlink-${topologyEdgeKey(a, b)}-${memberIndex}`;
}

export function topologyLagTestId(a: string, b: string, lagName: string): string {
  return `topology-lag-${topologyEdgeKey(a, b)}-${sanitizeTestIdPart(lagName)}`;
}

