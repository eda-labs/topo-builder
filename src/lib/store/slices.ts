// Centralized exports for store slice creators and slice types.
// Used to keep dependency counts low in the store composer.

export { createNodeSlice, setNodeIdGenerator, type NodeSlice } from './nodes';
export { createLinkSlice, setEdgeIdGenerator, type LinkSlice } from './links';
export { createLagSlice, type LagSlice } from './lags';
export { createEsiLagSlice, setEsiLagEdgeIdGenerator, type EsiLagSlice } from './esiLags';
export { createSimNodeSlice, setSimNodeIdGenerator, type SimNodeSlice } from './simNodes';
export { createTemplateSlice, type TemplateSlice } from './templates';
export { createSelectionSlice, type SelectionSlice } from './selection';
