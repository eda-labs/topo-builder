import { useShallow } from 'zustand/react/shallow';

import { useTopologyStore } from '../lib/store';

export function useTopologyData() {
  return useTopologyStore(useShallow(state => ({
    nodes: state.nodes,
    edges: state.edges,
    nodeTemplates: state.nodeTemplates,
    linkTemplates: state.linkTemplates,
    simulation: state.simulation,
    annotations: state.annotations,
  })));
}
