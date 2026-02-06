import { useCallback, useState, useEffect, useMemo, useRef, type SyntheticEvent } from 'react';
import {
  ReactFlow,
  Controls,
  ControlButton,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  type NodeChange,
  type Connection,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Tabs, Tab, useTheme, IconButton, Drawer, Typography } from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  OpenInFull as OpenInFullIcon,
  CloseFullscreen as CloseFullscreenIcon,
} from '@mui/icons-material';

import { useTopologyStore, undo, redo, canUndo, canRedo, clearUndoHistory } from '../lib/store';
import { generateUniqueName } from '../lib/utils';
import { DRAWER_WIDTH, DRAWER_TRANSITION_DURATION_MS, EDGE_INTERACTION_WIDTH } from '../lib/constants';
import type { UINodeData, UIEdgeData } from '../types/ui';
import { useCopyPaste } from '../hooks/useCopyPaste';
import { TopoNode, SimNode } from './nodes';
import { LinkEdge } from './edges';
import AppLayout from './AppLayout';
import YamlEditor, { jumpToNodeInEditor, jumpToLinkInEditor, jumpToSimNodeInEditor, jumpToMemberLinkInEditor } from './YamlEditor';
import { SelectionPanel, NodeTemplatesPanel, LinkTemplatesPanel, SimNodeTemplatesPanel } from './PropertiesPanel';
import ContextMenu from './ContextMenu';

const nodeTypes: NodeTypes = {
  topoNode: TopoNode,
  simNode: SimNode,
};

const edgeTypes: EdgeTypes = {
  linkEdge: LinkEdge,
};

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
}: {
  activeTab: number;
  onTabChange: (tab: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const borderColor = isDark ? '#424242' : '#e0e0e0';
  const contentBg = isDark ? '#121212' : '#ffffff';

  return (
    <>
      <IconButton
        onClick={onToggle}
        size="small"
        sx={{
          position: 'absolute',
          right: open ? DRAWER_WIDTH : 0,
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
          transition: theme.transitions.create('right', {
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
          width: open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.easeInOut,
            duration: DRAWER_TRANSITION_DURATION_MS,
          }),
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            position: 'relative',
            borderLeft: `1px solid ${borderColor}`,
          },
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_: SyntheticEvent, v: number) => { onTabChange(v); }}
          sx={{
            borderBottom: `1px solid ${borderColor}`,
            minHeight: 36,
            bgcolor: isDark ? '#1e1e1e' : '#f5f5f5',
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
        <Box sx={{ flex: 1, overflow: 'auto', p: activeTab === 0 ? 0 : 1.5, bgcolor: contentBg }}>
          {activeTab === 0 && <YamlEditor />}
          {activeTab === 1 && <SelectionPanel />}
          {activeTab === 2 && <NodeTemplatesPanel />}
          {activeTab === 3 && <LinkTemplatesPanel />}
          {activeTab === 4 && <SimNodeTemplatesPanel />}
        </Box>
      </Drawer>
    </>
  );
}

function TopologyEditorInner() {
  const {
    nodes,
    edges,
    onNodesChange,
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
    darkMode,
    nodeTemplates,
    linkTemplates,
    createLagFromMemberLinks,
    createMultihomedLag,
    mergeEdgesIntoEsiLag,
    setError,
    syncSelectionFromReactFlow,
  } = useTopologyStore();

  const { screenToFlowPosition } = useReactFlow();

  const [undoRedoTrigger, setUndoRedoTrigger] = useState(0);
  const canUndoNow = undoRedoTrigger >= 0 && canUndo();
  const canRedoNow = undoRedoTrigger >= 0 && canRedo();

  const handleUndo = useCallback(() => {
    undo();
    setUndoRedoTrigger(n => n + 1);
    triggerYamlRefresh();
  }, [triggerYamlRefresh]);

  const handleRedo = useCallback(() => {
    redo();
    setUndoRedoTrigger(n => n + 1);
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
    const newLinkId = sessionStorage.getItem('topology-new-link-id');
    if (newLinkId && selectedEdgeId === newLinkId) {
      setActiveTab(1);
    }
  }, [selectedEdgeId]);

  useEffect(() => {
    if (selectedNodeId || selectedEdgeId || selectedSimNodeName) {
      setActiveTab(1);
    }
  }, [selectedNodeId, selectedEdgeId, selectedSimNodeName]);

  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    position: { x: number; y: number };
    flowPosition: { x: number; y: number };
  }>({
    open: false,
    position: { x: 0, y: 0 },
    flowPosition: { x: 0, y: 0 },
  });

  const justConnectedRef = useRef(false);
  const isPastingRef = useRef(false);

  const { handleCopy, handlePaste, hasClipboardData } = useCopyPaste({
    isPastingRef,
    contextMenuPosition: contextMenu.open ? contextMenu.flowPosition : null,
  });

  const handleConnect = useCallback((connection: Connection) => {
    justConnectedRef.current = true;
    onConnect(connection);
    setTimeout(() => {
      justConnectedRef.current = false;
    }, 100);
  }, [onConnect]);

  useEffect(() => {
    if (activeTab !== 0 || !selectedEdgeId || selectedMemberLinkIndices.length === 0) return;

    const edge = edges.find(e => e.id === selectedEdgeId);
    const memberLinks = edge?.data?.memberLinks;
    const lagGroups = edge?.data?.lagGroups;

    if (!memberLinks || memberLinks.length <= 1 || !expandedEdges.has(selectedEdgeId)) return;

    if (lagGroups && selectedMemberLinkIndices.length >= 2) {
      const sortedSelected = [...selectedMemberLinkIndices].sort((a, b) => a - b);
      for (const lag of lagGroups) {
        const sortedLagIndices = [...lag.memberLinkIndices].sort((a, b) => a - b);
        if (sortedSelected.length === sortedLagIndices.length &&
            sortedSelected.every((idx, i) => idx === sortedLagIndices[i])) {
          const firstMemberIndex = lag.memberLinkIndices[0];
          jumpToMemberLinkInEditor(selectedEdgeId, firstMemberIndex);
          return;
        }
      }
    }

    if (selectedMemberLinkIndices.length === 1) {
      jumpToMemberLinkInEditor(selectedEdgeId, selectedMemberLinkIndices[0]);
    }
  }, [activeTab, selectedEdgeId, selectedMemberLinkIndices, edges, expandedEdges]);

  const visibleNodes = useMemo(() => {
    if (showSimNodes) return nodes;
    return nodes.filter(n => n.data.nodeType !== 'simnode');
  }, [nodes, showSimNodes]);

  const visibleEdges = useMemo(() => {
    if (showSimNodes) return edges;
    const simNodeIds = new Set(nodes.filter(n => n.data.nodeType === 'simnode').map(n => n.id));
    return edges.filter(e => !simNodeIds.has(e.source) && !simNodeIds.has(e.target));
  }, [edges, nodes, showSimNodes]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes as NodeChange<Node<UINodeData>>[]);
  }, [onNodesChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const isMac = /mac/i.test(navigator.userAgent);
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (isCtrlOrCmd && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isCtrlOrCmd && e.key === 'a') {
        e.preventDefault();
        const currentState = useTopologyStore.getState();
        const currentNodes = currentState.nodes;
        const currentEdges = currentState.edges;
        const currentShowSimNodes = currentState.showSimNodes;

        const selectableNodeIds = new Set(
          currentShowSimNodes
            ? currentNodes.map(n => n.id)
            : currentNodes.filter(n => n.data.nodeType !== 'simnode').map(n => n.id),
        );
        const selectableEdgeIds = new Set(
          currentShowSimNodes
            ? currentEdges.map(e => e.id)
            : currentEdges.filter(e => !e.source.startsWith('sim-') && !e.target.startsWith('sim-')).map(e => e.id),
        );

        const allNodeIds = [...selectableNodeIds];
        const allEdgeIds = [...selectableEdgeIds];
        const simNodes = currentNodes.filter(n => n.data.nodeType === 'simnode' && selectableNodeIds.has(n.id));
        const simNodeNames = new Set(simNodes.map(n => n.data.name));

        useTopologyStore.setState({
          nodes: currentNodes.map(n => ({ ...n, selected: selectableNodeIds.has(n.id) })),
          edges: currentEdges.map(e => ({ ...e, selected: selectableEdgeIds.has(e.id) })),
          selectedNodeIds: allNodeIds,
          selectedEdgeIds: allEdgeIds,
          selectedEdgeId: allEdgeIds.length > 0 ? allEdgeIds[allEdgeIds.length - 1] : null,
          selectedNodeId: allNodeIds.length > 0 ? allNodeIds[allNodeIds.length - 1] : null,
          selectedSimNodeNames: simNodeNames,
          selectedSimNodeName: simNodeNames.size > 0 ? [...simNodeNames][simNodeNames.size - 1] : null,
        });
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const currentState = useTopologyStore.getState();

        const { selectedEdgeId } = currentState;
        if (selectedEdgeId && currentState.selectedMemberLinkIndices.length > 0) {
          const edge = currentState.edges.find(e => e.id === selectedEdgeId);
          const memberLinksCount = edge?.data?.memberLinks?.length ?? 0;

          if (memberLinksCount > 1) {
            const sortedIndices = [...currentState.selectedMemberLinkIndices].sort((a, b) => b - a);
            sortedIndices.forEach(index => { deleteMemberLink(selectedEdgeId, index); });
            clearMemberLinkSelection();
            triggerYamlRefresh();
            return;
          }
        }

        const selectedNodeIds = currentState.nodes.filter(n => n.selected).map(n => n.id);
        selectedNodeIds.forEach(id => { deleteNode(id); });

        const selectedEdgeIds = currentState.edges.filter(edge => edge.selected).map(edge => edge.id);
        selectedEdgeIds.forEach(id => { deleteEdge(id); });

        if (currentState.selectedSimNodeNames.size > 0) {
          currentState.selectedSimNodeNames.forEach(name => { deleteSimNode(name); });
          selectSimNodes(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [handleUndo, handleRedo, deleteMemberLink, clearMemberLinkSelection, deleteNode, deleteEdge, deleteSimNode, triggerYamlRefresh, selectSimNodes]);

  const handlePaneClick = useCallback(() => {
    if (justConnectedRef.current) {
      return;
    }
    selectNode(null);
    selectEdge(null);
    selectSimNode(null);
    setContextMenu(prev => ({ ...prev, open: false }));
  }, [selectNode, selectEdge, selectSimNode]);

  const handleMoveStart = useCallback(() => {
    setContextMenu(prev => ({ ...prev, open: false }));
  }, []);

  const handleNodeDragStart = useCallback(() => {
    setContextMenu(prev => ({ ...prev, open: false }));
  }, []);

  const handleSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
    if (isPastingRef.current) return;

    const nodeIds = selectedNodes.map(n => n.id);
    const edgeIds = selectedEdges.map(e => e.id);
    syncSelectionFromReactFlow(nodeIds, edgeIds);
  }, [syncSelectionFromReactFlow]);

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
    if (activeTab === 0) {
      const nodeData = node.data as UINodeData;
      if (node.type === 'simNode') {
        jumpToSimNodeInEditor(nodeData.name);
      } else {
        jumpToNodeInEditor(nodeData.name);
      }
    }
  }, [activeTab]);

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge<UIEdgeData>) => {
    if (activeTab === 0 && edge.data && (edge.data.memberLinks?.length || 0) === 1) {
      jumpToLinkInEditor(edge.data.sourceNode, edge.data.targetNode);
    }
  }, [activeTab]);

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
    if (node.type === 'simNode') {
      selectSimNode((node.data as UINodeData).name);
    } else {
      selectNode(node.id);
    }
    setContextMenu({
      open: true,
      position: { x: event.clientX, y: event.clientY },
      flowPosition: { x: 0, y: 0 },
    });
  }, [selectNode, selectSimNode]);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge<UIEdgeData>) => {
    event.preventDefault();
    // Don't show context menu for sim-related edges when SimNodes are hidden
    if (!showSimNodes && (edge.source.startsWith('sim-') || edge.target.startsWith('sim-'))) {
      return;
    }
    const isExpanded = expandedEdges.has(edge.id);
    const hasMemberLinks = (edge.data?.memberLinks?.length || 0) > 1;
    if (isExpanded && hasMemberLinks) {
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
  const handleDeleteEdge = () => { if (selectedEdgeId) deleteEdge(selectedEdgeId); };
  const handleCreateLag = () => {
    if (selectedEdgeId && selectedMemberLinkIndices.length >= 2) {
      createLagFromMemberLinks(selectedEdgeId, selectedMemberLinkIndices);
    }
  };

  const canCopy = nodes.some(n => n.selected) || edges.some(e => e.selected);
  const canPaste = hasClipboardData();

  const esiLagValidation = (() => {
    if (selectedEdgeIds.length < 2) return { valid: false, error: null };

    const selectedEdges = selectedEdgeIds
      .map(id => edges.find(e => e.id === id))
      .filter((e): e is typeof edges[0] => e !== undefined);

    if (selectedEdges.length !== selectedEdgeIds.length) return { valid: false, error: null };

    const esiLagEdges = selectedEdges.filter(e => e.data?.edgeType === 'esilag');
    const regularEdges = selectedEdges.filter(e => e.data?.edgeType !== 'esilag');

    if (esiLagEdges.length > 1) {
      return { valid: false, error: 'Cannot merge multiple ESI-LAGs' };
    }

    const esiLag = esiLagEdges[0];
    const esiLeafCount = esiLag?.data?.esiLeaves?.length || 0;
    const totalLeaves = esiLeafCount + regularEdges.length;

    if (esiLag && totalLeaves > 4) {
      return { valid: false, error: 'ESI-LAG cannot have more than 4 links' };
    }

    if (!esiLag && selectedEdges.length > 4) {
      return { valid: false, error: 'ESI-LAG cannot have more than 4 links' };
    }

    if (esiLag) {
      const esiLagSourceId = esiLag.source;
      if (!esiLagSourceId.startsWith('sim-')) {
        return { valid: false, error: 'ESI-LAG common node must be a SimNode' };
      }
      for (const edge of regularEdges) {
        if (edge.source !== esiLagSourceId && edge.target !== esiLagSourceId) {
          return { valid: false, error: 'Selected edges must share exactly one common node' };
        }
      }
    } else {
      const nodeCounts = new Map<string, number>();
      for (const edge of regularEdges) {
        nodeCounts.set(edge.source, (nodeCounts.get(edge.source) || 0) + 1);
        nodeCounts.set(edge.target, (nodeCounts.get(edge.target) || 0) + 1);
      }

      const commonNodes = [...nodeCounts.entries()].filter(([_, count]) => count === regularEdges.length);

      if (commonNodes.length !== 1) {
        return { valid: false, error: 'Selected edges must share exactly one common node' };
      }

      const commonNodeId = commonNodes[0][0];
      if (!commonNodeId.startsWith('sim-')) {
        return { valid: false, error: 'ESI-LAG common node must be a SimNode' };
      }
    }

    return { valid: true, error: null, esiLag, regularEdges };
  })();

  const canCreateEsiLag = esiLagValidation.valid;
  const isMergeIntoEsiLag = esiLagValidation.valid && !!(esiLagValidation as { esiLag?: typeof edges[0] }).esiLag;

  const handleCreateEsiLag = () => {
    if (!esiLagValidation.valid && esiLagValidation.error) {
      setError(esiLagValidation.error);
      return;
    }
    if (esiLagValidation.valid) {
      const { esiLag, regularEdges } = esiLagValidation as { valid: true; esiLag?: typeof edges[0]; regularEdges: typeof edges };
      if (esiLag && regularEdges.length > 0) {
        mergeEdgesIntoEsiLag(esiLag.id, regularEdges.map(e => e.id));
      } else {
        createMultihomedLag(selectedEdgeIds[0], selectedEdgeIds[1], selectedEdgeIds.slice(2));
      }
    }
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

  const hasSelection = selectedNodeId ? 'node' : selectedEdgeIds.length > 1 ? 'multiEdge' : selectedEdgeId ? 'edge' : selectedSimNodeName ? 'simNode' : null;

  return (
    <AppLayout>
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box
          onContextMenu={e => { e.preventDefault(); }}
          data-testid="topology-canvas"
          sx={{
            flex: 1,
            position: 'relative',
            '& .react-flow__edges': { zIndex: '0 !important' },
            '& .react-flow__edge-labels': { zIndex: '0 !important' },
            '& .react-flow__nodes': { zIndex: '1 !important' },
          }}
        >
          <ReactFlow
            key={layoutVersion}
            nodes={visibleNodes}
            edges={visibleEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onPaneClick={handlePaneClick}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            onPaneContextMenu={handlePaneContextMenu}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onMoveStart={handleMoveStart}
            onNodeDragStart={handleNodeDragStart}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable
            nodeDragThreshold={2}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{ type: 'linkEdge', interactionWidth: EDGE_INTERACTION_WIDTH }}
            colorMode={darkMode ? 'dark' : 'light'}
            deleteKeyCode={null}
            selectionKeyCode="Shift"
            multiSelectionKeyCode="Shift"
            selectionOnDrag
            onSelectionChange={handleSelectionChange}
          >
            <Controls position="top-right">
              {nodes.some(n => n.data.nodeType === 'simnode') && (
                <ControlButton
                  onClick={() => { setShowSimNodes(!showSimNodes); }}
                  title={showSimNodes ? 'Hide SimNodes' : 'Show SimNodes'}
                >
                  {showSimNodes ? <VisibilityIcon /> : <VisibilityOffIcon />}
                </ControlButton>
              )}
              {edges.some(e => (e.data?.memberLinks?.length || 0) > 1) && (
                <ControlButton
                  onClick={toggleAllEdgesExpanded}
                  title={expandedEdges.size > 0 ? 'Collapse all links' : 'Expand all links'}
                >
                  {expandedEdges.size > 0 ? <CloseFullscreenIcon /> : <OpenInFullIcon />}
                </ControlButton>
              )}
            </Controls>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <LayoutHandler layoutVersion={layoutVersion} />
            {nodes.length === 0 && (
              <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                <Typography variant="h5" sx={{ color: 'text.disabled', userSelect: 'none' }}>
                  Right-click to add your first node
                </Typography>
              </Box>
            )}
          </ReactFlow>
        </Box>

        <SidePanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          open={panelOpen}
          onToggle={() => { setPanelOpen(!panelOpen); }}
        />
      </Box>

      <ContextMenu
        open={contextMenu.open}
        position={contextMenu.position}
        onClose={handleCloseContextMenu}
        onAddNode={handleAddNode}
        onAddSimNode={handleAddSimNode}
        onDeleteNode={handleDeleteNode}
        onDeleteEdge={handleDeleteEdge}
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
        onClearAll={clearAll}
        hasSelection={hasSelection}
        hasContent={nodes.length > 0 || edges.length > 0}
        canCopy={canCopy}
        canPaste={canPaste}
        nodeTemplates={nodeTemplates}
        simNodeTemplates={simulation.simNodeTemplates}
        selectedMemberLinkCount={selectedMemberLinkIndices.length}
        canCreateEsiLag={canCreateEsiLag}
        isMergeIntoEsiLag={isMergeIntoEsiLag}
      />
    </AppLayout>
  );
}

export default function TopologyEditor() {
  return (
    <ReactFlowProvider>
      <TopologyEditorInner />
    </ReactFlowProvider>
  );
}
