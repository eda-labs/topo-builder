import { useState, useEffect, type ReactNode } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Autocomplete,
  Chip,
  Divider,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Check as CheckIcon } from '@mui/icons-material';

import { CARD_BG, CARD_BORDER, COLOR_PALETTE } from '../../lib/constants';

const SPACE_BETWEEN = 'space-between';

export function PanelHeader({
  title,
  chip,
  actions,
}: {
  title: string;
  chip?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Box sx={{ mb: '1rem' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: SPACE_BETWEEN,
          alignItems: 'center',
          minHeight: 32,
          mb: '0.5rem',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
            {title}
          </Typography>
          {chip}
        </Box>
        {actions}
      </Box>
      <Divider />
    </Box>
  );
}

export function PanelSection({
  title,
  count,
  actions,
  children,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box sx={{ mt: '1rem' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: SPACE_BETWEEN,
          alignItems: 'center',
          minHeight: 32,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}{count !== undefined ? ` (${count})` : ''}
        </Typography>
        {actions}
      </Box>
      <Divider sx={{ mt: '0.25rem', mb: '1rem' }} />
      {children}
    </Box>
  );
}

export function PanelCard({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: '0.5rem',
        bgcolor: CARD_BG,
        borderColor: CARD_BORDER,
      }}
    >
      {children}
    </Paper>
  );
}

export function EditableLabelsSection({
  labels,
  inheritedLabels,
  onUpdate,
}: {
  labels?: Record<string, string>;
  inheritedLabels?: Record<string, string>;
  onUpdate: (labels: Record<string, string>) => void;
}) {
  const handleAddLabel = () => {
    let counter = 1;
    let newKey = `eda.nokia.com/label-${counter}`;
    while (labels?.[newKey] || inheritedLabels?.[newKey]) {
      counter++;
      newKey = `eda.nokia.com/label-${counter}`;
    }
    onUpdate({ ...labels, [newKey]: '' });
  };

  const handleUpdateLabel = (oldKey: string, newKey: string, value: string) => {
    const filteredLabels = Object.fromEntries(
      Object.entries(labels ?? {}).filter(([k]) => k !== oldKey),
    );
    onUpdate({ ...filteredLabels, [newKey]: value });
  };

  const handleDeleteLabel = (key: string) => {
    const newLabels = Object.fromEntries(
      Object.entries(labels ?? {}).filter(([k]) => k !== key),
    );
    onUpdate(newLabels);
  };

  const inheritedEntries = Object.entries(inheritedLabels || {});

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: SPACE_BETWEEN,
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Labels
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={handleAddLabel}>
          Add
        </Button>
      </Box>
      <Divider sx={{ mt: '0.25rem', mb: '1rem' }} />
      {inheritedEntries.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', mb: '0.75rem' }}>
          {inheritedEntries.map(([key, value]) => (
            <Chip
              key={key}
              label={`${key}=${value}`}
              size="small"
              variant="outlined"
              sx={{
                bgcolor: CARD_BG,
                borderColor: CARD_BORDER,
              }}
            />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {Object.entries(labels || {}).map(([key, value]) => (
          <LabelEditor
            key={key}
            labelKey={key}
            labelValue={value}
            onUpdate={(newKey, newValue) => { handleUpdateLabel(key, newKey, newValue); }}
            onDelete={() => { handleDeleteLabel(key); }}
            disableSuggestions
          />
        ))}
      </Box>
    </Box>
  );
}

const SPECIAL_LABELS: Record<string, string[]> = {
  'eda.nokia.com/role': ['leaf', 'spine', 'borderleaf', 'superspine'],
  'eda.nokia.com/security-profile': ['managed'],
};

export function LabelEditor({
  labelKey,
  labelValue,
  onUpdate,
  onDelete,
  disableSuggestions = false,
}: {
  labelKey: string;
  labelValue: string;
  onUpdate: (key: string, value: string) => void;
  onDelete: () => void;
  disableSuggestions?: boolean;
}) {
  const [localKey, setLocalKey] = useState(labelKey);
  const [localValue, setLocalValue] = useState(labelValue);

  useEffect(() => {
    setLocalKey(labelKey);
    setLocalValue(labelValue);
  }, [labelKey, labelValue]);

  const isSpecialLabel = !disableSuggestions && labelKey in SPECIAL_LABELS;
  const enumOptions = SPECIAL_LABELS[labelKey];

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '65fr 35fr auto', gap: '0.5rem', alignItems: 'center' }}>
      <TextField
        size="small"
        label="Key"
        value={localKey}
        onChange={e => { setLocalKey(e.target.value); }}
        onBlur={() => { onUpdate(localKey, localValue); }}
        fullWidth
        disabled={isSpecialLabel}
      />
      {isSpecialLabel ? (
        <Autocomplete
          freeSolo
          size="small"
          options={enumOptions}
          value={localValue}
          onInputChange={(_, value) => { setLocalValue(value); }}
          onBlur={() => { onUpdate(localKey, localValue); }}
          fullWidth
          renderInput={params => <TextField {...params} label="Value" />}
        />
      ) : (
        <TextField
          size="small"
          label="Value"
          value={localValue}
          onChange={e => { setLocalValue(e.target.value); }}
          onBlur={() => { onUpdate(localKey, localValue); }}
          fullWidth
        />
      )}
      <Box sx={{ width: 32, display: 'flex', justifyContent: 'center' }}>
        {!isSpecialLabel && (
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

const DEFAULT_PALETTE_COLUMNS = 8;

export function ColorField({ label, value, onChange, columns = DEFAULT_PALETTE_COLUMNS }: { label?: string; value: string; onChange: (color: string) => void; columns?: number }) {
  const colors = COLOR_PALETTE.map(p => p.stroke);
  return (
    <Box>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          {label}
        </Typography>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 0, borderRadius: 1, overflow: 'hidden' }}>
        {colors.map(color => {
          const selected = value.toLowerCase() === color.toLowerCase();
          return (
            <Box
              key={color}
              onClick={() => { onChange(color); }}
              sx={{
                aspectRatio: '1',
                backgroundColor: color,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected && <CheckIcon sx={{ width: '70%', height: '70%', color: isLightColor(color) ? 'black' : 'white' }} />}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
