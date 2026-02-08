import type { UIEdge } from '../../types/ui';

export function getEdgePairKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function countForEdgePair(
  edges: UIEdge[],
  sourceNodeName: string,
  targetNodeName: string,
  getCount: (edge: UIEdge) => number,
): number {
  const pairKey = getEdgePairKey(sourceNodeName, targetNodeName);
  let count = 0;

  for (const edge of edges) {
    const edgeSource = edge.data?.sourceNode;
    const edgeTarget = edge.data?.targetNode;
    if (!edgeSource || !edgeTarget) continue;
    if (getEdgePairKey(edgeSource, edgeTarget) !== pairKey) continue;
    count += getCount(edge);
  }

  return count;
}
