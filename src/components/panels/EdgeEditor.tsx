import { type RefObject } from 'react';
import { Add as AddIcon, Delete as DeleteIcon, SubdirectoryArrowRight as ArrowIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { Edge } from '@xyflow/react';

import { LagCard } from '../edges/cards';
import { CARD_BG, CARD_BORDER, DEFAULT_INTERFACE } from '../../lib/constants';
import { getInheritedLagLabels, getInheritedLinkLabels } from '../../lib/labels';
import { useTopologyStore } from '../../lib/store';
import { formatName } from '../../lib/utils';
import type { LinkTemplate } from '../../types/schema';
import type { UIEdgeData, UILagGroup, UIMemberLink } from '../../types/ui';

import { EditableLabelsSection, PanelHeader, PanelSection } from './shared';

interface EdgeEditorProps {
  edge: Edge<UIEdgeData>;
  linkTemplates: LinkTemplate[];
  selectedLagId: string | null;
  selectedMemberLinkIndices: number[];
  expandedEdges: Set<string>;
  sourceInterfaceRef?: RefObject<HTMLInputElement | null>;
  targetInterfaceRef?: RefObject<HTMLInputElement | null>;
}

export function EdgeEditor({
  edge,
  linkTemplates,
  selectedLagId,
  selectedMemberLinkIndices,
  expandedEdges,
  sourceInterfaceRef,
  targetInterfaceRef,
}: EdgeEditorProps) {
  const updateEdge = useTopologyStore(state => state.updateEdge);
  const deleteEdge = useTopologyStore(state => state.deleteEdge);
  const triggerYamlRefresh = useTopologyStore(state => state.triggerYamlRefresh);
  const edgeData = edge.data;
  if (!edgeData) return null;
  const memberLinks = edgeData.memberLinks || [];
  const lagGroups = edgeData.lagGroups || [];
  const isExpanded = expandedEdges.has(edge.id);

  const nodeA = edgeData.targetNode;
  const nodeB = edgeData.sourceNode;

  const handleUpdateLink = (index: number, update: Partial<UIMemberLink>) => {
    const newLinks = memberLinks.map((link, i) =>
      i === index ? { ...link, ...update } : link,
    );
    updateEdge(edge.id, { memberLinks: newLinks });
    triggerYamlRefresh();
  };

  const handleDeleteLink = (index: number) => {
    const newLinks = memberLinks.filter((_, i) => i !== index);

    if (newLinks.length === 0) {
      deleteEdge(edge.id);
      triggerYamlRefresh();
      return;
    }

    const newLagGroups = lagGroups.map(lag => ({
      ...lag,
      memberLinkIndices: lag.memberLinkIndices
        .filter(i => i !== index)
        .map(i => i > index ? i - 1 : i),
    })).filter(lag => lag.memberLinkIndices.length > 0);

    updateEdge(edge.id, {
      memberLinks: newLinks,
      lagGroups: newLagGroups.length > 0 ? newLagGroups : undefined,
    });
    triggerYamlRefresh();
  };

  const handleUpdateLagGroup = (lagId: string, update: Partial<UILagGroup>) => {
    const newLagGroups = lagGroups.map(lag =>
      lag.id === lagId ? { ...lag, ...update } : lag,
    );
    updateEdge(edge.id, { lagGroups: newLagGroups });
    triggerYamlRefresh();
  };

  const renderLagEditorView = () => {
    if (!selectedLagId) return null;

    const selectedLag = lagGroups.find(lag => lag.id === selectedLagId);
    if (!selectedLag) return null;

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

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <TextField
            label="Name"
            size="small"
            value={selectedLag.name}
            onChange={e => { handleUpdateLagGroup(selectedLag.id, { name: formatName(e.target.value) }); }}
            fullWidth
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Template</InputLabel>
            <Select
              label="Template"
              value={selectedLag.template || ''}
              onChange={e => { handleUpdateLagGroup(selectedLag.id, { template: e.target.value }); }}
            >
              <MenuItem value="">None</MenuItem>
              {linkTemplates.map(t => (
                <MenuItem key={t.name} value={t.name}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <EditableLabelsSection
            labels={selectedLag.labels}
            inheritedLabels={getInheritedLagLabels(selectedLag, linkTemplates)}
            onUpdate={labels => { handleUpdateLagGroup(selectedLag.id, { labels }); }}
          />
        </Box>

        <PanelSection
          title="Endpoints"
          count={lagMemberLinksWithIndices.length}
          actions={
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => { addLinkToLag(edge.id, selectedLag.id); }}
            >
              Add
            </Button>
          }
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {lagMemberLinksWithIndices.map(({ link, index }, listIndex) => (
              <Paper
                key={index}
                variant="outlined"
                sx={{ p: '0.5rem', bgcolor: CARD_BG, borderColor: CARD_BORDER }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto',
                    gap: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  <TextField
                    label={nodeA}
                    size="small"
                    value={link.targetInterface}
                    onChange={e =>
                    { handleUpdateLink(index, { targetInterface: e.target.value }); }
                    }
                    slotProps={{ htmlInput: { tabIndex: listIndex * 2 + 1 } }}
                    fullWidth
                  />
                  <TextField
                    label={nodeB}
                    size="small"
                    value={link.sourceInterface}
                    onChange={e =>
                    { handleUpdateLink(index, { sourceInterface: e.target.value }); }
                    }
                    slotProps={{ htmlInput: { tabIndex: listIndex * 2 + 2 } }}
                    fullWidth
                  />
                  <IconButton
                    size="small"
                    onClick={() => { removeLinkFromLag(edge.id, selectedLag.id, index); }}
                    title={lagMemberLinksWithIndices.length <= 2 ? 'Remove LAG (min 2 links)' : 'Remove from LAG'}
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
  };

  const lagEditorView = renderLagEditorView();
  if (lagEditorView) return lagEditorView;

  const renderEsiLagEditorView = () => {
    if (edgeData.edgeType !== 'esilag') return null;
    if (!edgeData.esiLeaves) return null;

    const esiLeaves = edgeData.esiLeaves;
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
            {esiLeaves.map(leaf => (
              <Box key={leaf.nodeId} sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                <ArrowIcon sx={{ fontSize: 16, mr: '0.25rem' }} />
                <Typography variant="body2">{leaf.nodeName}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <TextField
            label="Name"
            size="small"
            value={memberLinks[0]?.name || ''}
            onChange={e => {
              const newName = formatName(e.target.value);
              const newLinks = memberLinks.map((link, i) =>
                i === 0 ? { ...link, name: newName } : link,
              );
              updateEdge(edge.id, { memberLinks: newLinks });
              triggerYamlRefresh();
            }}
            fullWidth
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Template</InputLabel>
            <Select
              label="Template"
              value={memberLinks[0]?.template || ''}
              onChange={e => {
                const newTemplate = e.target.value;
                const newLinks = memberLinks.map(link => ({ ...link, template: newTemplate }));
                updateEdge(edge.id, { memberLinks: newLinks });
                triggerYamlRefresh();
              }}
            >
              <MenuItem value="">None</MenuItem>
              {linkTemplates.map(t => (
                <MenuItem key={t.name} value={t.name}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <EditableLabelsSection
            labels={memberLinks[0]?.labels}
            inheritedLabels={getInheritedLinkLabels(memberLinks[0], linkTemplates)}
            onUpdate={labels => {
              const newLinks = memberLinks.map((link, i) =>
                i === 0 ? { ...link, labels } : link,
              );
              updateEdge(edge.id, { memberLinks: newLinks });
              triggerYamlRefresh();
            }}
          />
        </Box>

        <PanelSection
          title="Endpoints"
          count={esiLeaves.length}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {esiLeaves.map((leaf, index) => {
              const memberLink = memberLinks[index];
              return (
                <Paper
                  key={index}
                  variant="outlined"
                  sx={{ p: '0.5rem', bgcolor: CARD_BG, borderColor: CARD_BORDER }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr auto',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <TextField
                      label={leaf.nodeName}
                      size="small"
                      value={memberLink?.targetInterface || ''}
                      onChange={e =>
                      { handleUpdateLink(index, { targetInterface: e.target.value }); }
                      }
                      slotProps={{ htmlInput: { tabIndex: index * 2 + 1 } }}
                      fullWidth
                    />
                    <TextField
                      label={nodeB}
                      size="small"
                      value={memberLink?.sourceInterface || ''}
                      onChange={e =>
                      { handleUpdateLink(index, { sourceInterface: e.target.value }); }
                      }
                      slotProps={{ htmlInput: { tabIndex: index * 2 + 2 } }}
                      fullWidth
                    />
                    <IconButton
                      size="small"
                      onClick={() => { removeLinkFromEsiLag(edge.id, index); }}
                      disabled={esiLeaves.length <= 2}
                      title={esiLeaves.length <= 2 ? 'Minimum 2 links required' : 'Remove endpoint'}
                    >
                      <DeleteIcon fontSize="small" color={esiLeaves.length <= 2 ? 'disabled' : 'error'} />
                    </IconButton>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </PanelSection>
      </Box>
    );
  };

  const esiLagEditorView = renderEsiLagEditorView();
  if (esiLagEditorView) return esiLagEditorView;

  const renderRegularLinkEditorView = () => {
    const linksToShow = (() => {
      if (isExpanded && memberLinks.length > 1) {
        return selectedMemberLinkIndices.length > 0
          ? selectedMemberLinkIndices
            .filter(i => i >= 0 && i < memberLinks.length)
            .map(i => ({ link: memberLinks[i], index: i }))
          : [];
      }
      return memberLinks.map((link, index) => ({ link, index }));
    })();

    const addMemberLink = useTopologyStore.getState().addMemberLink;
    const isShowingBundle = !isExpanded || memberLinks.length <= 1;

    const indicesInLags = new Set<number>();
    lagGroups.forEach(lag => { lag.memberLinkIndices.forEach(i => indicesInLags.add(i)); });

    const handleAddLink = () => {
      const lastLink = memberLinks[memberLinks.length - 1];
      const nextNum = memberLinks.length + 1;
      const incrementInterface = (iface: string) => {
        const match = iface.match(/^(.+?)(\d+)$/);
        if (match) {
          return `${match[1]}${parseInt(match[2], 10) + 1}`;
        }
        return `${iface}-${nextNum}`;
      };
      addMemberLink(edge.id, {
        name: `${nodeB}-${nodeA}-${nextNum}`,
        template: lastLink?.template,
        sourceInterface: incrementInterface(lastLink?.sourceInterface || DEFAULT_INTERFACE),
        targetInterface: incrementInterface(lastLink?.targetInterface || DEFAULT_INTERFACE),
      });
      triggerYamlRefresh();
    };

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
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddLink}>
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
      const standaloneLinks = linksToShow.filter(({ index }) => !indicesInLags.has(index));

      return (
        <Box>
          <PanelHeader
            title={`${nodeA} ↔ ${nodeB}`}
            actions={
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddLink}>
                Add
              </Button>
            }
          />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {lagGroups.map(lag => (
              <LagCard
                key={lag.id}
                lag={lag}
                edgeId={edge.id}
                localNode={nodeB}
                otherNode={nodeA}
              />
            ))}

            {standaloneLinks.map(({ link, index }, listIndex) => (
              <Paper
                key={index}
                variant="outlined"
                sx={{ p: '0.5rem', bgcolor: CARD_BG, borderColor: CARD_BORDER }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <TextField
                      label="Link Name"
                      size="small"
                      value={link.name}
                      onChange={e => { handleUpdateLink(index, { name: formatName(e.target.value) }); }}
                      fullWidth
                    />
                    <IconButton size="small" onClick={() => { handleDeleteLink(index); }}>
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.5rem',
                    }}
                  >
                    <TextField
                      label={`${nodeA} Interface`}
                      size="small"
                      value={link.targetInterface}
                      onChange={e => { handleUpdateLink(index, { targetInterface: e.target.value }); }}
                      inputRef={listIndex === 0 ? sourceInterfaceRef : undefined}
                      slotProps={{ htmlInput: { 'data-testid': `link-endpoint-a-${listIndex}` } }}
                      fullWidth
                    />
                    <TextField
                      label={`${nodeB} Interface`}
                      size="small"
                      value={link.sourceInterface}
                      onChange={e => { handleUpdateLink(index, { sourceInterface: e.target.value }); }}
                      slotProps={{ htmlInput: { 'data-testid': `link-endpoint-b-${listIndex}` } }}
                      fullWidth
                    />
                  </Box>

                  <FormControl size="small" fullWidth>
                    <InputLabel>Template</InputLabel>
                    <Select
                      label="Template"
                      value={link.template || ''}
                      onChange={e => { handleUpdateLink(index, { template: e.target.value }); }}
                    >
                      <MenuItem value="">None</MenuItem>
                      {linkTemplates.map(t => (
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

    // Single link detailed editor
    return (
      <Box>
        {linksToShow.map(({ link, index }, listIndex) => (
          <Box key={index}>
            <PanelHeader
              title={`${nodeA} ↔ ${nodeB}`}
              actions={
                <IconButton
                  size="small"
                  onClick={() => { handleDeleteLink(index); }}
                >
                  <DeleteIcon fontSize="small" color="error" />
                </IconButton>
              }
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <TextField
                label="Name"
                size="small"
                value={link.name}
                onChange={e =>
                { handleUpdateLink(index, { name: formatName(e.target.value) }); }
                }
                fullWidth
              />

              <FormControl size="small" fullWidth>
                <InputLabel>Template</InputLabel>
                <Select
                  label="Template"
                  value={link.template || ''}
                  onChange={e =>
                  { handleUpdateLink(index, { template: e.target.value }); }
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {linkTemplates.map(t => (
                    <MenuItem key={t.name} value={t.name}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <EditableLabelsSection
                labels={link.labels}
                inheritedLabels={getInheritedLinkLabels(link, linkTemplates)}
                onUpdate={labels => { handleUpdateLink(index, { labels }); }}
              />
            </Box>

            <PanelSection title="Endpoints">
              <Paper variant="outlined" sx={{ p: '0.5rem', bgcolor: CARD_BG, borderColor: CARD_BORDER }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  <TextField
                    label={nodeA}
                    size="small"
                    value={link.targetInterface}
                    onChange={e =>
                    { handleUpdateLink(index, {
                      targetInterface: e.target.value,
                    }); }
                    }
                    inputRef={listIndex === 0 ? sourceInterfaceRef : undefined}
                    slotProps={{ htmlInput: { tabIndex: 1, 'data-testid': `link-endpoint-a-${listIndex}` } }}
                    fullWidth
                  />
                  <TextField
                    label={nodeB}
                    size="small"
                    value={link.sourceInterface}
                    onChange={e =>
                    { handleUpdateLink(index, {
                      sourceInterface: e.target.value,
                    }); }
                    }
                    inputRef={listIndex === 0 ? targetInterfaceRef : undefined}
                    slotProps={{ htmlInput: { tabIndex: 2, 'data-testid': `link-endpoint-b-${listIndex}` } }}
                    fullWidth
                  />
                </Box>
              </Paper>
            </PanelSection>
          </Box>
        ))}
      </Box>
    );
  };

  return renderRegularLinkEditorView();
}
