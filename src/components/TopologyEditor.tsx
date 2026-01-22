import { useCallback, useState, useEffect, useMemo, useRef, type SyntheticEvent } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Tabs, Tab, useTheme, IconButton, Tooltip, Drawer } from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material';

import { useTopologyStore } from '../lib/store';
import { DRAWER_WIDTH, DRAWER_TRANSITION_DURATION_MS } from '../lib/constants';
import type { TopologyNodeData, TopologyEdgeData } from '../types/topology';
import DeviceNode from './nodes/DeviceNode';
import SimDeviceNode, { type SimDeviceNodeData } from './nodes/SimDeviceNode';
import LinkEdge from './edges/LinkEdge';
import AppLayout from './AppLayout';
import YamlEditor, { jumpToNodeInEditor, jumpToLinkInEditor, jumpToSimNodeInEditor } from './YamlEditor';
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
          <Tab label="Selection" sx={{ minHeight: 36, fontSize: '0.75rem', py: 0 }} />
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
    selectedNodeId,
    selectedEdgeId,
    selectedSimNodeName,
    addNode,
    deleteNode,
    deleteEdge,
    addEdgeLink,
    addSimNode,
    deleteSimNode,
    simulation,
    showSimNodes,
    setShowSimNodes,
    updateSimNodePosition,
    clearAll,
    layoutVersion,
    triggerYamlRefresh,
    darkMode,
    nodeTemplates,
    pasteSelection,
  } = useTopologyStore();

  const { screenToFlowPosition } = useReactFlow();

  const [activeTab, setActiveTab] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    position: { x: number; y: number };
    flowPosition: { x: number; y: number };
  }>({
    open: false,
    position: { x: 0, y: 0 },
    flowPosition: { x: 0, y: 0 },
  });

  const clipboardRef = useRef<{
    nodes: Node<TopologyNodeData>[];
    edges: Edge<TopologyEdgeData>[];
    simNodes: typeof simulation.simNodes;
  }>({ nodes: [], edges: [], simNodes: [] });

  const [selectedSimNodes, setSelectedSimNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedNodeId || selectedEdgeId) {
      setSelectedSimNodes(new Set());
    }
  }, [selectedNodeId, selectedEdgeId]);

  const simFlowNodes: Node<SimDeviceNodeData>[] = useMemo(() => {
    if (!showSimNodes) return [];
    return simulation.simNodes.map((simNode, index) => ({
      id: simNode.id,
      type: 'simDeviceNode',
      position: simNode.position || { x: 400 + (index % 3) * 180, y: 50 + Math.floor(index / 3) * 140 },
      data: { simNode },
      selected: selectedSimNodes.has(simNode.name),
    }));
  }, [simulation.simNodes, showSimNodes, selectedSimNodes]);

  const allNodes = useMemo(() => [...nodes, ...simFlowNodes], [nodes, simFlowNodes]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const simChanges = changes.filter(c => 'id' in c && (c as { id?: string }).id?.startsWith('sim-'));
    const topoChanges = changes.filter(c => !('id' in c) || !(c as { id?: string }).id?.startsWith('sim-'));

    if (topoChanges.length > 0) {
      onNodesChange(topoChanges as NodeChange<Node<TopologyNodeData>>[]);
    }

    let simDragEnded = false;
    const newSelectedSimNodes = new Set(selectedSimNodes);
    let selectionChanged = false;

    const getSimNodeNameById = (id: string) => simulation.simNodes.find(sn => sn.id === id)?.name;

    for (const change of simChanges) {
      if (change.type === 'position' && change.position && change.id) {
        const simName = getSimNodeNameById(change.id);
        if (simName) updateSimNodePosition(simName, change.position);
        if (change.dragging === false) simDragEnded = true;
      }
      if (change.type === 'select' && change.id) {
        const simName = getSimNodeNameById(change.id);
        if (simName) {
          change.selected ? newSelectedSimNodes.add(simName) : newSelectedSimNodes.delete(simName);
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
      setSelectedSimNodes(newSelectedSimNodes);
      selectSimNode(newSelectedSimNodes.size === 1 ? [...newSelectedSimNodes][0] : null);
    }

    if (simDragEnded) triggerYamlRefresh();
  }, [onNodesChange, updateSimNodePosition, selectSimNode, deleteSimNode, triggerYamlRefresh, selectedSimNodes, simulation.simNodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (isCtrlOrCmd && e.key === 'a') {
        e.preventDefault();
        onNodesChange(nodes.map(n => ({ type: 'select' as const, id: n.id, selected: true })));
        onEdgesChange(edges.map(e => ({ type: 'select' as const, id: e.id, selected: true })));
        setSelectedSimNodes(new Set(simulation.simNodes.map(sn => sn.name)));
      }

      if (isCtrlOrCmd && e.key === 'c') {
        const selectedTopoNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(e => e.selected);
        const selectedSimNodesList = simulation.simNodes.filter(sn => selectedSimNodes.has(sn.name));
        if (selectedTopoNodes.length > 0 || selectedSimNodesList.length > 0) {
          clipboardRef.current = { nodes: selectedTopoNodes, edges: selectedEdges, simNodes: selectedSimNodesList };
        }
      }

      if (isCtrlOrCmd && e.key === 'v') {
        const { nodes: copiedNodes, edges: copiedEdges, simNodes: copiedSimNodes } = clipboardRef.current;
        if (copiedNodes.length > 0 || copiedSimNodes.length > 0) {
          e.preventDefault();

          if (copiedSimNodes.length === 0) setSelectedSimNodes(new Set());
          if (copiedNodes.length > 0) pasteSelection(copiedNodes, copiedEdges, { x: 50, y: 50 });

          if (copiedSimNodes.length > 0) {
            const existingSimNodeNames = simulation.simNodes.map(sn => sn.name);
            const newSimNodeNames: string[] = [];

            for (const simNode of copiedSimNodes) {
              const baseName = simNode.name.replace(/-copy(-\d+)?$/, '');
              let newName = `${baseName}-copy`;
              let counter = 1;
              while (existingSimNodeNames.includes(newName)) {
                newName = `${baseName}-copy-${counter++}`;
              }
              existingSimNodeNames.push(newName);
              newSimNodeNames.push(newName);

              addSimNode({
                ...simNode,
                name: newName,
                position: simNode.position ? { x: simNode.position.x + 50, y: simNode.position.y + 50 } : undefined,
              });
            }

            setSelectedSimNodes(new Set(newSimNodeNames));
            triggerYamlRefresh();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, simulation.simNodes, selectedSimNodes, onNodesChange, onEdgesChange, pasteSelection, addSimNode, triggerYamlRefresh]);

  const handlePaneClick = useCallback(() => {
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

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'simDeviceNode') {
      const simName = (node.data as SimDeviceNodeData).simNode.name;
      selectSimNode(simName);
      if (activeTab === 0) jumpToSimNodeInEditor(simName);
    } else {
      selectNode(node.id);
      if (activeTab === 0) jumpToNodeInEditor((node.data as TopologyNodeData).name);
    }
  }, [selectNode, selectSimNode, activeTab]);

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge<TopologyEdgeData>) => {
    selectEdge(edge.id);
    if (activeTab === 0 && edge.data) jumpToLinkInEditor(edge.data.sourceNode, edge.data.targetNode);
  }, [selectEdge, activeTab]);

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
    selectEdge(edge.id);
    setContextMenu({
      open: true,
      position: { x: event.clientX, y: event.clientY },
      flowPosition: { x: 0, y: 0 },
    });
  }, [selectEdge]);

  const handleCloseContextMenu = () => {
    setContextMenu(prev => ({ ...prev, open: false }));
    triggerYamlRefresh();
  };

  const handleAddNode = (templateName?: string) => addNode(contextMenu.flowPosition, templateName);
  const handleDeleteNode = () => selectedNodeId && deleteNode(selectedNodeId);
  const handleDeleteEdge = () => selectedEdgeId && deleteEdge(selectedEdgeId);
  const handleAddEdgeLink = () => selectedNodeId && addEdgeLink(selectedNodeId);

  const handleChangeNodeTemplate = (templateName: string) => {
    if (selectedNodeId) {
      useTopologyStore.getState().updateNode(selectedNodeId, { template: templateName });
      triggerYamlRefresh();
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const currentNodeTemplate = selectedNode?.data?.template;

  const handleAddSimNode = () => {
    const newName = `sim-node-${(simulation.simNodes?.length || 0) + 1}`;
    addSimNode({
      name: newName,
      template: simulation.simNodeTemplates[0]?.name,
      position: contextMenu.flowPosition,
    });
    setSelectedSimNodes(new Set([newName]));
  };

  const handleDeleteSimNode = () => selectedSimNodeName && deleteSimNode(selectedSimNodeName);

  const hasSelection = selectedNodeId ? 'node' : selectedEdgeId ? 'edge' : selectedSimNodeName ? 'simNode' : null;

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
          {simulation.simNodes.length > 0 && (
            <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
              <Tooltip title={showSimNodes ? 'Hide SimNodes' : 'Show SimNodes'}>
                <IconButton
                  onClick={() => setShowSimNodes(!showSimNodes)}
                  sx={{
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {showSimNodes ? <VisibilityIcon /> : <VisibilityOffIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          )}
          <ReactFlow
            key={layoutVersion}
            nodes={allNodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={handlePaneClick}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
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
            defaultEdgeOptions={{ type: 'linkEdge', interactionWidth: 20 }}
            colorMode={darkMode ? 'dark' : 'light'}
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <LayoutHandler layoutVersion={layoutVersion} />
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
        onAddEdgeLink={handleAddEdgeLink}
        onDeleteNode={handleDeleteNode}
        onDeleteEdge={handleDeleteEdge}
        onDeleteSimNode={handleDeleteSimNode}
        onChangeNodeTemplate={handleChangeNodeTemplate}
        currentNodeTemplate={currentNodeTemplate}
        onClearAll={clearAll}
        hasSelection={hasSelection}
        hasContent={nodes.length > 0 || edges.length > 0 || simulation.simNodes.length > 0}
        nodeTemplates={nodeTemplates}
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
