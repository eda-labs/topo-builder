import { startTransition, useCallback, useState, useEffect, useMemo, useRef, type ReactNode, type SyntheticEvent } from 'react';
import {
  ReactFlow,
  Controls,
  ControlButton,
  Background,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
  useStoreApi,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  type NodeChange,
  type Connection,
  type OnSelectionChangeParams,
  type ReactFlowProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Tabs, Tab, useTheme, IconButton, Drawer, Typography, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  OpenInFull as OpenInFullIcon,
  CloseFullscreen as CloseFullscreenIcon,
  Timeline as ElbowRoutingIcon,
  Gesture as CurvedRoutingIcon,
} from '@mui/icons-material';
import { useShallow } from 'zustand/react/shallow';

import { useTopologyStore, undo, redo, clearUndoHistory, generateUniqueName, saveToUndoHistory, useUndoRedoState } from '../lib/store';
import { DRAWER_WIDTH, DRAWER_TRANSITION_DURATION_MS, EDGE_INTERACTION_WIDTH, ESI_LAG_MAX_EDGES, SESSION_NEW_LINK_ID } from '../lib/constants';
import type { UINodeData, UIEdgeData, UILagGroup } from '../types/ui';
import { useCopyPaste } from '../hooks/useCopyPaste';
import { resolveNodePanel } from '../lib/frontpanel';
import { osOfPlatform } from '../lib/catalog';

import { TopoNode, SimNode, TextAnnotation, ShapeAnnotation } from './nodes';
import { LinkEdge } from './edges';
import AppLayout, { type TopologyThemingProps } from './AppLayout';
import YamlEditor, { jumpToNodeInEditor, jumpToLinkInEditor, jumpToSimNodeInEditor, jumpToMemberLinkInEditor } from './YamlEditor';
import { SelectionPanel, NodeTemplatesPanel, LinkTemplatesPanel, SimNodeTemplatesPanel } from './PropertiesPanel';
import ContextMenu from './ContextMenu';
import PalettePanel, { readPaletteDrag, addPaletteItem } from './PalettePanel';
import PlatformDetailsPopover, { type PlatformDetail } from './PlatformDetailsPopover';
import CableHoverHud from './CableHoverHud';
import LinkKindLegend from './LinkKindLegend';

const nodeTypes: NodeTypes = {
  topoNode: TopoNode,
  simNode: SimNode,
  textAnnotation: TextAnnotation,
  shapeAnnotation: ShapeAnnotation,
};

const edgeTypes: EdgeTypes = {
  linkEdge: LinkEdge,
};

const SNAP_GRID: [number, number] = [15, 15];
const DEFAULT_EDGE_OPTIONS = { type: 'linkEdge', interactionWidth: EDGE_INTERACTION_WIDTH } as const;

export interface TopologyEditorProps extends TopologyThemingProps {
  renderYamlPanel?: () => ReactNode;
  reactFlowColorMode?: 'light' | 'dark';
}

// Everything the editor shell reads from the store, picked shallowly: a bare useTopologyStore()
// re-renders the whole canvas on every store write (each yamlRefreshCounter bump, EDA status
// poll, error toast), which is the single biggest render hotspot.
const pickEditorState = (state: ReturnType<typeof useTopologyStore.getState>) => ({
  nodes: state.nodes,
  edges: state.edges,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  selectNode: state.selectNode,
  selectEdge: state.selectEdge,
  selectSimNode: state.selectSimNode,
  selectSimNodes: state.selectSimNodes,
  selectedNodeId: state.selectedNodeId,
  selectedEdgeId: state.selectedEdgeId,
  selectedEdgeIds: state.selectedEdgeIds,
  selectedSimNodeName: state.selectedSimNodeName,
  selectedSimNodeNames: state.selectedSimNodeNames,
  selectedMemberLinkIndices: state.selectedMemberLinkIndices,
  addNode: state.addNode,
  deleteNode: state.deleteNode,
  deleteEdge: state.deleteEdge,
  updateMemberLink: state.updateMemberLink,
  deleteMemberLink: state.deleteMemberLink,
  clearMemberLinkSelection: state.clearMemberLinkSelection,
  selectedLagId: state.selectedLagId,
  updateEdge: state.updateEdge,
  addSimNode: state.addSimNode,
  deleteSimNode: state.deleteSimNode,
  simulation: state.simulation,
  showSimNodes: state.showSimNodes,
  setShowSimNodes: state.setShowSimNodes,
  expandedEdges: state.expandedEdges,
  toggleEdgeExpanded: state.toggleEdgeExpanded,
  toggleAllEdgesExpanded: state.toggleAllEdgesExpanded,
  clearAll: state.clearAll,
  layoutVersion: state.layoutVersion,
  triggerYamlRefresh: state.triggerYamlRefresh,
  nodeTemplates: state.nodeTemplates,
  linkTemplates: state.linkTemplates,
  createLagFromMemberLinks: state.createLagFromMemberLinks,
  createMultihomedLag: state.createMultihomedLag,
  mergeEdgesIntoEsiLag: state.mergeEdgesIntoEsiLag,
  setError: state.setError,
  syncSelectionFromReactFlow: state.syncSelectionFromReactFlow,
  annotations: state.annotations,
  selectedAnnotationId: state.selectedAnnotationId,
  selectedAnnotationIds: state.selectedAnnotationIds,
  addAnnotation: state.addAnnotation,
  updateAnnotation: state.updateAnnotation,
  deleteAnnotation: state.deleteAnnotation,
  selectAnnotation: state.selectAnnotation,
  selectAnnotations: state.selectAnnotations,
});

function resolveReactFlowColorMode({
  reactFlowColorMode,
  theme,
  themeOptions,
}: Pick<TopologyEditorProps, 'reactFlowColorMode' | 'theme' | 'themeOptions'>): 'light' | 'dark' {
  if (reactFlowColorMode) return reactFlowColorMode;
  if (theme?.palette.mode === 'light') return 'light';
  if (themeOptions?.palette?.mode === 'light') return 'light';
  return 'dark';
}

function areSameIndexSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;

  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);

  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

function findLagMatchingSelection(lagGroups: UILagGroup[] | undefined, selectedMemberLinkIndices: number[]): UILagGroup | null {
  if (!lagGroups || selectedMemberLinkIndices.length < 2) return null;

  for (const lag of lagGroups) {
    if (areSameIndexSet(lag.memberLinkIndices, selectedMemberLinkIndices)) return lag;
  }
  return null;
}

function getMemberLinkJumpTarget({
  activeTab,
  selectedEdgeId,
  selectedMemberLinkIndices,
  edges,
  expandedEdges,
}: {
  activeTab: number;
  selectedEdgeId: string | null;
  selectedMemberLinkIndices: number[];
  edges: Edge<UIEdgeData>[];
  expandedEdges: Set<string>;
}): { edgeId: string; memberIndex: number } | null {
  if (activeTab !== 0) return null;
  if (!selectedEdgeId) return null;
  if (selectedMemberLinkIndices.length === 0) return null;

  const edge = edges.find(e => e.id === selectedEdgeId);
  if (!edge?.data?.memberLinks) return null;
  if (edge.data.memberLinks.length <= 1) return null;
  if (!expandedEdges.has(selectedEdgeId)) return null;

  if (selectedMemberLinkIndices.length === 1) {
    return { edgeId: selectedEdgeId, memberIndex: selectedMemberLinkIndices[0] };
  }

  const matchingLag = findLagMatchingSelection(edge.data.lagGroups, selectedMemberLinkIndices);
  const firstMemberIndex = matchingLag?.memberLinkIndices[0];
  if (firstMemberIndex === undefined) return null;

  return { edgeId: selectedEdgeId, memberIndex: firstMemberIndex };
}

const plural = (count: number): string => (count === 1 ? '' : 's');

function shouldIgnoreGlobalHotkeyTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'INPUT') return true;
  if (el.tagName === 'TEXTAREA') return true;
  return el.isContentEditable;
}

function isCtrlOrCmdPressed(e: KeyboardEvent): boolean {
  const isMac = /mac/i.test(navigator.userAgent);
  return isMac ? e.metaKey : e.ctrlKey;
}

function handleUndoRedoHotkeys(
  e: KeyboardEvent,
  isCtrlOrCmd: boolean,
  onUndo: () => void,
  onRedo: () => void,
): boolean {
  if (!isCtrlOrCmd) return false;

  if (e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    onUndo();
    return true;
  }

  if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
    e.preventDefault();
    onRedo();
    return true;
  }

  return false;
}

function selectAllInStore(): void {
  const currentState = useTopologyStore.getState();
  const currentNodes = currentState.nodes;
  const currentEdges = currentState.edges;

  let selectableNodes = currentNodes;
  let selectableEdges = currentEdges;

  if (!currentState.showSimNodes) {
    selectableNodes = currentNodes.filter(n => n.data.nodeType !== 'simnode');
    const selectableNodeIds = new Set(selectableNodes.map(n => n.id));
    selectableEdges = currentEdges.filter(e => selectableNodeIds.has(e.source) && selectableNodeIds.has(e.target));
  }

  const allNodeIds = selectableNodes.map(n => n.id);
  const allEdgeIds = selectableEdges.map(e => e.id);
  const selectableNodeIds = new Set(allNodeIds);
  const selectableEdgeIds = new Set(allEdgeIds);

  const simNodes = selectableNodes.filter(n => n.data.nodeType === 'simnode');
  const simNodeNames = new Set(simNodes.map(n => n.data.name));
  const simNodeNameList = [...simNodeNames];
  const selectedSimNodeName = simNodeNameList.length > 0 ? simNodeNameList[simNodeNameList.length - 1] : null;

  const allAnnotationIds = new Set(currentState.annotations.map(a => a.id));
  const lastAnnotationId = currentState.annotations.length > 0
    ? currentState.annotations[currentState.annotations.length - 1].id
    : null;

  useTopologyStore.setState({
    nodes: currentNodes.map(n => ({ ...n, selected: selectableNodeIds.has(n.id) })),
    edges: currentEdges.map(e => ({ ...e, selected: selectableEdgeIds.has(e.id) })),
    selectedNodeIds: allNodeIds,
    selectedEdgeIds: allEdgeIds,
    selectedEdgeId: allEdgeIds.length > 0 ? allEdgeIds[allEdgeIds.length - 1] : null,
    selectedNodeId: allNodeIds.length > 0 ? allNodeIds[allNodeIds.length - 1] : null,
    selectedSimNodeNames: simNodeNames,
    selectedSimNodeName,
    selectedAnnotationId: lastAnnotationId,
    selectedAnnotationIds: allAnnotationIds,
  });
}

function handleSelectAllHotkey(e: KeyboardEvent, isCtrlOrCmd: boolean): boolean {
  if (!isCtrlOrCmd) return false;
  if (e.key !== 'a') return false;

  e.preventDefault();
  selectAllInStore();
  return true;
}

type DeleteHotkeyHandlers = {
  deleteMemberLink: (edgeId: string, index: number) => void;
  clearMemberLinkSelection: () => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  deleteSimNode: (simNodeName: string) => void;
  deleteAnnotation: (id: string) => void;
  selectSimNodes: (names: Set<string>) => void;
  triggerYamlRefresh: () => void;
};

function tryDeleteSelectedMemberLinks(
  state: ReturnType<typeof useTopologyStore.getState>,
  handlers: DeleteHotkeyHandlers,
): boolean {
  const selectedEdgeId = state.selectedEdgeId;
  if (!selectedEdgeId) return false;
  if (state.selectedMemberLinkIndices.length === 0) return false;

  const edge = state.edges.find(e => e.id === selectedEdgeId);
  const memberLinksCount = edge?.data?.memberLinks?.length ?? 0;
  if (memberLinksCount <= 1) return false;

  // Delete from highest index so earlier deletes don't shift later indices.
  const sortedIndices = [...state.selectedMemberLinkIndices].sort((a, b) => b - a);
  sortedIndices.forEach(index => { handlers.deleteMemberLink(selectedEdgeId, index); });
  handlers.clearMemberLinkSelection();
  handlers.triggerYamlRefresh();

  return true;
}

function deleteSelectedItems(state: ReturnType<typeof useTopologyStore.getState>, handlers: DeleteHotkeyHandlers): void {
  const selectedNodeIds = state.nodes.filter(n => n.selected).map(n => n.id);
  selectedNodeIds.forEach(id => { handlers.deleteNode(id); });

  const selectedEdgeIds = state.edges.filter(edge => edge.selected).map(edge => edge.id);
  selectedEdgeIds.forEach(id => { handlers.deleteEdge(id); });

  if (state.selectedSimNodeNames.size > 0) {
    state.selectedSimNodeNames.forEach(name => { handlers.deleteSimNode(name); });
    handlers.selectSimNodes(new Set());
  }

  if (state.selectedAnnotationIds.size > 0) {
    state.selectedAnnotationIds.forEach(id => { handlers.deleteAnnotation(id); });
  }
}

function handleDeleteHotkey(e: KeyboardEvent, handlers: DeleteHotkeyHandlers): boolean {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return false;

  const state = useTopologyStore.getState();
  if (tryDeleteSelectedMemberLinks(state, handlers)) return true;

  deleteSelectedItems(state, handlers);
  return true;
}

type EsiLagValidation =
  | { valid: false; error: string | null }
  | { valid: true; error: null; esiLag: Edge<UIEdgeData> | null; regularEdges: Edge<UIEdgeData>[] };

function getEdgesById(edges: Edge<UIEdgeData>[], ids: string[]): Edge<UIEdgeData>[] | null {
  const selectedEdges: Edge<UIEdgeData>[] = [];
  for (const id of ids) {
    const edge = edges.find(e => e.id === id);
    if (!edge) return null;
    selectedEdges.push(edge);
  }
  return selectedEdges;
}

function splitEsiLagEdges(selectedEdges: Edge<UIEdgeData>[]): {
  esiLag: Edge<UIEdgeData> | null;
  regularEdges: Edge<UIEdgeData>[];
  error?: string;
} {
  const esiLagEdges: Edge<UIEdgeData>[] = [];
  const regularEdges: Edge<UIEdgeData>[] = [];

  for (const edge of selectedEdges) {
    if (edge.data?.edgeType === 'esilag') esiLagEdges.push(edge);
    else regularEdges.push(edge);
  }

  if (esiLagEdges.length > 1) {
    return { esiLag: null, regularEdges, error: 'Cannot merge multiple ESI-LAGs' };
  }

  return { esiLag: esiLagEdges[0] ?? null, regularEdges };
}

function validateEsiLagSizeLimit(
  esiLag: Edge<UIEdgeData> | null,
  regularEdges: Edge<UIEdgeData>[],
  selectedEdgeCount: number,
): string | null {
  if (esiLag) {
    const esiLeafCount = esiLag.data?.esiLeaves?.length ?? 0;
    const totalLeaves = esiLeafCount + regularEdges.length;
    if (totalLeaves > ESI_LAG_MAX_EDGES) return `ESI-LAG cannot have more than ${ESI_LAG_MAX_EDGES} links`;
    return null;
  }

  if (selectedEdgeCount > ESI_LAG_MAX_EDGES) return `ESI-LAG cannot have more than ${ESI_LAG_MAX_EDGES} links`;
  return null;
}

function findCommonNodeId(edges: Edge<UIEdgeData>[]): string | null {
  const nodeCounts = new Map<string, number>();
  for (const edge of edges) {
    nodeCounts.set(edge.source, (nodeCounts.get(edge.source) ?? 0) + 1);
    nodeCounts.set(edge.target, (nodeCounts.get(edge.target) ?? 0) + 1);
  }

  const commonNodes: string[] = [];
  for (const [nodeId, count] of nodeCounts) {
    if (count === edges.length) commonNodes.push(nodeId);
  }

  if (commonNodes.length !== 1) return null;
  return commonNodes[0];
}

function validateEsiLagCommonNode(esiLag: Edge<UIEdgeData> | null, regularEdges: Edge<UIEdgeData>[]): string | null {
  if (esiLag) {
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

  const commonNodeId = findCommonNodeId(regularEdges);
  if (!commonNodeId) return 'Selected edges must share exactly one common node';
  if (!commonNodeId.startsWith('sim-')) return 'ESI-LAG common node must be a SimNode';

  return null;
}

function validateEsiLagSelection(selectedEdgeIds: string[], edges: Edge<UIEdgeData>[]): EsiLagValidation {
  if (selectedEdgeIds.length < 2) return { valid: false, error: null };

  const selectedEdges = getEdgesById(edges, selectedEdgeIds);
  if (!selectedEdges) return { valid: false, error: null };

  const { esiLag, regularEdges, error: splitError } = splitEsiLagEdges(selectedEdges);
  if (splitError) return { valid: false, error: splitError };

  const sizeError = validateEsiLagSizeLimit(esiLag, regularEdges, selectedEdges.length);
  if (sizeError) return { valid: false, error: sizeError };

  const commonNodeError = validateEsiLagCommonNode(esiLag, regularEdges);
  if (commonNodeError) return { valid: false, error: commonNodeError };

  return { valid: true, error: null, esiLag, regularEdges };
}

function LayoutHandler({ layoutVersion }: { layoutVersion: number }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const timer = setTimeout(() => { void fitView({ padding: 0.2 }); }, 50);
    return () => { clearTimeout(timer); };
  }, [layoutVersion, fitView]);

  return null;
}

function SidePanel({
  activeTab,
  onTabChange,
  open,
  onToggle,
  renderYamlPanel,
}: {
  activeTab: number;
  onTabChange: (tab: number) => void;
  open: boolean;
  onToggle: () => void;
  renderYamlPanel?: () => ReactNode;
}) {
  const theme = useTheme();
  const borderColor = theme.palette.divider;
  const contentBg = theme.palette.background.paper;

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('topology-panel-width');
    return saved ? parseInt(saved, 10) || DRAWER_WIDTH : DRAWER_WIDTH;
  });
  const dragging = useRef(false);
  const widthRef = useRef(panelWidth);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(DRAWER_WIDTH, Math.min(window.innerWidth * 0.8, window.innerWidth - ev.clientX));
      widthRef.current = newWidth;
      setPanelWidth(newWidth);
    };
    const onMouseUp = () => {
      dragging.current = false;
      localStorage.setItem('topology-panel-width', widthRef.current.toString());
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <>
      <IconButton
        onClick={onToggle}
        size="small"
        sx={{
          position: 'absolute',
          right: open ? panelWidth : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: theme.zIndex.drawer + 1,
          width: 24,
          height: 48,
          borderRadius: '12px 0 0 12px',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRight: 'none',
          transition: dragging.current ? 'none' : theme.transitions.create('right', {
            easing: theme.transitions.easing.easeInOut,
            duration: DRAWER_TRANSITION_DURATION_MS,
          }),
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {open ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </IconButton>

      <Drawer
        variant="persistent"
        anchor="right"
        open={open}
        transitionDuration={DRAWER_TRANSITION_DURATION_MS}
        sx={{
          width: open ? panelWidth : 0,
          flexShrink: 0,
          transition: dragging.current ? 'none' : theme.transitions.create('width', {
            easing: theme.transitions.easing.easeInOut,
            duration: DRAWER_TRANSITION_DURATION_MS,
          }),
          '& .MuiDrawer-paper': {
            width: panelWidth,
            boxSizing: 'border-box',
            position: 'relative',
            borderLeft: `1px solid ${borderColor}`,
            '&::before': {
              content: '""',
              position: 'absolute',
              left: -3,
              top: 0,
              bottom: 0,
              width: 6,
              cursor: 'col-resize',
              zIndex: 1,
            },
          },
        }}
        onMouseDown={(e: React.MouseEvent) => {
          const paper = (e.currentTarget as HTMLElement).querySelector('.MuiDrawer-paper');
          if (!paper) return;
          const rect = paper.getBoundingClientRect();
          if (e.clientX <= rect.left + 3) handleMouseDown(e);
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_: SyntheticEvent, v: number) => { onTabChange(v); }}
          sx={{
            borderBottom: `1px solid ${borderColor}`,
            minHeight: 36,
            bgcolor: 'background.paper',
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="YAML" sx={{ minHeight: 36, fontSize: '0.75rem', py: 0 }} />
          <Tab label="Edit" sx={{ minHeight: 36, fontSize: '0.75rem', py: 0 }} />
          <Tab label="Node Templates" sx={{ minHeight: 36, fontSize: '0.75rem', py: 0 }} />
          <Tab label="Link Templates" sx={{ minHeight: 36, fontSize: '0.75rem', py: 0 }} />
          <Tab label="Sim Templates" sx={{ minHeight: 36, fontSize: '0.75rem', py: 0 }} />
        </Tabs>
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: contentBg }}>
          <Box sx={{ flex: 1, overflow: 'auto', p: 0, display: activeTab === 0 ? 'flex' : 'none', flexDirection: 'column' }}>
            {renderYamlPanel ? renderYamlPanel() : <YamlEditor />}
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5, display: activeTab === 1 ? 'block' : 'none' }}>
            <SelectionPanel />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5, display: activeTab === 2 ? 'block' : 'none' }}>
            <NodeTemplatesPanel />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5, display: activeTab === 3 ? 'block' : 'none' }}>
            <LinkTemplatesPanel />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5, display: activeTab === 4 ? 'block' : 'none' }}>
            <SimNodeTemplatesPanel />
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

function TopologyControls({
  nodes,
  edges,
  showSimNodes,
  setShowSimNodes,
  expandedEdges,
  toggleAllEdgesExpanded,
}: {
  nodes: Node<UINodeData>[];
  edges: Edge<UIEdgeData>[];
  showSimNodes: boolean;
  setShowSimNodes: (show: boolean) => void;
  expandedEdges: Set<string>;
  toggleAllEdgesExpanded: () => void;
}) {
  const hasSimNodes = nodes.some(n => n.data.nodeType === 'simnode');
  const hasExpandableLinks = edges.some(e => (e.data?.memberLinks?.length ?? 0) > 1);
  const edgeRouting = useTopologyStore(state => state.edgeRouting);
  const setEdgeRouting = useTopologyStore(state => state.setEdgeRouting);

  return (
    <Controls position="top-right">
      <ControlButton
        onClick={() => { setEdgeRouting(edgeRouting === 'elbow' ? 'curved' : 'elbow'); }}
        title={edgeRouting === 'elbow' ? 'Cable routing: elbow — switch to curved' : 'Cable routing: curved — switch to elbow'}
        data-testid="edge-routing-toggle"
      >
        {edgeRouting === 'elbow' ? <ElbowRoutingIcon /> : <CurvedRoutingIcon />}
      </ControlButton>
      {hasSimNodes && (
        <ControlButton
          onClick={() => { setShowSimNodes(!showSimNodes); }}
          title={showSimNodes ? 'Hide SimNodes' : 'Show SimNodes'}
        >
          {showSimNodes ? <VisibilityIcon /> : <VisibilityOffIcon />}
        </ControlButton>
      )}
      {hasExpandableLinks && (
        <ControlButton
          onClick={toggleAllEdgesExpanded}
          title={expandedEdges.size > 0 ? 'Collapse all links' : 'Expand all links'}
        >
          {expandedEdges.size > 0 ? <CloseFullscreenIcon /> : <OpenInFullIcon />}
        </ControlButton>
      )}
    </Controls>
  );
}

function EmptyCanvasHint({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
      <Typography variant="h5" sx={{ color: 'text.disabled', userSelect: 'none' }}>
        Right-click to add your first node
      </Typography>
    </Box>
  );
}

type CanvasInteractionProps = Pick<
  ReactFlowProps<Node, Edge<UIEdgeData>>,
  | 'onEdgesChange'
  | 'onConnect'
  | 'onPaneClick'
  | 'onNodeClick'
  | 'onEdgeClick'
  | 'onNodeDoubleClick'
  | 'onEdgeDoubleClick'
  | 'onPaneContextMenu'
  | 'onNodeContextMenu'
  | 'onEdgeContextMenu'
  | 'onMoveStart'
  | 'onNodeDragStart'
  | 'onSelectionChange'
  | 'isValidConnection'
>;

interface TopologyCanvasProps extends CanvasInteractionProps {
  nodes: Node[];
  edges: Edge<UIEdgeData>[];
  controlNodes: Node<UINodeData>[];
  controlEdges: Edge<UIEdgeData>[];
  layoutVersion: number;
  colorMode: 'light' | 'dark';
  showSimNodes: boolean;
  setShowSimNodes: (show: boolean) => void;
  expandedEdges: Set<string>;
  toggleAllEdgesExpanded: () => void;
}

function isAnnotationChange(change: NodeChange): boolean {
  return 'id' in change && typeof change.id === 'string' && change.id.startsWith('a');
}

function isTransientDragChange(change: NodeChange): boolean {
  return change.type === 'position' && change.dragging === true;
}

function commitAnnotationPositions(changes: NodeChange[], refreshYaml: boolean): void {
  const positions = new Map<string, { x: number; y: number }>();
  for (const change of changes) {
    if (change.type === 'position' && change.position) {
      positions.set(change.id, change.position);
    }
  }
  if (positions.size === 0) return;

  useTopologyStore.setState(state => ({
    annotations: state.annotations.map(annotation => {
      const position = positions.get(annotation.id);
      return position ? { ...annotation, position } : annotation;
    }),
    ...(refreshYaml ? { yamlRefreshCounter: state.yamlRefreshCounter + 1 } : {}),
  }));
}

/**
 * Keeps pointer-frequency positions inside the canvas. Committing them to the persisted app
 * store on every mousemove used to serialize the whole topology and re-render every store
 * subscriber; React Flow now handles smooth internal updates locally and the durable state is
 * written once when the drag ends.
 */
function TopologyCanvas({
  nodes,
  edges,
  controlNodes,
  controlEdges,
  layoutVersion,
  colorMode,
  showSimNodes,
  setShowSimNodes,
  expandedEdges,
  toggleAllEdgesExpanded,
  ...interactionProps
}: TopologyCanvasProps) {
  const flowStore = useStoreApi();
  const initialNodes = useRef(nodes);
  const initialEdges = useRef(edges);

  useEffect(() => {
    flowStore.getState().setNodes(nodes);
  }, [flowStore, nodes]);

  useEffect(() => {
    flowStore.getState().setEdges(edges);
  }, [flowStore, edges]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const regularChanges: NodeChange<Node<UINodeData>>[] = [];
    const annotationChanges: NodeChange[] = [];
    for (const change of changes) {
      if (isTransientDragChange(change)) continue;
      if (isAnnotationChange(change)) {
        annotationChanges.push(change);
      } else {
        regularChanges.push(change as NodeChange<Node<UINodeData>>);
      }
    }

    const store = useTopologyStore.getState();
    if (regularChanges.length > 0) store.onNodesChange(regularChanges);
    const regularChangesRefreshYaml = regularChanges.some(change =>
      change.type === 'remove' || (change.type === 'position' && change.dragging === false));
    commitAnnotationPositions(annotationChanges, !regularChangesRefreshYaml);
  }, []);

  return (
    <ReactFlow
      defaultNodes={initialNodes.current}
      defaultEdges={initialEdges.current}
      onNodesChange={handleNodesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable
      nodeDragThreshold={2}
      elevateNodesOnSelect={false}
      snapToGrid
      snapGrid={SNAP_GRID}
      // Default minZoom (0.5) cannot fit wide fabrics (the AI-cluster example, wizard output)
      minZoom={0.05}
      connectionRadius={24}
      connectionMode={ConnectionMode.Loose}
      defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      colorMode={colorMode}
      deleteKeyCode={null}
      selectionKeyCode="Shift"
      multiSelectionKeyCode="Shift"
      selectionOnDrag
      onlyRenderVisibleElements
      {...interactionProps}
    >
      <TopologyControls
        nodes={controlNodes}
        edges={controlEdges}
        showSimNodes={showSimNodes}
        setShowSimNodes={setShowSimNodes}
        expandedEdges={expandedEdges}
        toggleAllEdgesExpanded={toggleAllEdgesExpanded}
      />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      <LayoutHandler layoutVersion={layoutVersion} />
      <EmptyCanvasHint show={controlNodes.length === 0} />
      <CableHoverHud />
      <LinkKindLegend />
    </ReactFlow>
  );
}

function TopologyEditorInner({
  theme,
  themeOptions,
  disableCssBaseline,
  styleVariables,
  renderYamlPanel,
  reactFlowColorMode,
}: TopologyEditorProps) {
  const flowColorMode = resolveReactFlowColorMode({ reactFlowColorMode, theme, themeOptions });
  const {
    nodes,
    edges,
    onEdgesChange,
    onConnect,
    selectNode,
    selectEdge,
    selectSimNode,
    selectSimNodes,
    selectedNodeId,
    selectedEdgeId,
    selectedEdgeIds,
    selectedSimNodeName,
    selectedSimNodeNames,
    selectedMemberLinkIndices,
    addNode,
    deleteNode,
    deleteEdge,
    updateMemberLink,
    deleteMemberLink,
    clearMemberLinkSelection,
    selectedLagId,
    updateEdge,
    addSimNode,
    deleteSimNode,
    simulation,
    showSimNodes,
    setShowSimNodes,
    expandedEdges,
    toggleEdgeExpanded,
    toggleAllEdgesExpanded,
    clearAll,
    layoutVersion,
    triggerYamlRefresh,
    nodeTemplates,
    linkTemplates,
    createLagFromMemberLinks,
    createMultihomedLag,
    mergeEdgesIntoEsiLag,
    setError,
    syncSelectionFromReactFlow,
    annotations,
    selectedAnnotationId,
    selectedAnnotationIds,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectAnnotation,
    selectAnnotations,
  } = useTopologyStore(useShallow(pickEditorState));

  const { screenToFlowPosition } = useReactFlow();

  const { canUndo: canUndoNow, canRedo: canRedoNow } = useUndoRedoState();

  const handleUndo = useCallback(() => {
    undo();
    triggerYamlRefresh();
  }, [triggerYamlRefresh]);

  const handleRedo = useCallback(() => {
    redo();
    triggerYamlRefresh();
  }, [triggerYamlRefresh]);

  useEffect(() => {
    clearUndoHistory();
  }, []);

  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('topology-active-tab');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    sessionStorage.setItem('topology-active-tab', activeTab.toString());
  }, [activeTab]);

  useEffect(() => {
    const newLinkId = sessionStorage.getItem(SESSION_NEW_LINK_ID);
    if (newLinkId && selectedEdgeId === newLinkId) {
      setActiveTab(1);
    }
  }, [selectedEdgeId]);

  useEffect(() => {
    if (selectedNodeId || selectedEdgeId || selectedSimNodeName || selectedAnnotationId) {
      startTransition(() => { setActiveTab(1); });
    }
  }, [selectedNodeId, selectedEdgeId, selectedSimNodeName, selectedAnnotationId]);

  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    position: { x: number; y: number };
    flowPosition: { x: number; y: number };
  }>({
    open: false,
    position: { x: 0, y: 0 },
    flowPosition: { x: 0, y: 0 },
  });

  const isPastingRef = useRef(false);

  const { handleCopy, handlePaste, hasClipboardData } = useCopyPaste({
    isPastingRef,
    contextMenuPosition: contextMenu.open ? contextMenu.flowPosition : null,
  });

  const handleConnect = useCallback((connection: Connection) => {
    onConnect(connection);
  }, [onConnect]);

  // Self-cabling a node to itself is never a topology link.
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => connection.source !== connection.target,
    [],
  );

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-topobuilder-template')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    const payload = readPaletteDrag(e);
    if (!payload) return;
    e.preventDefault();
    addPaletteItem(payload, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [screenToFlowPosition]);

  useEffect(() => {
    const target = getMemberLinkJumpTarget({
      activeTab,
      selectedEdgeId,
      selectedMemberLinkIndices,
      edges,
      expandedEdges,
    });
    if (!target) return;

    jumpToMemberLinkInEditor(target.edgeId, target.memberIndex);
  }, [activeTab, selectedEdgeId, selectedMemberLinkIndices, edges, expandedEdges]);

  const handleAnnotationEditComplete = useCallback((id: string, newText: string) => {
    const ann = annotations.find(a => a.id === id);
    if (ann && ann.type === 'text' && newText !== ann.text) {
      updateAnnotation(id, { text: newText });
    }
    setEditingAnnotationId(null);
  }, [annotations, updateAnnotation]);

  const handleAnnotationEditCancel = useCallback(() => {
    setEditingAnnotationId(null);
  }, []);

  const annotationNodes = useMemo(() => {
    return annotations.map(ann => {
      const base = {
        id: ann.id,
        position: ann.position,
        selected: selectedAnnotationIds.has(ann.id),
      };
      if (ann.type === 'text') {
        return {
          ...base,
          zIndex: 0,
          type: 'textAnnotation' as const,
          data: {
            annotationId: ann.id,
            text: ann.text,
            fontSize: ann.fontSize,
            fontColor: ann.fontColor,
            isEditing: editingAnnotationId === ann.id,
            onEditComplete: handleAnnotationEditComplete,
            onEditCancel: handleAnnotationEditCancel,
          },
        };
      }
      return {
        ...base,
        zIndex: -1,
        type: 'shapeAnnotation' as const,
        data: {
          annotationId: ann.id,
          shapeType: ann.shapeType,
          width: ann.width,
          height: ann.height,
          strokeColor: ann.strokeColor,
          fillColor: ann.fillColor,
          strokeWidth: ann.strokeWidth,
          strokeStyle: ann.strokeStyle,
        },
      };
    });
  }, [annotations, selectedAnnotationIds, editingAnnotationId, handleAnnotationEditComplete, handleAnnotationEditCancel]);

  const visibleNodes = useMemo(() => {
    const topoNodes = showSimNodes ? nodes : nodes.filter(n => n.data.nodeType !== 'simnode');
    return [...annotationNodes, ...topoNodes];
  }, [nodes, showSimNodes, annotationNodes]);

  const visibleEdges = useMemo(() => {
    if (showSimNodes) return edges;
    const simNodeIds = new Set(nodes.filter(n => n.data.nodeType === 'simnode').map(n => n.id));
    return edges.filter(e => !simNodeIds.has(e.source) && !simNodeIds.has(e.target));
  }, [edges, nodes, showSimNodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreGlobalHotkeyTarget(e.target)) return;

      const isCtrlOrCmd = isCtrlOrCmdPressed(e);

      if (handleUndoRedoHotkeys(e, isCtrlOrCmd, handleUndo, handleRedo)) return;
      if (handleSelectAllHotkey(e, isCtrlOrCmd)) return;

      handleDeleteHotkey(e, {
        deleteMemberLink,
        clearMemberLinkSelection,
        deleteNode,
        deleteEdge,
        deleteSimNode,
        deleteAnnotation,
        selectSimNodes,
        triggerYamlRefresh,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [handleUndo, handleRedo, deleteMemberLink, clearMemberLinkSelection, deleteNode, deleteEdge, deleteSimNode, deleteAnnotation, triggerYamlRefresh, selectSimNodes]);

  const handlePaneClick = useCallback(() => {
    const newLinkId = sessionStorage.getItem(SESSION_NEW_LINK_ID);
    if (newLinkId) {
      sessionStorage.removeItem(SESSION_NEW_LINK_ID);
      return;
    }
    selectNode(null);
    selectEdge(null);
    selectSimNode(null);
    selectAnnotation(null);
    setContextMenu(prev => ({ ...prev, open: false }));
  }, [selectNode, selectEdge, selectSimNode, selectAnnotation]);

  const handleMoveStart = useCallback(() => {
    setContextMenu(prev => prev.open ? { ...prev, open: false } : prev);
  }, []);

  const handleNodeDragStart = useCallback(() => {
    saveToUndoHistory();
    setContextMenu(prev => prev.open ? { ...prev, open: false } : prev);
  }, []);

  const handleSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
    if (isPastingRef.current) return;

    const annotationIds = new Set<string>();
    const regularNodeIds: string[] = [];

    for (const n of selectedNodes) {
      if (n.id.startsWith('a')) {
        annotationIds.add(n.id);
      } else {
        regularNodeIds.push(n.id);
      }
    }

    const edgeIds = selectedEdges.map(e => e.id);
    syncSelectionFromReactFlow(regularNodeIds, edgeIds);
    selectAnnotations(annotationIds);
  }, [syncSelectionFromReactFlow, selectAnnotations]);

  // Clear SimNode and sim-related edge selections when SimNodes are hidden
  useEffect(() => {
    if (!showSimNodes) {
      // Clear SimNode selections
      if (selectedSimNodeNames.size > 0) {
        selectSimNodes(new Set());
      }
      if (selectedSimNodeName) {
        selectSimNode(null);
      }
      const currentEdges = useTopologyStore.getState().edges;
      const simEdgeIds = new Set(
        currentEdges
          .filter(e => e.source.startsWith('sim-') || e.target.startsWith('sim-'))
          .map(e => e.id),
      );
      if (selectedEdgeIds.some(id => simEdgeIds.has(id))) {
        const nonSimSelectedEdges = selectedEdgeIds.filter(id => !simEdgeIds.has(id));
        if (nonSimSelectedEdges.length === 0) {
          selectEdge(null);
        } else {
          useTopologyStore.setState({
            selectedEdgeIds: nonSimSelectedEdges,
            selectedEdgeId: nonSimSelectedEdges[nonSimSelectedEdges.length - 1],
          });
        }
      }
    }
  }, [showSimNodes, selectedSimNodeNames, selectedSimNodeName, selectedEdgeIds, selectSimNodes, selectSimNode, selectEdge]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'textAnnotation' || node.type === 'shapeAnnotation') {
      selectAnnotation(node.id);
      selectNode(null);
      selectEdge(null);
      selectSimNode(null);
      setActiveTab(1);
      return;
    }
    selectAnnotation(null);
    if (activeTab === 0) {
      const nodeData = node.data as UINodeData;
      if (node.type === 'simNode') {
        jumpToSimNodeInEditor(nodeData.name);
      } else {
        jumpToNodeInEditor(nodeData.name);
      }
    }
  }, [activeTab, selectAnnotation, selectNode, selectEdge, selectSimNode]);

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge<UIEdgeData>) => {
    if (activeTab === 0 && edge.data && (edge.data.memberLinks?.length || 0) === 1) {
      jumpToLinkInEditor(edge.data.sourceNode, edge.data.targetNode);
    }
  }, [activeTab]);

  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'textAnnotation') {
      setEditingAnnotationId(node.id);
    }
  }, []);

  const handleEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge<UIEdgeData>) => {
    const linkCount = edge.data?.memberLinks?.length || 0;
    if (linkCount > 1) {
      toggleEdgeExpanded(edge.id);
    }
  }, [toggleEdgeExpanded]);

  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    selectNode(null);
    selectEdge(null);
    selectSimNode(null);
    setContextMenu({
      open: true,
      position: { x: event.clientX, y: event.clientY },
      flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    });
  }, [screenToFlowPosition, selectNode, selectEdge, selectSimNode]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    if (node.type === 'textAnnotation' || node.type === 'shapeAnnotation') {
      selectAnnotation(node.id);
      selectNode(null);
      selectEdge(null);
      selectSimNode(null);
    } else if (node.type === 'simNode') {
      selectAnnotation(null);
      // selectNode(null);
      // selectEdge(null);
      selectSimNode((node.data as UINodeData).name);
    } else {
      selectAnnotation(null);
      // selectEdge(null);
      // selectSimNode(null);
      selectNode(node.id);
    }
    setContextMenu({
      open: true,
      position: { x: event.clientX, y: event.clientY },
      flowPosition: { x: 0, y: 0 },
    });
  }, [selectNode, selectSimNode, selectEdge, selectAnnotation]);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge<UIEdgeData>) => {
    event.preventDefault();
    // Don't show context menu for sim-related edges when SimNodes are hidden
    if (!showSimNodes && (edge.source.startsWith('sim-') || edge.target.startsWith('sim-'))) {
      return;
    }
    const isExpanded = expandedEdges.has(edge.id);
    const hasMemberLinks = (edge.data?.memberLinks?.length || 0) > 1;
    // Port-anchored cables select their member link in their own contextmenu handler (which runs
    // before this one) — read the store fresh and keep that selection instead of clobbering it
    // with a whole-edge selection.
    const freshState = useTopologyStore.getState();
    const memberSelectionActive = freshState.selectedEdgeId === edge.id
      && (freshState.selectedMemberLinkIndices.length > 0 || freshState.selectedLagId !== null);
    if ((isExpanded || memberSelectionActive) && hasMemberLinks) {
      setContextMenu({
        open: true,
        position: { x: event.clientX, y: event.clientY },
        flowPosition: { x: 0, y: 0 },
      });
      return;
    }
    // If this edge is already in the selection, preserve multi-selection
    // Otherwise, select just this edge (unless shift is held)
    if (!selectedEdgeIds.includes(edge.id)) {
      selectEdge(edge.id, event.shiftKey);
    }
    setContextMenu({
      open: true,
      position: { x: event.clientX, y: event.clientY },
      flowPosition: { x: 0, y: 0 },
    });
  }, [selectEdge, selectedEdgeIds, showSimNodes, expandedEdges]);

  const handleCloseContextMenu = () => {
    setContextMenu(prev => ({ ...prev, open: false }));
    triggerYamlRefresh();
  };

  const handleAddNode = (templateName?: string) => { addNode(contextMenu.flowPosition, templateName); };
  const handleDeleteNode = () => { if (selectedNodeId) deleteNode(selectedNodeId); };

  // "Platform Details" on a node's context menu — same card as the palette, anchored where the
  // menu opened (canvas clicks stay reserved for selection).
  const [nodeDetails, setNodeDetails] = useState<{ position: { top: number; left: number }; detail: PlatformDetail } | null>(null);
  const handleShowNodeDetails = () => {
    const state = useTopologyStore.getState();
    const node = state.nodes.find(n => n.id === state.selectedNodeId);
    if (!node) return;
    const template = node.data.template ? state.nodeTemplates.find(t => t.name === node.data.template) : undefined;
    const panel = resolveNodePanel(node.data, state.nodeTemplates);
    const platform = panel?.platform ?? node.data.platform ?? template?.platform ?? '';
    const components = panel?.components ?? node.data.components ?? template?.components;
    setNodeDetails({
      position: { top: contextMenu.position.y, left: contextMenu.position.x },
      detail: {
        title: node.data.name,
        platform,
        os: osOfPlatform(platform),
        stencil: panel?.stencil ?? null,
        components,
      },
    });
  };

  // "Save as Template" on a node's context menu: capture the node's platform/profile/components
  // as a reusable node template (it appears in the palette's TEMPLATES section).
  const handleSaveNodeAsTemplate = () => {
    const state = useTopologyStore.getState();
    const node = state.nodes.find(n => n.id === state.selectedNodeId);
    if (!node) return;
    const template = node.data.template ? state.nodeTemplates.find(t => t.name === node.data.template) : undefined;
    const existing = new Set(state.nodeTemplates.map(t => t.name));
    const base = `${node.data.name}-tpl`;
    let name = base;
    for (let i = 2; existing.has(name); i++) name = `${base}-${i}`;
    const labels = { ...template?.labels, ...node.data.labels };
    state.addNodeTemplate({
      name,
      platform: node.data.platform ?? template?.platform,
      nodeProfile: node.data.nodeProfile ?? template?.nodeProfile,
      components: node.data.components ?? template?.components,
      labels: Object.keys(labels).length ? labels : undefined,
    });
  };
  // Delete only the selected member link(s) when a subset of a bundle is selected (e.g. a single
  // cable was clicked); the whole edge goes only when everything on it is selected.
  const handleDeleteEdge = () => {
    const state = useTopologyStore.getState();
    const edgeId = state.selectedEdgeId;
    if (!edgeId) return;
    const edge = state.edges.find(e => e.id === edgeId);
    const memberCount = edge?.data?.memberLinks?.length ?? 0;
    const indices = state.selectedMemberLinkIndices;
    if (indices.length > 0 && memberCount > indices.length) {
      [...indices].sort((a, b) => b - a).forEach(index => { deleteMemberLink(edgeId, index); });
      clearMemberLinkSelection();
      triggerYamlRefresh();
      return;
    }
    deleteEdge(edgeId);
  };
  const handleDeleteAllEdgeLinks = () => { if (selectedEdgeId) deleteEdge(selectedEdgeId); };
  const handleCreateLag = () => {
    if (selectedEdgeId && selectedMemberLinkIndices.length >= 2) {
      createLagFromMemberLinks(selectedEdgeId, selectedMemberLinkIndices);
    }
  };

  // One-click LAG grouping for the selected edge: every member link not already in a LAG.
  const ungroupedMemberIndices = useMemo(() => {
    const edge = edges.find(e => e.id === selectedEdgeId);
    if (!edge?.data?.memberLinks || edge.data.edgeType === 'esilag') return [];
    const grouped = new Set((edge.data.lagGroups ?? []).flatMap(lag => lag.memberLinkIndices));
    return edge.data.memberLinks.map((_, index) => index).filter(index => !grouped.has(index));
  }, [edges, selectedEdgeId]);

  const handleGroupAllLinks = () => {
    if (selectedEdgeId && ungroupedMemberIndices.length >= 2) {
      createLagFromMemberLinks(selectedEdgeId, ungroupedMemberIndices);
    }
  };

  const handleUngroupLag = () => {
    if (selectedEdgeId && selectedLagId) {
      useTopologyStore.getState().dissolveLag(selectedEdgeId, selectedLagId);
    }
  };

  const canCopy = nodes.some(n => n.selected) || edges.some(e => e.selected);
  const canPaste = hasClipboardData();
  const hasContent = nodes.length + edges.length > 0;

  // Clear All wipes the whole canvas in one click — gate it behind a confirmation.
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const handleConfirmClearAll = () => {
    clearAll();
    setConfirmClearOpen(false);
  };

  const esiLagValidation = useMemo(
    () => validateEsiLagSelection(selectedEdgeIds, edges),
    [selectedEdgeIds, edges],
  );

  const canCreateEsiLag = esiLagValidation.valid;
  const isMergeIntoEsiLag = esiLagValidation.valid && esiLagValidation.esiLag !== null;

  const handleCreateEsiLag = () => {
    if (!esiLagValidation.valid) {
      if (esiLagValidation.error) setError(esiLagValidation.error);
      return;
    }

    const { esiLag, regularEdges } = esiLagValidation;
    if (esiLag) {
      mergeEdgesIntoEsiLag(esiLag.id, regularEdges.map(e => e.id));
      return;
    }

    createMultihomedLag(selectedEdgeIds[0], selectedEdgeIds[1], selectedEdgeIds.slice(2));
  };

  // Right-clicking one cable of a multihomed sim node offers the whole Multihome LAG in one
  // step: every edge of that sim node (an existing ESI-LAG included, which turns the action
  // into a merge) — no multi-edge shift-selection needed.
  const esiFromEdgeValidation = useMemo(() => {
    const edge = edges.find(e => e.id === selectedEdgeId);
    if (!edge || edge.data?.edgeType === 'esilag') return null;
    const simId = [edge.source, edge.target].find(id => id.startsWith('sim-'));
    if (!simId) return null;
    const siblings = edges.filter(e => e.source === simId || e.target === simId);
    if (siblings.length < 2) return null;
    const validation = validateEsiLagSelection(siblings.map(e => e.id), edges);
    return validation.valid ? validation : null;
  }, [edges, selectedEdgeId]);

  const handleCreateEsiLagFromEdge = () => {
    if (!esiFromEdgeValidation) return;
    const { esiLag, regularEdges } = esiFromEdgeValidation;
    if (esiLag) {
      mergeEdgesIntoEsiLag(esiLag.id, regularEdges.map(e => e.id));
      return;
    }
    const ids = regularEdges.map(e => e.id);
    createMultihomedLag(ids[0], ids[1], ids.slice(2));
  };

  const isEsiLagSelected = selectedEdgeId !== null
    && edges.find(e => e.id === selectedEdgeId)?.data?.edgeType === 'esilag';

  const handleUngroupEsiLag = () => {
    if (selectedEdgeId) useTopologyStore.getState().dissolveEsiLag(selectedEdgeId);
  };

  const handleChangeNodeTemplate = (templateName: string) => {
    if (selectedNodeId) {
      useTopologyStore.getState().updateNode(selectedNodeId, { template: templateName });
      triggerYamlRefresh();
    }
  };

  const handleChangeSimNodeTemplate = (templateName: string) => {
    if (selectedSimNodeName) {
      useTopologyStore.getState().updateSimNode(selectedSimNodeName, { template: templateName });
      triggerYamlRefresh();
    }
  };

  const handleChangeLinkTemplate = (templateName: string) => {
    if (!selectedEdgeId) return;

    const edge = edges.find(e => e.id === selectedEdgeId);
    if (!edge?.data) return;

    if (selectedMemberLinkIndices.length > 0) {
      selectedMemberLinkIndices.forEach(index => {
        updateMemberLink(selectedEdgeId, index, { template: templateName });
      });
    }
    else if (selectedLagId) {
      const lagGroups = edge.data.lagGroups || [];
      const lag = lagGroups.find(l => l.id === selectedLagId);
      if (lag) {
        const updatedLagGroups = lagGroups.map(l =>
          l.id === selectedLagId ? { ...l, template: templateName } : l,
        );
        updateEdge(selectedEdgeId, { lagGroups: updatedLagGroups });
        lag.memberLinkIndices.forEach(index => {
          updateMemberLink(selectedEdgeId, index, { template: templateName });
        });
      }
    }
    else {
      const memberLinks = edge.data.memberLinks || [];
      memberLinks.forEach((_, index) => {
        updateMemberLink(selectedEdgeId, index, { template: templateName });
      });
    }
    triggerYamlRefresh();
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const currentNodeTemplate = selectedNode?.data?.template;

  const selectedSimNode = nodes.find(n => n.data.nodeType === 'simnode' && n.data.name === selectedSimNodeName);
  const currentSimNodeTemplate = selectedSimNode?.data?.template;

  const currentLinkTemplate = (() => {
    if (!selectedEdgeId) return undefined;
    const edge = edges.find(e => e.id === selectedEdgeId);
    if (!edge?.data) return undefined;

    if (selectedMemberLinkIndices.length > 0) {
      const memberLinks = edge.data.memberLinks || [];
      return memberLinks[selectedMemberLinkIndices[0]]?.template;
    }

    if (selectedLagId) {
      const lag = edge.data.lagGroups?.find(l => l.id === selectedLagId);
      return lag?.template;
    }
    return edge.data.memberLinks?.[0]?.template;
  })();

  const handleAddSimNode = () => {
    const simNodes = nodes.filter(n => n.data.nodeType === 'simnode');
    const existingNames = simNodes.map(n => n.data.name);
    const newName = generateUniqueName('testman', existingNames, simNodes.length + 1);
    addSimNode({
      name: newName,
      template: simulation.simNodeTemplates[0]?.name,
      position: contextMenu.flowPosition,
    });
    selectSimNodes(new Set([newName]));
  };

  const handleDeleteSimNode = () => { if (selectedSimNodeName) deleteSimNode(selectedSimNodeName); };

  const handleDeleteAnnotation = () => { if (selectedAnnotationId) deleteAnnotation(selectedAnnotationId); };

  const hasSelection = (() => {
    if (selectedAnnotationId) return 'annotation' as const;
    if (selectedSimNodeName) return 'simNode' as const;
    if (selectedNodeId) return 'node' as const;
    if (selectedEdgeIds.length > 1) return 'multiEdge' as const;
    if (selectedEdgeId) return 'edge' as const;
    return null;
  })();

  return (
    <AppLayout
      theme={theme}
      themeOptions={themeOptions}
      disableCssBaseline={disableCssBaseline}
      styleVariables={styleVariables}
    >
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <PalettePanel />
        <Box
          onContextMenu={e => { e.preventDefault(); }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          data-testid="topology-canvas"
          sx={{
            flex: 1,
            position: 'relative',
            '& .react-flow__edges': { zIndex: '0 !important' },
            '& .react-flow__edge-labels': { zIndex: '0 !important' },
            '& .react-flow__nodes': { zIndex: 'auto !important' },
          }}
        >
          <TopologyCanvas
            key={layoutVersion}
            nodes={visibleNodes}
            edges={visibleEdges}
            controlNodes={nodes}
            controlEdges={edges}
            layoutVersion={layoutVersion}
            colorMode={flowColorMode}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onPaneClick={handlePaneClick}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            onPaneContextMenu={handlePaneContextMenu}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onMoveStart={handleMoveStart}
            onNodeDragStart={handleNodeDragStart}
            isValidConnection={isValidConnection}
            onSelectionChange={handleSelectionChange}
            showSimNodes={showSimNodes}
            setShowSimNodes={setShowSimNodes}
            expandedEdges={expandedEdges}
            toggleAllEdgesExpanded={toggleAllEdgesExpanded}
          />
        </Box>

        <SidePanel
          activeTab={activeTab}
          onTabChange={(tab: number) => { setActiveTab(tab); if (tab === 0) triggerYamlRefresh(); }}
          open={panelOpen}
          onToggle={() => { setPanelOpen(!panelOpen); }}
          renderYamlPanel={renderYamlPanel}
        />
      </Box>

      <ContextMenu
        open={contextMenu.open}
        position={contextMenu.position}
        onClose={handleCloseContextMenu}
        onAddNode={handleAddNode}
        onAddSimNode={handleAddSimNode}
        onDeleteNode={handleDeleteNode}
        onShowNodeDetails={handleShowNodeDetails}
        onSaveNodeAsTemplate={handleSaveNodeAsTemplate}
        onDeleteEdge={handleDeleteEdge}
        onDeleteAllLinks={handleDeleteAllEdgeLinks}
        memberLinkTotal={selectedEdgeId ? edges.find(e => e.id === selectedEdgeId)?.data?.memberLinks?.length ?? 0 : 0}
        ungroupedMemberCount={ungroupedMemberIndices.length}
        isLagSelected={selectedLagId !== null}
        onGroupAllLinks={handleGroupAllLinks}
        onUngroupLag={handleUngroupLag}
        canCreateMultihomeLag={esiFromEdgeValidation !== null}
        isMergeIntoMultihomeLag={esiFromEdgeValidation?.esiLag != null}
        onCreateMultihomeLag={handleCreateEsiLagFromEdge}
        isEsiLagSelected={isEsiLagSelected}
        onUngroupEsiLag={handleUngroupEsiLag}
        onDeleteSimNode={handleDeleteSimNode}
        onChangeNodeTemplate={handleChangeNodeTemplate}
        onChangeSimNodeTemplate={handleChangeSimNodeTemplate}
        onChangeLinkTemplate={handleChangeLinkTemplate}
        onCreateLag={handleCreateLag}
        onCreateEsiLag={handleCreateEsiLag}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndoNow}
        canRedo={canRedoNow}
        currentNodeTemplate={currentNodeTemplate}
        currentSimNodeTemplate={currentSimNodeTemplate}
        linkTemplates={linkTemplates}
        currentLinkTemplate={currentLinkTemplate}
        onClearAll={() => { setConfirmClearOpen(true); }}
        hasSelection={hasSelection}
        hasContent={hasContent}
        canCopy={canCopy}
        canPaste={canPaste}
        nodeTemplates={nodeTemplates}
        simNodeTemplates={simulation.simNodeTemplates}
        selectedMemberLinkCount={selectedMemberLinkIndices.length}
        canCreateEsiLag={canCreateEsiLag}
        isMergeIntoEsiLag={isMergeIntoEsiLag}
        onAddAnnotation={addAnnotation}
        onDeleteAnnotation={handleDeleteAnnotation}
        contextMenuFlowPosition={contextMenu.flowPosition}
      />

      <Dialog
        open={confirmClearOpen}
        onClose={() => { setConfirmClearOpen(false); }}
        maxWidth="xs"
        fullWidth
        data-testid="clear-all-confirm-dialog"
      >
        <DialogTitle>Clear entire topology?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes all {nodes.length} node{plural(nodes.length)} and {edges.length} link{plural(edges.length)} from
            the canvas and resets the templates. Undo can restore the topology.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmClearOpen(false); }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            data-testid="clear-all-confirm-button"
            onClick={handleConfirmClearAll}
          >
            Clear All
          </Button>
        </DialogActions>
      </Dialog>

      {nodeDetails && (
        <PlatformDetailsPopover
          anchorPosition={nodeDetails.position}
          detail={nodeDetails.detail}
          onClose={() => { setNodeDetails(null); }}
        />
      )}
    </AppLayout>
  );
}

export default function TopologyEditor({
  theme,
  themeOptions,
  disableCssBaseline,
  styleVariables,
  renderYamlPanel,
  reactFlowColorMode,
}: TopologyEditorProps = {}) {
  return (
    <ReactFlowProvider>
      <TopologyEditorInner
        theme={theme}
        themeOptions={themeOptions}
        disableCssBaseline={disableCssBaseline}
        styleVariables={styleVariables}
        renderYamlPanel={renderYamlPanel}
        reactFlowColorMode={reactFlowColorMode}
      />
    </ReactFlowProvider>
  );
}
