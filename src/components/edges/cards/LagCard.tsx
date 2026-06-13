import { Box, Chip, Paper, Typography } from '@mui/material';

import { CARD_BG, CARD_BORDER } from '../../../lib/constants';
import { useTopologyStore } from '../../../lib/store';
import type { UILagGroup } from '../../../types/ui';

import { LinkDiagram } from './LinkDiagram';

interface LagCardProps {
  lag: UILagGroup;
  edgeId: string;
  localNode: string;
  otherNode: string;
  selectEdgeOnClick?: boolean;
}

export function LagCard({
  lag,
  edgeId,
  localNode,
  otherNode,
  selectEdgeOnClick = false,
}: LagCardProps) {
  const selectLag = useTopologyStore(state => state.selectLag);

  const handleClick = () => {
    if (selectEdgeOnClick) {
      const expanded = new Set(useTopologyStore.getState().expandedEdges);
      expanded.add(edgeId);
      useTopologyStore.setState({ expandedEdges: expanded });
    }
    selectLag(edgeId, lag.id);
  };

  return (
    <Paper
      variant="outlined"
      sx={{ p: '0.5rem', cursor: 'pointer', bgcolor: CARD_BG, borderColor: CARD_BORDER }}
      onClick={handleClick}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '0.25rem' }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {lag.name || 'Unnamed LAG'}
        </Typography>
        <Chip label="LAG" size="small" sx={{ height: 16, fontSize: 10 }} color="primary" />
      </Box>
      <LinkDiagram
        localNode={localNode}
        remoteNode={otherNode}
        centerLabel={`${lag.memberLinkIndices.length} member links`}
      />
    </Paper>
  );
}
