import { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Paper,
  FormControl,
  InputLabel,
  Chip,
} from "@mui/material";

import { useTopologyStore } from "../lib/store";
import { formatName } from "../lib/utils";
import { getInheritedNodeLabels } from "../lib/labels";
import type {
  TopologyNodeData,
} from "../types/topology";

import {
  PanelHeader,
  PanelSection,
  EditableLabelsSection,
} from "./PropertiesPanelShared";
import { SimNodeSelectionEditor } from "./PropertiesTemplatesPanel";
import { EdgeSelectionPanel } from "./PropertiesEdgePanel";
import { focusInputAtEnd } from "./PropertiesPanelUtils";

type StoreState = ReturnType<typeof useTopologyStore.getState>;
type TopologyNode = StoreState["nodes"][number];
type TopologyEdge = StoreState["edges"][number];

function EmptySelectionMessage() {
  return (
    <Typography color="text.secondary" textAlign="center" py="1rem">
      Select a node or link
    </Typography>
  );
}

function renderConnectedEdgeItems(edge: TopologyEdge, nodeName: string) {
  const edgeData = edge.data;
  if (!edgeData) return [];

  const memberLinks = edgeData.memberLinks || [];
  const lagGroups = edgeData.lagGroups || [];
  const isEsiLag = edgeData.isMultihomed;
  const otherNode = edgeData.sourceNode === nodeName ? edgeData.targetNode : edgeData.sourceNode;

  if (isEsiLag && edgeData.esiLeaves) {
    const esiName = memberLinks[0]?.name || `${edgeData.sourceNode}-esi-lag`;
    return [(
      <Paper
        key={edge.id}
        variant="outlined"
        sx={{ p: '0.5rem', cursor: "pointer", bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
        onClick={() => useTopologyStore.getState().selectEdge(edge.id)}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" fontWeight={500}>
            {esiName}
          </Typography>
          <Chip label="ESI-LAG" size="small" sx={{ height: 16, fontSize: 10 }} color="primary" />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {edgeData.esiLeaves.length} member links
        </Typography>
      </Paper>
    )];
  }

  const indicesInLags = new Set<number>();
  lagGroups.forEach(lag => lag.memberLinkIndices.forEach(i => indicesInLags.add(i)));

  const lagElements = lagGroups.map(lag => (
    <Paper
      key={lag.id}
      variant="outlined"
      sx={{ p: '0.5rem', cursor: "pointer", bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
      onClick={() => {
        useTopologyStore.getState().selectEdge(edge.id);
        useTopologyStore.getState().selectLag(edge.id, lag.id);
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="body2" fontWeight={500}>
          {lag.name || `${nodeName} ↔ ${otherNode}`}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: '0.25rem' }}>
          <Chip label="LAG" size="small" sx={{ height: 16, fontSize: 10 }} color="primary" />
          <Typography variant="caption" color="text.secondary">
            → {otherNode}
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {lag.memberLinkIndices.length} member links
      </Typography>
    </Paper>
  ));

  const standaloneLinks = memberLinks
    .map((link, idx) => ({ link, idx }))
    .filter(({ idx }) => !indicesInLags.has(idx))
    .map(({ link, idx }) => (
      <Paper
        key={`${edge.id}-${idx}`}
        variant="outlined"
        sx={{ p: '0.5rem', cursor: "pointer", bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
        onClick={() => {
          useTopologyStore.getState().selectEdge(edge.id);
          useTopologyStore.getState().selectMemberLink(edge.id, idx, false);
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" fontWeight={500}>
            {link.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            → {otherNode}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {link.sourceInterface} ↔ {link.targetInterface}
        </Typography>
      </Paper>
    ));

  return [...lagElements, ...standaloneLinks];
}

function ConnectedLinksPanel({
  edges,
  nodeName,
}: Readonly<{
  edges: TopologyEdge[];
  nodeName: string;
}>) {
  if (edges.length === 0) return null;
  const totalLinks = edges.reduce((sum, e) => sum + (e.data?.memberLinks?.length || 0), 0);
  return (
    <PanelSection title="Connected Links" count={totalLinks}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: '0.5rem' }}>
        {edges.flatMap((edge) => renderConnectedEdgeItems(edge, nodeName))}
      </Box>
    </PanelSection>
  );
}

function NodeSelectionPanel({
  selectedNode,
  edges,
  nodeTemplates,
  updateNode,
  triggerYamlRefresh,
}: Readonly<{
  selectedNode: TopologyNode;
  edges: TopologyEdge[];
  nodeTemplates: StoreState["nodeTemplates"];
  updateNode: StoreState["updateNode"];
  triggerYamlRefresh: StoreState["triggerYamlRefresh"];
}>) {
  const nodeData = selectedNode.data;
  const nodeNameInputRef = useRef<HTMLInputElement>(null);
  const prevSelectedNodeIdRef = useRef<string | null>(null);
  const [localNodeName, setLocalNodeName] = useState(nodeData.name || '');

  useEffect(() => {
    setLocalNodeName(nodeData.name || '');
  }, [nodeData.name, selectedNode.id]);

  useEffect(() => {
    if (selectedNode.id && selectedNode.id !== prevSelectedNodeIdRef.current && nodeData.isNew) {
      setTimeout(() => {
        focusInputAtEnd(nodeNameInputRef.current);
        updateNode(selectedNode.id, { isNew: false });
      }, 50);
    }
    prevSelectedNodeIdRef.current = selectedNode.id;
  }, [selectedNode.id, nodeData.isNew, updateNode]);

  useEffect(() => {
    const handler = () => focusInputAtEnd(nodeNameInputRef.current);
    window.addEventListener('focusNodeName', handler);
    return () => window.removeEventListener('focusNodeName', handler);
  }, []);

  const handleUpdateNodeField = (update: Partial<TopologyNodeData>) => {
    updateNode(selectedNode.id, update);
    triggerYamlRefresh();
  };

  const handleNodeNameBlur = () => {
    if (localNodeName !== nodeData.name) {
      updateNode(selectedNode.id, { name: localNodeName });
      triggerYamlRefresh();
      setTimeout(() => {
        const freshNodes = useTopologyStore.getState().nodes;
        const currentNode = freshNodes.find(n => n.id === selectedNode.id);
        if (currentNode && currentNode.data.name !== localNodeName) {
          setLocalNodeName(currentNode.data.name);
        }
      }, 50);
    }
  };

  const connectedEdges = edges.filter(
    (e) => e.source === selectedNode.id || e.target === selectedNode.id
  );

  const simNodeEdges = edges.filter((e) => {
    if (e.source === selectedNode.id || e.target === selectedNode.id) return false;
    return (
      e.data?.sourceNode === nodeData.name || e.data?.targetNode === nodeData.name
    );
  });

  const esiLagEdges = edges.filter((e) => {
    if (connectedEdges.includes(e) || simNodeEdges.includes(e)) return false;
    return e.data?.esiLeaves?.some(leaf => leaf.nodeId === selectedNode.id || leaf.nodeName === nodeData.name);
  });

  const allConnectedEdges = [...connectedEdges, ...simNodeEdges, ...esiLagEdges];

  return (
    <Box>
      <PanelHeader title={nodeData.name} />

      <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
        <TextField
          label="Name"
          size="small"
          value={localNodeName}
          onChange={(e) => setLocalNodeName(formatName(e.target.value))}
          onBlur={handleNodeNameBlur}
          fullWidth
          inputRef={nodeNameInputRef}
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Template</InputLabel>
          <Select
            label="Template"
            value={nodeData.template || ""}
            onChange={(e) =>
              handleUpdateNodeField({ template: e.target.value || undefined })
            }
          >
            <MenuItem value="">None</MenuItem>
            {nodeTemplates.map((t) => (
              <MenuItem key={t.name} value={t.name}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <EditableLabelsSection
          labels={nodeData.labels}
          inheritedLabels={getInheritedNodeLabels(selectedNode, nodeTemplates)}
          onUpdate={(labels) => handleUpdateNodeField({ labels })}
        />
      </Box>

      <ConnectedLinksPanel edges={allConnectedEdges} nodeName={nodeData.name} />
    </Box>
  );
}

export function SelectionPanel() {
  const selectedNodeId = useTopologyStore((state) => state.selectedNodeId);
  const selectedEdgeId = useTopologyStore((state) => state.selectedEdgeId);
  const selectedSimNodeName = useTopologyStore(
    (state) => state.selectedSimNodeName,
  );
  const selectedSimNodeNames = useTopologyStore(
    (state) => state.selectedSimNodeNames,
  );
  const selectedMemberLinkIndices = useTopologyStore(
    (state) => state.selectedMemberLinkIndices,
  );
  const selectedLagId = useTopologyStore((state) => state.selectedLagId);
  const expandedEdges = useTopologyStore((state) => state.expandedEdges);
  const nodes = useTopologyStore((state) => state.nodes);
  const edges = useTopologyStore((state) => state.edges);
  const nodeTemplates = useTopologyStore((state) => state.nodeTemplates);
  const linkTemplates = useTopologyStore((state) => state.linkTemplates);
  const simulation = useTopologyStore((state) => state.simulation);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const selectedSimNode = simulation.simNodes.find(
    (n) => n.name === selectedSimNodeName,
  );
  const updateNode = useTopologyStore((state) => state.updateNode);
  const updateEdge = useTopologyStore((state) => state.updateEdge);
  const deleteEdge = useTopologyStore((state) => state.deleteEdge);
  const updateSimNode = useTopologyStore((state) => state.updateSimNode);
  const triggerYamlRefresh = useTopologyStore(
    (state) => state.triggerYamlRefresh,
  );

  // Count selected items
  const selectedNodesCount = nodes.filter((n) => n.selected).length;
  const selectedEdgesCount = edges.filter((e) => e.selected).length;
  const selectedSimNodesCount = selectedSimNodeNames.size;
  const selectedMemberLinksCount = selectedMemberLinkIndices.length;

  const hasMultipleSelected =
    selectedNodesCount > 1 ||
    selectedEdgesCount > 1 ||
    selectedSimNodesCount > 1 ||
    selectedMemberLinksCount > 1 ||
    (selectedNodesCount + selectedEdgesCount + selectedSimNodesCount) > 1;

  // Don't show properties panel when multiple items are selected
  if (hasMultipleSelected) {
    return <EmptySelectionMessage />;
  }

  if (selectedNode) {
    return (
      <NodeSelectionPanel
        selectedNode={selectedNode}
        edges={edges}
        nodeTemplates={nodeTemplates}
        updateNode={updateNode}
        triggerYamlRefresh={triggerYamlRefresh}
      />
    );
  }

  if (selectedEdge && selectedEdge.data) {
    return (
      <EdgeSelectionPanel
        selectedEdge={selectedEdge}
        expandedEdges={expandedEdges}
        selectedMemberLinkIndices={selectedMemberLinkIndices}
        selectedLagId={selectedLagId}
        linkTemplates={linkTemplates}
        updateEdge={updateEdge}
        deleteEdge={deleteEdge}
        triggerYamlRefresh={triggerYamlRefresh}
      />
    );
  }

  // Handle sim node selection
  if (selectedSimNode) {
    const simNodeId = selectedSimNode.id;
    const connectedEdges = edges.filter(
      (e) => e.source === simNodeId || e.target === simNodeId
    );
    const esiLagEdges = edges.filter((e) => {
      if (connectedEdges.includes(e)) return false;
      return e.data?.sourceNode === selectedSimNode.name ||
        e.data?.esiLeaves?.some(leaf => leaf.nodeName === selectedSimNode.name);
    });
    const allConnectedEdges = [...connectedEdges, ...esiLagEdges];

    return (
      <SimNodeSelectionEditor
        simNode={selectedSimNode}
        simNodeTemplates={simulation.simNodeTemplates}
        connectedEdges={allConnectedEdges}
        onUpdate={(update) => {
          updateSimNode(selectedSimNode.name, update);
          triggerYamlRefresh();
        }}
      />
    );
  }

  return <EmptySelectionMessage />;
}
