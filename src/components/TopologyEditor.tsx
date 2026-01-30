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
import { generateUniqueName, generateCopyName } from '../lib/utils';
import { DRAWER_WIDTH, DRAWER_TRANSITION_DURATION_MS, EDGE_INTERACTION_WIDTH } from '../lib/constants';
import type { TopologyNodeData, TopologyEdgeData } from '../types/topology';
import DeviceNode from './nodes/DeviceNode';
import SimDeviceNode, { type SimDeviceNodeData } from './nodes/SimDeviceNode';
import LinkEdge from './edges/LinkEdge';
import AppLayout from './AppLayout';
import YamlEditor, { jumpToNodeInEditor, jumpToLinkInEditor, jumpToSimNodeInEditor, jumpToMemberLinkInEditor } from './YamlEditor';
import { SelectionPanel, NodeTemplatesPanel, LinkTemplatesPanel, SimNodeTemplatesPanel } from './PropertiesPanel';
import ContextMenu from './ContextMenu';

const nodeTypes: NodeTypes = {
  deviceNode: DeviceNode,
  simDeviceNode: SimDeviceNode,
};

const edgeTypes: EdgeTypes = {
  linkEdge: LinkEdge,
};

function LayoutHandler({ layoutVersion }: { layoutVersion: number }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.2 }), 50);
    return () => clearTimeout(timer);
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
          onChange={(_: SyntheticEvent, v: number) => onTabChange(v)}
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
    addMemberLink,
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
    updateSimNodePosition,
    clearAll,
    layoutVersion,
    triggerYamlRefresh,
    darkMode,
    nodeTemplates,
    linkTemplates,
    pasteSelection,
    createLagFromMemberLinks,
    createMultihomedLag,
    mergeEdgesIntoEsiLag,
    setError,
    clipboard,
    setClipboard,
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

  const mouseScreenPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const justConnectedRef = useRef(false);

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

  const simFlowNodes: Node<SimDeviceNodeData>[] = useMemo(() => {
    if (!showSimNodes) return [];
    return simulation.simNodes.map((simNode, index) => ({
      id: simNode.id,
      type: 'simDeviceNode',
      position: simNode.position || { x: 400 + (index % 3) * 180, y: 50 + Math.floor(index / 3) * 140 },
      data: { simNode },
      selected: selectedSimNodeNames.has(simNode.name),
    }));
  }, [simulation.simNodes, showSimNodes, selectedSimNodeNames]);

  const allNodes = useMemo(() => [...nodes, ...simFlowNodes], [nodes, simFlowNodes]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const simChanges = changes.filter(c => 'id' in c && (c as { id?: string }).id?.startsWith('sim-'));
    const topoChanges = changes.filter(c => !('id' in c) || !(c as { id?: string }).id?.startsWith('sim-'));

    if (topoChanges.length > 0) {
      onNodesChange(topoChanges as NodeChange<Node<TopologyNodeData>>[]);
    }

    const currentState = useTopologyStore.getState();
    const currentSimNodes = currentState.simulation.simNodes;
    const currentSelectedSimNodeNames = currentState.selectedSimNodeNames;

    let simDragEnded = false;
    const newSelectedSimNodes = new Set(currentSelectedSimNodeNames);
    let selectionChanged = false;

    const getSimNodeNameById = (id: string) => currentSimNodes.find(sn => sn.id === id)?.name;

    for (const change of simChanges) {
      if (change.type === 'position' && change.position && change.id) {
        const simName = getSimNodeNameById(change.id);
        if (simName) updateSimNodePosition(simName, change.position);
        if (change.dragging === false) simDragEnded = true;
      }
      if (change.type === 'select' && change.id) {
        const simName = getSimNodeNameById(change.id);
        if (simName) {
          if (change.selected) {
            newSelectedSimNodes.add(simName);
          } else {
            newSelectedSimNodes.delete(simName);
          }
          selectionChanged = true;
        }
      }
      if (change.type === 'remove' && change.id) {
        const simName = getSimNodeNameById(change.id);
        if (simName) {
          deleteSimNode(simName);
          newSelectedSimNodes.delete(simName);
          selectionChanged = true;
        }
      }
    }

    if (selectionChanged) {
      selectSimNodes(newSelectedSimNodes);
    }

    if (simDragEnded) triggerYamlRefresh();
  }, [onNodesChange, updateSimNodePosition, selectSimNodes, deleteSimNode, triggerYamlRefresh]);

  const handleCopy = useCallback(() => {
    const currentState = useTopologyStore.getState();
    const selectedTopoNodes = currentState.nodes.filter(n => n.selected);
    const selectedSimNodesList = currentState.simulation.simNodes.filter(sn => currentState.selectedSimNodeNames.has(sn.name));

    if (currentState.selectedEdgeIds.length === 1 && selectedTopoNodes.length === 0 && selectedSimNodesList.length === 0) {
      const edge = currentState.edges.find(e => e.id === currentState.selectedEdgeIds[0]);
      if (edge && !edge.data?.isMultihomed) {
        const memberLinks = edge.data?.memberLinks || [];
        if (memberLinks.length > 0) {
          setClipboard({
            nodes: [],
            edges: [],
            simNodes: [],
            copiedLink: {
              edgeId: edge.id,
              template: memberLinks[0].template,
            },
          });
          return;
        }
      }
    }

    const selectedEdges = currentState.edges.filter(e => e.selected);
    if (selectedTopoNodes.length > 0 || selectedSimNodesList.length > 0 || selectedEdges.length > 0) {
      setClipboard({
        nodes: selectedTopoNodes.map(n => ({ ...n, position: { ...n.position }, data: { ...n.data } })),
        edges: selectedEdges.map(e => ({
          ...e,
          data: e.data ? {
            ...e.data,
            memberLinks: e.data.memberLinks?.map(ml => ({ ...ml, labels: ml.labels ? { ...ml.labels } : undefined })),
            lagGroups: e.data.lagGroups?.map(lg => ({ ...lg, memberLinkIndices: [...lg.memberLinkIndices], labels: lg.labels ? { ...lg.labels } : undefined })),
          } : undefined
        })),
        simNodes: selectedSimNodesList.map(sn => ({ ...sn, position: sn.position ? { ...sn.position } : undefined })),
        copiedLink: undefined,
      });
    }
  }, [setClipboard]);

  const handlePaste = useCallback(() => {
    const { nodes: copiedNodes, edges: copiedEdges, simNodes: copiedSimNodes, copiedLink } = clipboard;

    if (copiedLink) {
      const currentState = useTopologyStore.getState();
      const targetEdgeId = currentState.selectedEdgeId || copiedLink.edgeId;
      const edge = currentState.edges.find(e => e.id === targetEdgeId);
      if (edge && edge.data) {
        const sourceIsSimNode = edge.source.startsWith('sim-');
        const targetIsSimNode = edge.target.startsWith('sim-');

        const extractPortNumber = (iface: string): number => {
          const ethernetMatch = iface.match(/ethernet-1-(\d+)/);
          if (ethernetMatch) return parseInt(ethernetMatch[1], 10);
          const ethMatch = iface.match(/eth(\d+)/);
          if (ethMatch) return parseInt(ethMatch[1], 10);
          return 0;
        };

        const sourcePortNumbers = currentState.edges.flatMap(e => {
          if (e.source === edge.source) {
            return e.data?.memberLinks?.map(ml => extractPortNumber(ml.sourceInterface)) || [];
          }
          if (e.target === edge.source) {
            return e.data?.memberLinks?.map(ml => extractPortNumber(ml.targetInterface)) || [];
          }
          return [];
        });
        const nextSourcePort = Math.max(0, ...sourcePortNumbers) + 1;

        const targetPortNumbers = currentState.edges.flatMap(e => {
          if (e.source === edge.target) {
            return e.data?.memberLinks?.map(ml => extractPortNumber(ml.sourceInterface)) || [];
          }
          if (e.target === edge.target) {
            return e.data?.memberLinks?.map(ml => extractPortNumber(ml.targetInterface)) || [];
          }
          return [];
        });
        const nextTargetPort = Math.max(0, ...targetPortNumbers) + 1;

        const sourceInterface = sourceIsSimNode ? `eth${nextSourcePort}` : `ethernet-1-${nextSourcePort}`;
        const targetInterface = targetIsSimNode ? `eth${nextTargetPort}` : `ethernet-1-${nextTargetPort}`;

        const memberLinks = edge.data.memberLinks || [];
        const nextLinkNumber = memberLinks.length + 1;

        addMemberLink(edge.id, {
          name: `${edge.data.targetNode}-${edge.data.sourceNode}-${nextLinkNumber}`,
          template: copiedLink.template,
          sourceInterface,
          targetInterface,
        });
        triggerYamlRefresh();
      }
      return;
    }

    if (copiedNodes.length > 0 || copiedSimNodes.length > 0) {
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

      const cursorPos = contextMenu.flowPosition.x !== 0 || contextMenu.flowPosition.y !== 0
        ? contextMenu.flowPosition
        : screenToFlowPosition(mouseScreenPositionRef.current);
      const offset = {
        x: cursorPos.x - centerX,
        y: cursorPos.y - centerY,
      };

      if (copiedSimNodes.length === 0) selectSimNodes(new Set());
      if (copiedNodes.length > 0) pasteSelection(copiedNodes, copiedEdges, offset);

      if (copiedSimNodes.length > 0) {
        const currentState = useTopologyStore.getState();
        const allNodeNames = currentState.nodes.map(n => n.data.name);
        const allSimNodeNames = currentState.simulation.simNodes.map(sn => sn.name);
        const existingNames = [...allNodeNames, ...allSimNodeNames];
        const newSimNodeNames: string[] = [];

        for (const simNode of copiedSimNodes) {
          const newName = generateCopyName(simNode.name, existingNames);
          existingNames.push(newName);
          newSimNodeNames.push(newName);

          const simNodeWithoutId = (({ id: _id, ...rest }) => rest)(simNode);
          addSimNode({
            ...simNodeWithoutId,
            name: newName,
            position: simNode.position ? { x: simNode.position.x + offset.x, y: simNode.position.y + offset.y } : undefined,
          });
        }

        selectSimNodes(new Set(newSimNodeNames));
        triggerYamlRefresh();
      }
    }
  }, [clipboard, contextMenu.flowPosition, addMemberLink, addSimNode, pasteSelection, selectSimNodes, triggerYamlRefresh, screenToFlowPosition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
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
        const currentSimNodes = currentState.simulation.simNodes;
        const currentShowSimNodes = currentState.showSimNodes;

        // Filter out sim-related edges when SimNodes are hidden
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

      if (isCtrlOrCmd && e.key === 'c') {
        handleCopy();
      }

      if (isCtrlOrCmd && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, handleUndo, handleRedo, deleteMemberLink, clearMemberLinkSelection, deleteNode, deleteEdge, deleteSimNode, triggerYamlRefresh, selectSimNodes]);

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
    const regularNodeIds = selectedNodes
      .filter(n => n.type !== 'simDeviceNode')
      .map(n => n.id);
    const edgeIds = selectedEdges.map(e => e.id);
    syncSelectionFromReactFlow(regularNodeIds, edgeIds);
  }, [syncSelectionFromReactFlow]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mouseScreenPositionRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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
      // Deselect any edges connected to SimNodes
      const simEdgeIds = edges
        .filter(e => e.source.startsWith('sim-') || e.target.startsWith('sim-'))
        .map(e => e.id);
      if (simEdgeIds.length > 0 && selectedEdgeIds.some(id => simEdgeIds.includes(id))) {
        const nonSimSelectedEdges = selectedEdgeIds.filter(id => !simEdgeIds.includes(id));
        if (nonSimSelectedEdges.length === 0) {
          selectEdge(null);
        } else {
          // Re-select only non-sim edges
          useTopologyStore.setState({
            selectedEdgeIds: nonSimSelectedEdges,
            selectedEdgeId: nonSimSelectedEdges[nonSimSelectedEdges.length - 1],
            edges: edges.map(e => ({
              ...e,
              selected: nonSimSelectedEdges.includes(e.id),
            })),
          });
        }
      }
    }
  }, [showSimNodes, selectedSimNodeNames, selectedSimNodeName, selectedEdgeIds, edges, selectSimNodes, selectSimNode, selectEdge]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'simDeviceNode') {
      const simName = (node.data as SimDeviceNodeData).simNode.name;
      if (!event.shiftKey) {
        selectSimNodes(new Set([simName]));
      } else {
        const currentState = useTopologyStore.getState();
        const newSet = new Set(currentState.selectedSimNodeNames);
        if (newSet.has(simName)) {
          newSet.delete(simName);
        } else {
          newSet.add(simName);
        }
        selectSimNodes(newSet);
      }
      selectSimNode(simName);
      if (activeTab === 0) jumpToSimNodeInEditor(simName);
    } else {
      if (!event.shiftKey) {
        selectNode(node.id, false);
      }
      if (activeTab === 0) jumpToNodeInEditor((node.data as TopologyNodeData).name);
    }
  }, [selectNode, selectSimNode, selectSimNodes, activeTab]);

  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge<TopologyEdgeData>) => {
    event.stopPropagation();
    if (!showSimNodes && (edge.source.startsWith('sim-') || edge.target.startsWith('sim-'))) {
      return;
    }
    const isExpanded = expandedEdges.has(edge.id);
    const hasMemberLinks = (edge.data?.memberLinks?.length || 0) > 1;
    if (isExpanded && hasMemberLinks) {
      return;
    }
    if (!event.shiftKey) {
      selectEdge(edge.id, false);
    }
    if (activeTab === 0 && edge.data && (edge.data.memberLinks?.length || 0) === 1) {
      jumpToLinkInEditor(edge.data.sourceNode, edge.data.targetNode);
    }
  }, [selectEdge, activeTab, showSimNodes, expandedEdges]);

  const handleEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge<TopologyEdgeData>) => {
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
    if (node.type === 'simDeviceNode') {
      selectSimNode((node.data as SimDeviceNodeData).simNode.name);
    } else {
      selectNode(node.id);
    }
    setContextMenu({
      open: true,
      position: { x: event.clientX, y: event.clientY },
      flowPosition: { x: 0, y: 0 },
    });
  }, [selectNode, selectSimNode]);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge<TopologyEdgeData>) => {
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

  const handleAddNode = (templateName?: string) => addNode(contextMenu.flowPosition, templateName);
  const handleDeleteNode = () => selectedNodeId && deleteNode(selectedNodeId);
  const handleDeleteEdge = () => selectedEdgeId && deleteEdge(selectedEdgeId);
  const handleCreateLag = () => {
    if (selectedEdgeId && selectedMemberLinkIndices.length >= 2) {
      createLagFromMemberLinks(selectedEdgeId, selectedMemberLinkIndices);
    }
  };

  const canCopy = nodes.some(n => n.selected) ||
    simulation.simNodes.some(sn => selectedSimNodeNames.has(sn.name)) ||
    edges.some(e => e.selected);

  const canPaste = clipboard.nodes.length > 0 ||
    clipboard.simNodes.length > 0 ||
    !!clipboard.copiedLink;

  // ENSURE A COMMON NODE IS SELECTED
  const esiLagValidation = (() => {
    if (selectedEdgeIds.length < 2) return { valid: false, error: null };

    const selectedEdges = selectedEdgeIds
      .map(id => edges.find(e => e.id === id))
      .filter((e): e is typeof edges[0] => e !== undefined);

    if (selectedEdges.length !== selectedEdgeIds.length) return { valid: false, error: null };

    const esiLagEdges = selectedEdges.filter(e => e.data?.isMultihomed);
    const regularEdges = selectedEdges.filter(e => !e.data?.isMultihomed);

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
          l.id === selectedLagId ? { ...l, template: templateName } : l
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

  const selectedSimNode = simulation.simNodes.find(n => n.name === selectedSimNodeName);
  const currentSimNodeTemplate = selectedSimNode?.template;

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
    const existingNames = simulation.simNodes?.map(n => n.name) || [];
    const newName = generateUniqueName('testman', existingNames, (simulation.simNodes?.length || 0) + 1);
    addSimNode({
      name: newName,
      template: simulation.simNodeTemplates[0]?.name,
      position: contextMenu.flowPosition,
    });
    selectSimNodes(new Set([newName]));
  };

  const handleDeleteSimNode = () => selectedSimNodeName && deleteSimNode(selectedSimNodeName);

  const hasSelection = selectedNodeId ? 'node' : selectedEdgeIds.length > 1 ? 'multiEdge' : selectedEdgeId ? 'edge' : selectedSimNodeName ? 'simNode' : null;

  return (
    <AppLayout>
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box
          onContextMenu={e => e.preventDefault()}
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
            nodes={allNodes}
            edges={edges}
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
              {simulation.simNodes.length > 0 && (
                <ControlButton
                  onClick={() => setShowSimNodes(!showSimNodes)}
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
            {nodes.length === 0 && simulation.simNodes.length === 0 && (
              <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none',}}>
                <Typography variant="h5" sx={{ color: 'text.disabled', userSelect: 'none'}}>
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
          onToggle={() => setPanelOpen(!panelOpen)}
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
        hasContent={nodes.length > 0 || edges.length > 0 || simulation.simNodes.length > 0}
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
