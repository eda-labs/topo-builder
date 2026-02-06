import { Box, Chip, Paper, Typography } from '@mui/material';

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
  const selectEdge = useTopologyStore(state => state.selectEdge);
  const selectLag = useTopologyStore(state => state.selectLag);

  const handleClick = () => {
    if (selectEdgeOnClick) {
      selectEdge(edgeId);
    }
    selectLag(edgeId, lag.id);
  };

  return (
    <Paper
      variant="outlined"
      sx={{ p: '0.5rem', cursor: 'pointer', bgcolor: 'var(--mui-palette-card-bg)', borderColor: 'var(--mui-palette-card-border)' }}
      onClick={handleClick}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '0.25rem' }}>
        <Typography variant="body2" fontWeight={500}>
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
