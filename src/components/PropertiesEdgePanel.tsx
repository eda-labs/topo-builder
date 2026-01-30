import { useEffect, useRef, type RefObject } from "react";
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  IconButton,
  Paper,
  FormControl,
  InputLabel,
  Chip,
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon, SubdirectoryArrowRight as ArrowIcon } from "@mui/icons-material";

import { useTopologyStore } from "../lib/store";
import { formatName } from "../lib/utils";
import { DEFAULT_INTERFACE } from "../lib/constants";
import { getInheritedLinkLabels, getInheritedLagLabels } from "../lib/labels";
import type { MemberLink, LagGroup, TopologyEdgeData } from "../types/topology";

import { PanelHeader, PanelSection, EditableLabelsSection } from "./PropertiesPanelShared";
import { focusInputAtEnd } from "./PropertiesPanelUtils";

type StoreState = ReturnType<typeof useTopologyStore.getState>;
type TopologyEdge = StoreState["edges"][number];

function incrementInterface(iface: string, nextNum: number) {
  const interfaceRegex = /^(.*\D)(\d+)$/;
  const match = interfaceRegex.exec(iface);
  if (match) {
    return `${match[1]}${parseInt(match[2], 10) + 1}`;
  }
  return `${iface}-${nextNum}`;
}

function LagGroupPanel({
  nodeA,
  nodeB,
  selectedEdgeId,
  selectedLag,
  memberLinks,
  linkTemplates,
  handleUpdateLagGroup,
  handleUpdateLink,
}: Readonly<{
  nodeA: string;
  nodeB: string;
  selectedEdgeId: string;
  selectedLag: LagGroup;
  memberLinks: MemberLink[];
  linkTemplates: StoreState["linkTemplates"];
  handleUpdateLagGroup: (lagId: string, update: Partial<LagGroup>) => void;
  handleUpdateLink: (index: number, update: Partial<MemberLink>) => void;
}>) {
  const lagMemberLinksWithIndices = selectedLag.memberLinkIndices
    .filter(i => i >= 0 && i < memberLinks.length)
    .map(i => ({ link: memberLinks[i], index: i }));

  const addLinkToLag = useTopologyStore.getState().addLinkToLag;
  const removeLinkFromLag = useTopologyStore.getState().removeLinkFromLag;

  return (
    <Box>
      <PanelHeader
        title={`${nodeA} ↔ ${nodeB}`}
        actions={
          <Chip
            label="LAG"
            size="small"
            sx={{
              height: 20,
              fontSize: 10,
              fontWeight: 600,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          />
        }
      />

      <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
        <TextField
          label="Name"
          size="small"
          value={selectedLag.name || ""}
          onChange={(e) => handleUpdateLagGroup(selectedLag.id, { name: formatName(e.target.value) })}
          fullWidth
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Template</InputLabel>
          <Select
            label="Template"
            value={selectedLag.template || ""}
            onChange={(e) => handleUpdateLagGroup(selectedLag.id, { template: e.target.value })}
          >
            <MenuItem value="">None</MenuItem>
            {linkTemplates.map((t) => (
              <MenuItem key={t.name} value={t.name}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <EditableLabelsSection
          labels={selectedLag.labels}
          inheritedLabels={getInheritedLagLabels(selectedLag, linkTemplates)}
          onUpdate={(labels) => handleUpdateLagGroup(selectedLag.id, { labels })}
        />
      </Box>

      <PanelSection
        title="Endpoints"
        count={lagMemberLinksWithIndices.length}
        actions={
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => addLinkToLag(selectedEdgeId, selectedLag.id)}
          >
            Add
          </Button>
        }
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: '0.5rem' }}>
          {lagMemberLinksWithIndices.map(({ link, index }, listIndex) => (
            <Paper
              key={index}
              variant="outlined"
              sx={{ p: '0.5rem', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr auto",
                  gap: '0.5rem',
                  alignItems: "center",
                }}
              >
                <TextField
                  label={nodeA}
                  size="small"
                  value={link.targetInterface}
                  onChange={(e) =>
                    handleUpdateLink(index, { targetInterface: e.target.value })
                  }
                  slotProps={{ input: { tabIndex: listIndex * 2 + 1 } }}
                  fullWidth
                />
                <TextField
                  label={nodeB}
                  size="small"
                  value={link.sourceInterface}
                  onChange={(e) =>
                    handleUpdateLink(index, { sourceInterface: e.target.value })
                  }
                  slotProps={{ input: { tabIndex: listIndex * 2 + 2 } }}
                  fullWidth
                />
                <IconButton
                  size="small"
                  onClick={() => removeLinkFromLag(selectedEdgeId, selectedLag.id, index)}
                  title={lagMemberLinksWithIndices.length <= 2 ? "Remove LAG (min 2 links)" : "Remove from LAG"}
                >
                  <DeleteIcon fontSize="small" color="error" />
                </IconButton>
              </Box>
            </Paper>
          ))}
        </Box>
      </PanelSection>
    </Box>
  );
}

function EsiLagPanel({
  nodeB,
  selectedEdgeId,
  memberLinks,
  esiLeaves,
  linkTemplates,
  handleUpdateLink,
  updateEdge,
  triggerYamlRefresh,
}: Readonly<{
  nodeB: string;
  selectedEdgeId: string;
  memberLinks: MemberLink[];
  esiLeaves: NonNullable<TopologyEdgeData["esiLeaves"]>;
  linkTemplates: StoreState["linkTemplates"];
  handleUpdateLink: (index: number, update: Partial<MemberLink>) => void;
  updateEdge: StoreState["updateEdge"];
  triggerYamlRefresh: StoreState["triggerYamlRefresh"];
}>) {
  const removeLinkFromEsiLag = useTopologyStore.getState().removeLinkFromEsiLag;

  return (
    <Box>
      <PanelHeader
        title={nodeB}
        actions={
          <Chip
            label="ESI-LAG"
            size="small"
            sx={{
              height: 20,
              fontSize: 10,
              fontWeight: 600,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          />
        }
      />

      <Box sx={{ pl: '1rem', mb: '1rem' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
          {esiLeaves.map((leaf) => (
            <Box key={leaf.nodeId} sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
              <ArrowIcon sx={{ fontSize: 16, mr: '0.25rem' }} />
              <Typography variant="body2">{leaf.nodeName}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
        <TextField
          label="Name"
          size="small"
          value={memberLinks[0]?.name || ""}
          onChange={(e) => {
            const newName = formatName(e.target.value);
            const newLinks = memberLinks.map((link, i) =>
              i === 0 ? { ...link, name: newName } : link
            );
            updateEdge(selectedEdgeId, { memberLinks: newLinks });
            triggerYamlRefresh();
          }}
          fullWidth
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Template</InputLabel>
          <Select
            label="Template"
            value={memberLinks[0]?.template || ""}
            onChange={(e) => {
              const newTemplate = e.target.value;
              const newLinks = memberLinks.map(link => ({ ...link, template: newTemplate }));
              updateEdge(selectedEdgeId, { memberLinks: newLinks });
              triggerYamlRefresh();
            }}
          >
            <MenuItem value="">None</MenuItem>
            {linkTemplates.map((t) => (
              <MenuItem key={t.name} value={t.name}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <EditableLabelsSection
          labels={memberLinks[0]?.labels}
          inheritedLabels={getInheritedLinkLabels(memberLinks[0], linkTemplates)}
          onUpdate={(labels) => {
            const newLinks = memberLinks.map((link, i) =>
              i === 0 ? { ...link, labels } : link
            );
            updateEdge(selectedEdgeId, { memberLinks: newLinks });
            triggerYamlRefresh();
          }}
        />
      </Box>

      <PanelSection title="Endpoints" count={esiLeaves.length}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: '0.5rem' }}>
          {esiLeaves.map((leaf, index) => {
            const memberLink = memberLinks[index];
            return (
              <Paper
                key={index}
                variant="outlined"
                sx={{ p: '0.5rem', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: '0.5rem',
                    alignItems: "center",
                  }}
                >
                  <TextField
                    label={leaf.nodeName}
                    size="small"
                    value={memberLink?.targetInterface || ''}
                    onChange={(e) =>
                      handleUpdateLink(index, { targetInterface: e.target.value })
                    }
                    slotProps={{ input: { tabIndex: index * 2 + 1 } }}
                    fullWidth
                  />
                  <TextField
                    label={nodeB}
                    size="small"
                    value={memberLink?.sourceInterface || ''}
                    onChange={(e) =>
                      handleUpdateLink(index, { sourceInterface: e.target.value })
                    }
                    slotProps={{ input: { tabIndex: index * 2 + 2 } }}
                    fullWidth
                  />
                  <IconButton
                    size="small"
                    onClick={() => removeLinkFromEsiLag(selectedEdgeId, index)}
                    disabled={esiLeaves.length <= 2}
                    title={esiLeaves.length <= 2 ? "Minimum 2 links required" : "Remove endpoint"}
                  >
                    <DeleteIcon fontSize="small" color={esiLeaves.length <= 2 ? "disabled" : "error"} />
                  </IconButton>
                </Box>
              </Paper>
            );
          })}
        </Box>
      </PanelSection>
    </Box>
  );
}

function BundleLinksPanel({
  nodeA,
  nodeB,
  linksToShow,
  onAddLink,
  handleUpdateLink,
  handleDeleteLink,
  linkTemplates,
  sourceInterfaceRef,
}: Readonly<{
  nodeA: string;
  nodeB: string;
  linksToShow: { link: MemberLink; index: number }[];
  onAddLink: () => void;
  handleUpdateLink: (index: number, update: Partial<MemberLink>) => void;
  handleDeleteLink: (index: number) => void;
  linkTemplates: StoreState["linkTemplates"];
  sourceInterfaceRef: RefObject<HTMLInputElement | null>;
}>) {
  return (
    <Box>
      <PanelHeader
        title={`${nodeA} ↔ ${nodeB}`}
        actions={
          <Button size="small" startIcon={<AddIcon />} onClick={onAddLink}>
            Add
          </Button>
        }
      />

      <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
        {linksToShow.map(({ link, index }, listIndex) => (
          <Paper
            key={index}
            variant="outlined"
            sx={{ p: '0.5rem', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: '0.75rem' }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: '0.5rem',
                  alignItems: "center",
                }}
              >
                <TextField
                  label="Link Name"
                  size="small"
                  value={link.name}
                  onChange={(e) =>
                    handleUpdateLink(index, { name: formatName(e.target.value) })
                  }
                  fullWidth
                />
                <IconButton
                  size="small"
                  onClick={() => handleDeleteLink(index)}
                >
                  <DeleteIcon fontSize="small" color="error" />
                </IconButton>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: '0.5rem',
                }}
              >
                <TextField
                  label={`${nodeA} Interface`}
                  size="small"
                  value={link.targetInterface}
                  onChange={(e) =>
                    handleUpdateLink(index, {
                      targetInterface: e.target.value,
                    })
                  }
                  inputRef={listIndex === 0 ? sourceInterfaceRef : undefined}
                  fullWidth
                />
                <TextField
                  label={`${nodeB} Interface`}
                  size="small"
                  value={link.sourceInterface}
                  onChange={(e) =>
                    handleUpdateLink(index, {
                      sourceInterface: e.target.value,
                    })
                  }
                  fullWidth
                />
              </Box>

              <FormControl size="small" fullWidth>
                <InputLabel>Template</InputLabel>
                <Select
                  label="Template"
                  value={link.template || ""}
                  onChange={(e) =>
                    handleUpdateLink(index, { template: e.target.value })
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {linkTemplates.map((t) => (
                    <MenuItem key={t.name} value={t.name}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

function SingleLinkPanel({
  nodeA,
  nodeB,
  linksToShow,
  handleUpdateLink,
  handleDeleteLink,
  linkTemplates,
  sourceInterfaceRef,
  targetInterfaceRef,
}: Readonly<{
  nodeA: string;
  nodeB: string;
  linksToShow: { link: MemberLink; index: number }[];
  handleUpdateLink: (index: number, update: Partial<MemberLink>) => void;
  handleDeleteLink: (index: number) => void;
  linkTemplates: StoreState["linkTemplates"];
  sourceInterfaceRef: RefObject<HTMLInputElement | null>;
  targetInterfaceRef: RefObject<HTMLInputElement | null>;
}>) {
  return (
    <Box>
      {linksToShow.map(({ link, index }, listIndex) => (
        <Box key={index}>
          <PanelHeader
            title={`${nodeA} ↔ ${nodeB}`}
            actions={
              <IconButton
                size="small"
                onClick={() => handleDeleteLink(index)}
              >
                <DeleteIcon fontSize="small" color="error" />
              </IconButton>
            }
          />

          <Box sx={{ display: "flex", flexDirection: "column", gap: '1rem' }}>
            <TextField
              label="Name"
              size="small"
              value={link.name}
              onChange={(e) =>
                handleUpdateLink(index, { name: formatName(e.target.value) })
              }
              fullWidth
            />

            <FormControl size="small" fullWidth>
              <InputLabel>Template</InputLabel>
              <Select
                label="Template"
                value={link.template || ""}
                onChange={(e) =>
                  handleUpdateLink(index, { template: e.target.value })
                }
              >
                <MenuItem value="">None</MenuItem>
                {linkTemplates.map((t) => (
                  <MenuItem key={t.name} value={t.name}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <EditableLabelsSection
              labels={link.labels}
              inheritedLabels={getInheritedLinkLabels(link, linkTemplates)}
              onUpdate={(labels) => handleUpdateLink(index, { labels })}
            />
          </Box>

          <PanelSection title="Endpoints">
            <Paper variant="outlined" sx={{ p: '0.5rem', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: '0.5rem',
                  alignItems: "center",
                }}
              >
                <TextField
                  label={nodeA}
                  size="small"
                  value={link.targetInterface}
                  onChange={(e) =>
                    handleUpdateLink(index, {
                      targetInterface: e.target.value,
                    })
                  }
                  inputRef={listIndex === 0 ? sourceInterfaceRef : undefined}
                  slotProps={{ input: { tabIndex: 1 } }}
                  fullWidth
                />
                <TextField
                  label={nodeB}
                  size="small"
                  value={link.sourceInterface}
                  onChange={(e) =>
                    handleUpdateLink(index, {
                      sourceInterface: e.target.value,
                    })
                  }
                  inputRef={listIndex === 0 ? targetInterfaceRef : undefined}
                  slotProps={{ input: { tabIndex: 2 } }}
                  fullWidth
                />
              </Box>
            </Paper>
          </PanelSection>
        </Box>
      ))}
    </Box>
  );
}

function StandardEdgePanel({
  nodeA,
  nodeB,
  memberLinks,
  linksToShow,
  isExpanded,
  onAddLink,
  handleUpdateLink,
  handleDeleteLink,
  linkTemplates,
  sourceInterfaceRef,
  targetInterfaceRef,
}: Readonly<{
  nodeA: string;
  nodeB: string;
  memberLinks: MemberLink[];
  linksToShow: { link: MemberLink; index: number }[];
  isExpanded: boolean;
  onAddLink: () => void;
  handleUpdateLink: (index: number, update: Partial<MemberLink>) => void;
  handleDeleteLink: (index: number) => void;
  linkTemplates: StoreState["linkTemplates"];
  sourceInterfaceRef: RefObject<HTMLInputElement | null>;
  targetInterfaceRef: RefObject<HTMLInputElement | null>;
}>) {
  const isShowingBundle = !isExpanded || memberLinks.length <= 1;

  if (memberLinks.length === 0) {
    return (
      <Box>
        <PanelHeader title={`${nodeA} ↔ ${nodeB}`} />
        <Typography color="text.secondary" textAlign="center" py="1rem">
          No member links
        </Typography>
      </Box>
    );
  }

  if (linksToShow.length === 0) {
    return (
      <Box>
        <PanelHeader
          title={`${nodeA} ↔ ${nodeB}`}
          actions={
            <Button size="small" startIcon={<AddIcon />} onClick={onAddLink}>
              Add
            </Button>
          }
        />
        <Typography color="text.secondary" textAlign="center" py="1rem">
          Select a link to edit
        </Typography>
      </Box>
    );
  }

  if (isShowingBundle && memberLinks.length > 1) {
    return (
      <BundleLinksPanel
        nodeA={nodeA}
        nodeB={nodeB}
        linksToShow={linksToShow}
        onAddLink={onAddLink}
        handleUpdateLink={handleUpdateLink}
        handleDeleteLink={handleDeleteLink}
        linkTemplates={linkTemplates}
        sourceInterfaceRef={sourceInterfaceRef}
      />
    );
  }

  return (
    <SingleLinkPanel
      nodeA={nodeA}
      nodeB={nodeB}
      linksToShow={linksToShow}
      handleUpdateLink={handleUpdateLink}
      handleDeleteLink={handleDeleteLink}
      linkTemplates={linkTemplates}
      sourceInterfaceRef={sourceInterfaceRef}
      targetInterfaceRef={targetInterfaceRef}
    />
  );
}

export function EdgeSelectionPanel({
  selectedEdge,
  expandedEdges,
  selectedMemberLinkIndices,
  selectedLagId,
  linkTemplates,
  updateEdge,
  deleteEdge,
  triggerYamlRefresh,
}: Readonly<{
  selectedEdge: TopologyEdge;
  expandedEdges: StoreState["expandedEdges"];
  selectedMemberLinkIndices: number[];
  selectedLagId: string | null;
  linkTemplates: StoreState["linkTemplates"];
  updateEdge: StoreState["updateEdge"];
  deleteEdge: StoreState["deleteEdge"];
  triggerYamlRefresh: StoreState["triggerYamlRefresh"];
}>) {
  const edgeData = selectedEdge.data!;
  const memberLinks = edgeData.memberLinks || [];
  const lagGroups = edgeData.lagGroups || [];
  const isExpanded = expandedEdges.has(selectedEdge.id);

  const nodeA = edgeData.targetNode;
  const nodeB = edgeData.sourceNode;

  const sourceInterfaceRef = useRef<HTMLInputElement>(null);
  const targetInterfaceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newLinkId = sessionStorage.getItem('topology-new-link-id');
    if (selectedEdge.id && selectedEdge.id === newLinkId) {
      setTimeout(() => focusInputAtEnd(sourceInterfaceRef.current), 100);
      sessionStorage.removeItem('topology-new-link-id');
    }
  }, [selectedEdge.id]);

  const handleUpdateLink = (index: number, update: Partial<MemberLink>) => {
    const newLinks = memberLinks.map((link, i) =>
      i === index ? { ...link, ...update } : link,
    );
    updateEdge(selectedEdge.id, { memberLinks: newLinks });
    triggerYamlRefresh();
  };

  const handleDeleteLink = (index: number) => {
    const newLinks = memberLinks.filter((_, i) => i !== index);

    if (newLinks.length === 0) {
      deleteEdge(selectedEdge.id);
      triggerYamlRefresh();
      return;
    }

    const newLagGroups = lagGroups.map(lag => ({
      ...lag,
      memberLinkIndices: lag.memberLinkIndices
        .filter(i => i !== index)
        .map(i => i > index ? i - 1 : i),
    })).filter(lag => lag.memberLinkIndices.length > 0);

    updateEdge(selectedEdge.id, {
      memberLinks: newLinks,
      lagGroups: newLagGroups.length > 0 ? newLagGroups : undefined,
    });
    triggerYamlRefresh();
  };

  const handleUpdateLagGroup = (lagId: string, update: Partial<LagGroup>) => {
    const newLagGroups = lagGroups.map(lag =>
      lag.id === lagId ? { ...lag, ...update } : lag
    );
    updateEdge(selectedEdge.id, { lagGroups: newLagGroups });
    triggerYamlRefresh();
  };

  const selectedLag = selectedLagId ? lagGroups.find(lag => lag.id === selectedLagId) : null;

  const linksToShow = (() => {
    if (isExpanded && memberLinks.length > 1) {
      if (selectedMemberLinkIndices.length > 0) {
        return selectedMemberLinkIndices
          .filter(i => i >= 0 && i < memberLinks.length)
          .map(i => ({ link: memberLinks[i], index: i }));
      }
      return [];
    }
    return memberLinks.map((link, index) => ({ link, index }));
  })();

  if (selectedLag) {
    return (
      <LagGroupPanel
        nodeA={nodeA}
        nodeB={nodeB}
        selectedEdgeId={selectedEdge.id}
        selectedLag={selectedLag}
        memberLinks={memberLinks}
        linkTemplates={linkTemplates}
        handleUpdateLagGroup={handleUpdateLagGroup}
        handleUpdateLink={handleUpdateLink}
      />
    );
  }

  if (edgeData.isMultihomed && edgeData.esiLeaves) {
    return (
      <EsiLagPanel
        nodeB={nodeB}
        selectedEdgeId={selectedEdge.id}
        memberLinks={memberLinks}
        esiLeaves={edgeData.esiLeaves}
        linkTemplates={linkTemplates}
        handleUpdateLink={handleUpdateLink}
        updateEdge={updateEdge}
        triggerYamlRefresh={triggerYamlRefresh}
      />
    );
  }

  const addMemberLink = useTopologyStore.getState().addMemberLink;
  const handleAddLink = () => {
    const lastLink = memberLinks[memberLinks.length - 1];
    const nextNum = memberLinks.length + 1;
    addMemberLink(selectedEdge.id, {
      name: `${nodeB}-${nodeA}-${nextNum}`,
      template: lastLink?.template,
      sourceInterface: incrementInterface(lastLink?.sourceInterface || DEFAULT_INTERFACE, nextNum),
      targetInterface: incrementInterface(lastLink?.targetInterface || DEFAULT_INTERFACE, nextNum),
    });
    triggerYamlRefresh();
  };

  return (
    <StandardEdgePanel
      nodeA={nodeA}
      nodeB={nodeB}
      memberLinks={memberLinks}
      linksToShow={linksToShow}
      isExpanded={isExpanded}
      onAddLink={handleAddLink}
      handleUpdateLink={handleUpdateLink}
      handleDeleteLink={handleDeleteLink}
      linkTemplates={linkTemplates}
      sourceInterfaceRef={sourceInterfaceRef}
      targetInterfaceRef={targetInterfaceRef}
    />
  );
}
