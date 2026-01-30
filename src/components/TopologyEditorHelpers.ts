import type { Edge, NodeChange } from '@xyflow/react';

import { useTopologyStore } from '../lib/store';
import type { TopologyEdgeData, Simulation, MemberLink } from '../types/topology';

type MutableRef<T> = { current: T };

function arraysEqual(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function getMatchingLagMemberIndex(lagGroups: TopologyEdgeData['lagGroups'], selectedIndices: number[]) {
  if (!lagGroups || selectedIndices.length < 2) return null;
  const sortedSelected = [...selectedIndices].sort((a, b) => a - b);
  for (const lag of lagGroups) {
    const sortedLag = [...lag.memberLinkIndices].sort((a, b) => a - b);
    if (arraysEqual(sortedSelected, sortedLag)) {
      return lag.memberLinkIndices[0];
    }
  }
  return null;
}

export function getYamlMemberLinkIndexForSelection(params: {
  activeTab: number;
  selectedEdgeId: string | null;
  selectedMemberLinkIndices: number[];
  edges: Edge<TopologyEdgeData>[];
  expandedEdges: Set<string>;
}) {
  const {
    activeTab,
    selectedEdgeId,
    selectedMemberLinkIndices,
    edges,
    expandedEdges,
  } = params;

  if (activeTab !== 0 || !selectedEdgeId || selectedMemberLinkIndices.length === 0) return null;

  const edge = edges.find(e => e.id === selectedEdgeId);
  const memberLinks = edge?.data?.memberLinks ?? [];
  const lagGroups = edge?.data?.lagGroups ?? [];

  if (memberLinks.length <= 1 || !expandedEdges.has(selectedEdgeId)) return null;

  const lagIndex = getMatchingLagMemberIndex(lagGroups, selectedMemberLinkIndices);
  if (lagIndex !== null) return lagIndex;

  if (selectedMemberLinkIndices.length === 1) {
    return selectedMemberLinkIndices[0];
  }

  return null;
}

export function splitNodeChanges(changes: NodeChange[]) {
  const isSim = (change: NodeChange) => 'id' in change && (change as { id?: string }).id?.startsWith('sim-');
  return {
    simChanges: changes.filter(isSim),
    topoChanges: changes.filter(c => !isSim(c)),
  };
}

export function applySimNodeChanges(params: {
  simChanges: NodeChange[];
  currentSimNodes: Simulation['simNodes'];
  currentSelectedSimNodeNames: Set<string>;
  updateSimNodePosition: (name: string, position: { x: number; y: number }) => void;
  deleteSimNode: (name: string) => void;
}) {
  const {
    simChanges,
    currentSimNodes,
    currentSelectedSimNodeNames,
    updateSimNodePosition,
    deleteSimNode,
  } = params;

  let simDragEnded = false;
  const newSelectedSimNodes = new Set(currentSelectedSimNodeNames);
  let selectionChanged = false;

  const getSimNodeNameById = (id: string) => currentSimNodes.find(sn => sn.id === id)?.name;

  const positionChanges = simChanges.filter(change =>
    change.type === 'position' && 'id' in change && 'position' in change
  );
  const selectChanges = simChanges.filter(change =>
    change.type === 'select' && 'id' in change
  );
  const removeChanges = simChanges.filter(change =>
    change.type === 'remove' && 'id' in change
  );

  const positionDragEnded = applyPositionChanges(positionChanges, getSimNodeNameById, updateSimNodePosition);
  const selectChanged = applySelectChanges(selectChanges, getSimNodeNameById, newSelectedSimNodes);
  const removeChanged = applyRemoveChanges(removeChanges, getSimNodeNameById, deleteSimNode, newSelectedSimNodes);

  simDragEnded = positionDragEnded;
  selectionChanged = selectChanged || removeChanged;

  return { simDragEnded, newSelectedSimNodes, selectionChanged };
}

function applyPositionChanges(
  changes: NodeChange[],
  getSimNodeNameById: (id: string) => string | undefined,
  updateSimNodePosition: (name: string, position: { x: number; y: number }) => void,
) {
  let simDragEnded = false;
  for (const change of changes) {
    const positionChange = change as { id?: string; position?: { x: number; y: number }; dragging?: boolean };
    if (!positionChange.id || !positionChange.position) continue;
    const simName = getSimNodeNameById(positionChange.id);
    if (simName) updateSimNodePosition(simName, positionChange.position);
    if (positionChange.dragging === false) simDragEnded = true;
  }
  return simDragEnded;
}

function applySelectChanges(
  changes: NodeChange[],
  getSimNodeNameById: (id: string) => string | undefined,
  newSelectedSimNodes: Set<string>,
) {
  let selectionChanged = false;
  for (const change of changes) {
    const selectChange = change as { id?: string; selected?: boolean };
    if (!selectChange.id) continue;
    const simName = getSimNodeNameById(selectChange.id);
    if (!simName) continue;
    if (selectChange.selected) {
      newSelectedSimNodes.add(simName);
    } else {
      newSelectedSimNodes.delete(simName);
    }
    selectionChanged = true;
  }
  return selectionChanged;
}

function applyRemoveChanges(
  changes: NodeChange[],
  getSimNodeNameById: (id: string) => string | undefined,
  deleteSimNode: (name: string) => void,
  newSelectedSimNodes: Set<string>,
) {
  let selectionChanged = false;
  for (const change of changes) {
    const removeChange = change as { id?: string };
    if (!removeChange.id) continue;
    const simName = getSimNodeNameById(removeChange.id);
    if (!simName) continue;
    deleteSimNode(simName);
    newSelectedSimNodes.delete(simName);
    selectionChanged = true;
  }
  return selectionChanged;
}

function extractPortNumber(iface: string): number {
  const ethernetRegex = /ethernet-1-(\d+)/;
  const ethernetMatch = ethernetRegex.exec(iface);
  if (ethernetMatch) return parseInt(ethernetMatch[1], 10);
  const ethRegex = /eth(\d+)/;
  const ethMatch = ethRegex.exec(iface);
  if (ethMatch) return parseInt(ethMatch[1], 10);
  return 0;
}

function getNextPortNumberForNode(edges: Edge<TopologyEdgeData>[], nodeId: string, useSource: boolean) {
  const portNumbers = edges.flatMap(e => {
    if (e.source === nodeId) {
      return e.data?.memberLinks?.map(ml => extractPortNumber(useSource ? ml.sourceInterface : ml.targetInterface)) || [];
    }
    if (e.target === nodeId) {
      return e.data?.memberLinks?.map(ml => extractPortNumber(useSource ? ml.targetInterface : ml.sourceInterface)) || [];
    }
    return [];
  });
  return Math.max(0, ...portNumbers) + 1;
}

export function pasteCopiedLinkIfNeeded(params: {
  clipboard: ReturnType<typeof useTopologyStore.getState>['clipboard'];
  addMemberLink: (edgeId: string, link: MemberLink) => void;
  triggerYamlRefresh: () => void;
}) {
  const { clipboard, addMemberLink, triggerYamlRefresh } = params;
  if (!clipboard.copiedLink) return false;

  const currentState = useTopologyStore.getState();
  const targetEdgeId = currentState.selectedEdgeId || clipboard.copiedLink.edgeId;
  const edge = currentState.edges.find(e => e.id === targetEdgeId);
  if (!edge || !edge.data) return true;

  const sourceIsSimNode = edge.source.startsWith('sim-');
  const targetIsSimNode = edge.target.startsWith('sim-');
  const nextSourcePort = getNextPortNumberForNode(currentState.edges, edge.source, true);
  const nextTargetPort = getNextPortNumberForNode(currentState.edges, edge.target, true);

  const sourceInterface = sourceIsSimNode ? `eth${nextSourcePort}` : `ethernet-1-${nextSourcePort}`;
  const targetInterface = targetIsSimNode ? `eth${nextTargetPort}` : `ethernet-1-${nextTargetPort}`;

  const memberLinks = edge.data.memberLinks || [];
  const nextLinkNumber = memberLinks.length + 1;

  addMemberLink(edge.id, {
    name: `${edge.data.targetNode}-${edge.data.sourceNode}-${nextLinkNumber}`,
    template: clipboard.copiedLink.template,
    sourceInterface,
    targetInterface,
  });
  triggerYamlRefresh();
  return true;
}

export function pasteCopiedSelectionIfNeeded(params: {
  clipboard: ReturnType<typeof useTopologyStore.getState>['clipboard'];
  contextMenu: { open: boolean; flowPosition: { x: number; y: number } };
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  mouseScreenPositionRef: MutableRef<{ x: number; y: number }>;
  pasteSelection: ReturnType<typeof useTopologyStore.getState>['pasteSelection'];
  isPastingRef: MutableRef<boolean>;
}) {
  const {
    clipboard,
    contextMenu,
    screenToFlowPosition,
    mouseScreenPositionRef,
    pasteSelection,
    isPastingRef,
  } = params;

  const { nodes: copiedNodes, edges: copiedEdges, simNodes: copiedSimNodes } = clipboard;
  if (copiedNodes.length === 0 && copiedSimNodes.length === 0) return false;

  isPastingRef.current = true;

  const allPositions = [
    ...copiedNodes.map(n => n.position),
    ...copiedSimNodes.map(sn => sn.position).filter((p): p is { x: number; y: number } => !!p),
  ];
  const centerX = allPositions.length > 0
    ? allPositions.reduce((sum, p) => sum + p.x, 0) / allPositions.length
    : 0;
  const centerY = allPositions.length > 0
    ? allPositions.reduce((sum, p) => sum + p.y, 0) / allPositions.length
    : 0;

  const cursorPos = contextMenu.open
    ? contextMenu.flowPosition
    : screenToFlowPosition(mouseScreenPositionRef.current);
  const offset = {
    x: cursorPos.x - centerX,
    y: cursorPos.y - centerY,
  };

  pasteSelection(copiedNodes, copiedEdges, offset, copiedSimNodes, cursorPos);

  setTimeout(() => {
    isPastingRef.current = false;
  }, 0);

  return true;
}

export function isEditableTarget(target: EventTarget | null) {
  if (!target || !(target as HTMLElement).tagName) return false;
  const element = target as HTMLElement;
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable;
}

export function isCtrlOrCmdPressed(e: KeyboardEvent) {
  const isMac = navigator.userAgent.toUpperCase().includes('MAC');
  return isMac ? e.metaKey : e.ctrlKey;
}

export function selectAllEntities() {
  const currentState = useTopologyStore.getState();
  const currentNodes = currentState.nodes;
  const currentEdges = currentState.edges;
  const currentSimNodes = currentState.simulation.simNodes;
  const currentShowSimNodes = currentState.showSimNodes;

  const selectableEdges = currentShowSimNodes
    ? currentEdges
    : currentEdges.filter(e => !e.source.startsWith('sim-') && !e.target.startsWith('sim-'));
  const allEdgeIds = selectableEdges.map(edge => edge.id);

  const simNodeNames = currentShowSimNodes && currentSimNodes.length > 0
    ? new Set(currentSimNodes.map(sn => sn.name))
    : new Set<string>();

  useTopologyStore.setState({
    nodes: currentNodes.map(n => ({ ...n, selected: true })),
    edges: currentEdges.map(edge => ({
      ...edge,
      selected: allEdgeIds.includes(edge.id),
    })),
    selectedEdgeIds: allEdgeIds,
    selectedEdgeId: allEdgeIds.length > 0 ? allEdgeIds[allEdgeIds.length - 1] : null,
    selectedNodeId: currentNodes.length > 0 ? currentNodes[currentNodes.length - 1].id : null,
    selectedSimNodeNames: simNodeNames,
    selectedSimNodeName: simNodeNames.size > 0 ? [...simNodeNames][simNodeNames.size - 1] : null,
  });
}

export function handleDeleteSelection(params: {
  deleteMemberLink: (edgeId: string, index: number) => void;
  clearMemberLinkSelection: () => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  deleteSimNode: (name: string) => void;
  selectSimNodes: (names: Set<string>) => void;
  triggerYamlRefresh: () => void;
}) {
  const {
    deleteMemberLink,
    clearMemberLinkSelection,
    deleteNode,
    deleteEdge,
    deleteSimNode,
    selectSimNodes,
    triggerYamlRefresh,
  } = params;

  const currentState = useTopologyStore.getState();

  if (currentState.selectedEdgeId && currentState.selectedMemberLinkIndices.length > 0) {
    const edge = currentState.edges.find(e => e.id === currentState.selectedEdgeId);
    const memberLinksCount = edge?.data?.memberLinks?.length || 0;

    if (memberLinksCount > 1) {
      const sortedIndices = [...currentState.selectedMemberLinkIndices].sort((a, b) => b - a);
      sortedIndices.forEach(index => deleteMemberLink(currentState.selectedEdgeId!, index));
      clearMemberLinkSelection();
      triggerYamlRefresh();
      return;
    }
  }

  const selectedNodeIds = currentState.nodes.filter(n => n.selected).map(n => n.id);
  selectedNodeIds.forEach(id => deleteNode(id));

  const selectedEdgeIdsList = currentState.edges.filter(e => e.selected).map(e => e.id);
  selectedEdgeIdsList.forEach(id => deleteEdge(id));

  if (currentState.selectedSimNodeNames.size > 0) {
    currentState.selectedSimNodeNames.forEach(name => deleteSimNode(name));
    selectSimNodes(new Set());
  }
}

export function handleGlobalKeyDown(params: {
  event: KeyboardEvent;
  handleUndo: () => void;
  handleRedo: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  deleteMemberLink: (edgeId: string, index: number) => void;
  clearMemberLinkSelection: () => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  deleteSimNode: (name: string) => void;
  selectSimNodes: (names: Set<string>) => void;
  triggerYamlRefresh: () => void;
}) {
  const {
    event,
    handleUndo,
    handleRedo,
    handleCopy,
    handlePaste,
    deleteMemberLink,
    clearMemberLinkSelection,
    deleteNode,
    deleteEdge,
    deleteSimNode,
    selectSimNodes,
    triggerYamlRefresh,
  } = params;

  if (isEditableTarget(event.target)) return;

  const isCtrlOrCmd = isCtrlOrCmdPressed(event);

  if (isUndoShortcut(event, isCtrlOrCmd)) {
    event.preventDefault();
    handleUndo();
    return;
  }

  if (isRedoShortcut(event, isCtrlOrCmd)) {
    event.preventDefault();
    handleRedo();
    return;
  }

  if (isSelectAllShortcut(event, isCtrlOrCmd)) {
    event.preventDefault();
    selectAllEntities();
    return;
  }

  if (isCopyShortcut(event, isCtrlOrCmd)) {
    handleCopy();
    return;
  }

  if (isPasteShortcut(event, isCtrlOrCmd)) {
    event.preventDefault();
    handlePaste();
    return;
  }

  if (isDeleteShortcut(event)) {
    handleDeleteSelection({
      deleteMemberLink,
      clearMemberLinkSelection,
      deleteNode,
      deleteEdge,
      deleteSimNode,
      selectSimNodes,
      triggerYamlRefresh,
    });
  }
}

function isUndoShortcut(event: KeyboardEvent, isCtrlOrCmd: boolean) {
  return isCtrlOrCmd && event.key === 'z' && !event.shiftKey;
}

function isRedoShortcut(event: KeyboardEvent, isCtrlOrCmd: boolean) {
  return isCtrlOrCmd && (event.key === 'y' || (event.key === 'z' && event.shiftKey));
}

function isSelectAllShortcut(event: KeyboardEvent, isCtrlOrCmd: boolean) {
  return isCtrlOrCmd && event.key === 'a';
}

function isCopyShortcut(event: KeyboardEvent, isCtrlOrCmd: boolean) {
  return isCtrlOrCmd && event.key === 'c';
}

function isPasteShortcut(event: KeyboardEvent, isCtrlOrCmd: boolean) {
  return isCtrlOrCmd && event.key === 'v';
}

function isDeleteShortcut(event: KeyboardEvent) {
  return event.key === 'Delete' || event.key === 'Backspace';
}

export function getSelectionType(params: {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedEdgeIds: string[];
  selectedSimNodeName: string | null;
}) {
  const { selectedNodeId, selectedEdgeId, selectedEdgeIds, selectedSimNodeName } = params;
  if (selectedNodeId) return 'node';
  if (selectedEdgeIds.length > 1) return 'multiEdge';
  if (selectedEdgeId) return 'edge';
  if (selectedSimNodeName) return 'simNode';
  return null;
}

function getSelectedEdgesById(edges: Edge<TopologyEdgeData>[], selectedEdgeIds: string[]) {
  const selectedEdges = selectedEdgeIds
    .map(id => edges.find(e => e.id === id))
    .filter((e): e is Edge<TopologyEdgeData> => e !== undefined);
  if (selectedEdges.length !== selectedEdgeIds.length) return null;
  return selectedEdges;
}

function validateEsiLagSize(esiLag: Edge<TopologyEdgeData> | undefined, regularEdges: Edge<TopologyEdgeData>[], selectedEdgesCount: number) {
  const esiLeafCount = esiLag?.data?.esiLeaves?.length || 0;
  const totalLeaves = esiLeafCount + regularEdges.length;

  if (esiLag && totalLeaves > 4) {
    return 'ESI-LAG cannot have more than 4 links';
  }

  if (!esiLag && selectedEdgesCount > 4) {
    return 'ESI-LAG cannot have more than 4 links';
  }

  return null;
}

function validateEsiLagCommonNode(esiLag: Edge<TopologyEdgeData>, regularEdges: Edge<TopologyEdgeData>[]) {
  const esiLagSourceId = esiLag.source;
  if (!esiLagSourceId.startsWith('sim-')) {
    return 'ESI-LAG common node must be a SimNode';
  }
  for (const edge of regularEdges) {
    if (edge.source !== esiLagSourceId && edge.target !== esiLagSourceId) {
      return 'Selected edges must share exactly one common node';
    }
  }
  return null;
}

function validateRegularEdgesCommonNode(regularEdges: Edge<TopologyEdgeData>[]) {
  const nodeCounts = new Map<string, number>();
  for (const edge of regularEdges) {
    nodeCounts.set(edge.source, (nodeCounts.get(edge.source) || 0) + 1);
    nodeCounts.set(edge.target, (nodeCounts.get(edge.target) || 0) + 1);
  }

  const commonNodes = [...nodeCounts.entries()].filter(([_, count]) => count === regularEdges.length);

  if (commonNodes.length !== 1) {
    return 'Selected edges must share exactly one common node';
  }

  const commonNodeId = commonNodes[0][0];
  if (!commonNodeId.startsWith('sim-')) {
    return 'ESI-LAG common node must be a SimNode';
  }

  return null;
}

export function validateEsiLagSelection(edges: Edge<TopologyEdgeData>[], selectedEdgeIds: string[]) {
  if (selectedEdgeIds.length < 2) return { valid: false, error: null };
  const selectedEdges = getSelectedEdgesById(edges, selectedEdgeIds);
  if (!selectedEdges) return { valid: false, error: null };

  const esiLagEdges = selectedEdges.filter(e => e.data?.isMultihomed);
  const regularEdges = selectedEdges.filter(e => !e.data?.isMultihomed);

  if (esiLagEdges.length > 1) {
    return { valid: false, error: 'Cannot merge multiple ESI-LAGs' };
  }

  const esiLag = esiLagEdges[0];
  const sizeError = validateEsiLagSize(esiLag, regularEdges, selectedEdges.length);
  if (sizeError) return { valid: false, error: sizeError };

  if (esiLag) {
    const commonNodeError = validateEsiLagCommonNode(esiLag, regularEdges);
    if (commonNodeError) return { valid: false, error: commonNodeError };
  } else {
    const commonNodeError = validateRegularEdgesCommonNode(regularEdges);
    if (commonNodeError) return { valid: false, error: commonNodeError };
  }

  return { valid: true, error: null, esiLag, regularEdges };
}
