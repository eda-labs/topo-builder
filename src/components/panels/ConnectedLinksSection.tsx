import { Box, Chip, Paper, Typography } from '@mui/material';
import type { Edge } from '@xyflow/react';

import { LagCard, LinkDiagram } from '../edges/cards';
import { CARD_BG, CARD_BORDER } from '../../lib/constants';
import { useTopologyStore } from '../../lib/store';
import type { UIEdgeData } from '../../types/ui';

import { PanelSection } from './shared';

const SPACE_BETWEEN = 'space-between';

export function ConnectedLinksSection({
  edges,
  localNodeName,
}: {
  edges: Edge<UIEdgeData>[];
  localNodeName: string;
}) {
  if (edges.length === 0) return null;

  const memberLinkCount = edges.reduce(
    (sum, e) => sum + (e.data?.memberLinks?.length || 0),
    0,
  );

  return (
    <PanelSection title="Connected Links" count={memberLinkCount}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        {edges.map(edge => {
          const edgeData = edge.data;
          if (!edgeData) return null;

          const memberLinks = edgeData.memberLinks || [];
          const lagGroups = edgeData.lagGroups || [];
          const isEsiLag = edgeData.edgeType === 'esilag';
          const otherNode = edgeData.sourceNode === localNodeName
            ? edgeData.targetNode
            : edgeData.sourceNode;

          if (isEsiLag && edgeData.esiLeaves) {
            const esiName = memberLinks[0]?.name || `${edgeData.sourceNode}-esi-lag`;
            return (
              <Paper
                key={edge.id}
                variant="outlined"
                sx={{ p: '0.5rem', cursor: 'pointer', bgcolor: CARD_BG, borderColor: CARD_BORDER }}
                onClick={() => { useTopologyStore.getState().selectEdge(edge.id); }}
              >
                <Box sx={{ display: 'flex', justifyContent: SPACE_BETWEEN, alignItems: 'center' }}>
                  <Typography variant="body2" fontWeight={500}>
                    {esiName}
                  </Typography>
                  <Chip label="ESI-LAG" size="small" sx={{ height: 16, fontSize: 10 }} color="primary" />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {edgeData.esiLeaves.length} member links
                </Typography>
              </Paper>
            );
          }

          const indicesInLags = new Set<number>();
          lagGroups.forEach(lag => { lag.memberLinkIndices.forEach(i => indicesInLags.add(i)); });

          const isSource = edgeData.sourceNode === localNodeName;

          const lagElements = lagGroups.map(lag => (
            <LagCard
              key={lag.id}
              lag={lag}
              edgeId={edge.id}
              localNode={localNodeName}
              otherNode={otherNode}
              selectEdgeOnClick
            />
          ));

          const standaloneLinks = memberLinks
            .map((link, idx) => ({ link, idx }))
            .filter(({ idx }) => !indicesInLags.has(idx))
            .map(({ link, idx }) => {
              const localInterface = isSource ? link.sourceInterface : link.targetInterface;
              const remoteInterface = isSource ? link.targetInterface : link.sourceInterface;
              return (
                <Paper
                  key={`${edge.id}-${idx}`}
                  variant="outlined"
                  sx={{ p: '0.5rem', cursor: 'pointer', bgcolor: CARD_BG, borderColor: CARD_BORDER }}
                  onClick={() => {
                    const store = useTopologyStore.getState();
                    const expanded = new Set(store.expandedEdges);
                    expanded.add(edge.id);
                    useTopologyStore.setState({ expandedEdges: expanded });
                    store.selectMemberLink(edge.id, idx, false);
                  }}
                >
                  <Typography variant="body2" fontWeight={500} sx={{ mb: '0.25rem' }}>
                    {link.name}
                  </Typography>
                  <LinkDiagram
                    localNode={localNodeName}
                    remoteNode={otherNode}
                    localInterface={localInterface}
                    remoteInterface={remoteInterface}
                  />
                </Paper>
              );
            });

          return [...lagElements, ...standaloneLinks];
        })}
      </Box>
    </PanelSection>
  );
}
