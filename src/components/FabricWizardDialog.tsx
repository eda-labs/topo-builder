import { useMemo, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';

import { useTopologyStore } from '../lib/store';
import { fabricPortCapacity } from '../lib/store/fabric';
import { platformCatalog, type CatalogFixedItem } from '../lib/catalog';

const DEFAULT_SPINE_PLATFORM = '7220 IXR-D5';
const DEFAULT_LEAF_PLATFORM = '7220 IXR-D3L';
const TEXT_SECONDARY = 'text.secondary';

const clampCount = (value: string, max: number): number => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(max, parsed));
};

interface TierState {
  count: number;
  item: CatalogFixedItem;
}

function TierRow({ label, tier, options, maxCount, onChange, testId }: {
  label: string;
  tier: TierState;
  options: CatalogFixedItem[];
  maxCount: number;
  onChange: (tier: TierState) => void;
  testId: string;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField
        type="number"
        size="small"
        label={label}
        value={tier.count}
        data-testid={`${testId}-count`}
        onChange={e => { onChange({ ...tier, count: clampCount(e.target.value, maxCount) }); }}
        slotProps={{ htmlInput: { min: 1, max: maxCount, step: 1 } }}
        sx={{ width: 88, flexShrink: 0 }}
      />
      <Autocomplete
        size="small"
        fullWidth
        disableClearable
        options={options}
        value={tier.item}
        groupBy={option => option.label.split(' ')[0]}
        getOptionLabel={option => option.label}
        isOptionEqualToValue={(a, b) => a.label === b.label}
        onChange={(_, item) => { onChange({ ...tier, item }); }}
        renderInput={params => <TextField {...params} label="Platform" data-testid={`${testId}-platform`} />}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.label} sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="body2" sx={{ flex: 1 }}>{option.label}</Typography>
            <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>{option.ports} ports</Typography>
          </Box>
        )}
      />
    </Box>
  );
}

/**
 * Leaf-spine fabric wizard: pick how many spines and leaves of which platform, and the fabric
 * lands on the canvas with every leaf cabled to every spine (validated-design wiring: leaf i
 * occupies port i of each spine, spine j occupies uplink j of each leaf).
 */
export default function FabricWizardDialog({ open, onClose }: {
  open: boolean;
  onClose: () => void;
}) {
  const addFabric = useTopologyStore(state => state.addFabric);
  const { fitView } = useReactFlow();

  const options = useMemo(
    () => platformCatalog.flatMap(group => group.items),
    [],
  );
  const itemOf = (platform: string): CatalogFixedItem =>
    options.find(item => item.platform === platform && !item.components) ?? options[0];

  const [spines, setSpines] = useState<TierState>(() => ({ count: 2, item: itemOf(DEFAULT_SPINE_PLATFORM) }));
  const [leaves, setLeaves] = useState<TierState>(() => ({ count: 4, item: itemOf(DEFAULT_LEAF_PLATFORM) }));
  const [uplinks, setUplinks] = useState(1);

  const spinePorts = useMemo(() => fabricPortCapacity(spines.item), [spines.item]);
  const leafPorts = useMemo(() => fabricPortCapacity(leaves.item), [leaves.item]);
  const spineNeeds = leaves.count * uplinks;
  const leafNeeds = spines.count * uplinks;
  const capacityError = (() => {
    if (spineNeeds > spinePorts) {
      return `${spines.item.label} has ${spinePorts} ports — ${spineNeeds} leaf downlinks won't fit`;
    }
    if (leafNeeds > leafPorts) {
      return `${leaves.item.label} has ${leafPorts} ports — ${leafNeeds} spine uplinks won't fit`;
    }
    return null;
  })();

  const linkCount = spines.count * leaves.count * uplinks;

  const handleAdd = () => {
    const ok = addFabric({
      spines: { count: spines.count, platform: spines.item.platform, components: spines.item.components },
      leaves: { count: leaves.count, platform: leaves.item.platform, components: leaves.item.components },
      uplinksPerPair: uplinks,
    });
    if (!ok) return;
    onClose();
    setTimeout(() => { void fitView({ padding: 0.1, duration: 300 }); }, 100);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth data-testid="fabric-wizard">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <Typography component="span" sx={{ fontWeight: 700, flex: 1 }}>
          Fabric wizard
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close wizard">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
          Builds a leaf-spine fabric with every leaf connected to every spine, wired like the
          Nokia validated designs (leaf uplinks and spine downlinks fill port-by-port).
        </Typography>
        <TierRow label="Spines" tier={spines} options={options} maxCount={8} onChange={setSpines} testId="fabric-wizard-spine" />
        <TierRow label="Leaves" tier={leaves} options={options} maxCount={32} onChange={setLeaves} testId="fabric-wizard-leaf" />
        <TextField
          type="number"
          size="small"
          label="Uplinks per leaf-spine pair"
          value={uplinks}
          data-testid="fabric-wizard-uplinks"
          onChange={e => { setUplinks(clampCount(e.target.value, 8)); }}
          slotProps={{ htmlInput: { min: 1, max: 8, step: 1 } }}
        />
        {capacityError
          ? <Alert severity="error" data-testid="fabric-wizard-error">{capacityError}</Alert>
          : (
            <Typography variant="caption" sx={{ color: TEXT_SECONDARY }} data-testid="fabric-wizard-summary">
              {spines.count} × {spines.item.label} + {leaves.count} × {leaves.item.label} · {linkCount} inter-switch link{linkCount === 1 ? '' : 's'}
            </Typography>
          )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={capacityError !== null}
          onClick={handleAdd}
          data-testid="fabric-wizard-add"
        >
          Add to canvas
        </Button>
      </DialogActions>
    </Dialog>
  );
}
