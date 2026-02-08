import type { UIEdge, UINode } from '../../types/ui';

export type StoreSliceDeps = {
  nodes: UINode[];
  edges: UIEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedSimNodeName: string | null;
  triggerYamlRefresh: () => void;
  setError: (error: string | null) => void;
  saveToUndoHistory: () => void;
};

export function deselectAllElements(options: {
  nodes: UINode[];
  edges: UIEdge[];
}): { nodes: UINode[]; edges: UIEdge[] } {
  const { nodes, edges } = options;
  return {
    nodes: nodes.map(n => ({ ...n, selected: false })),
    edges: edges.map(e => ({ ...e, selected: false })),
  };
}
