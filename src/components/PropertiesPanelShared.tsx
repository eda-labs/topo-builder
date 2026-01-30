import { useState, useEffect, type ReactNode } from "react";
import {
  Box,
  Typography,
  TextField,
  Autocomplete,
  Button,
  IconButton,
  Divider,
  Paper,
  Chip,
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon } from "@mui/icons-material";

// Shared template name blur handler
export function createNameBlurHandler<T extends { name: string }>(
  template: T,
  localName: string,
  setLocalName: (name: string) => void,
  onUpdate: (name: string, update: Partial<T>) => boolean | void
) {
  return () => {
    const success = onUpdate(template.name, { name: localName } as Partial<T>);
    if (!success) {
      setLocalName(template.name);
    }
  };
}

// Shared label handling utilities for template editors
export function createLabelHandlers<T extends { name: string; labels?: Record<string, string> }>(
  template: T,
  onUpdate: (name: string, update: Partial<T>) => boolean | void
) {
  const handleAddLabel = () => {
    let counter = 1;
    let newKey = `eda.nokia.com/label-${counter}`;
    while (template.labels?.[newKey]) {
      counter++;
      newKey = `eda.nokia.com/label-${counter}`;
    }
    onUpdate(template.name, {
      labels: {
        ...template.labels,
        [newKey]: "",
      },
    } as Partial<T>);
  };

  const handleUpdateLabel = (oldKey: string, newKey: string, value: string) => {
    const newLabels = { ...template.labels };
    if (oldKey !== newKey) {
      delete newLabels[oldKey];
    }
    newLabels[newKey] = value;
    onUpdate(template.name, { labels: newLabels } as Partial<T>);
  };

  const handleDeleteLabel = (key: string) => {
    const newLabels = { ...template.labels };
    delete newLabels[key];
    onUpdate(template.name, { labels: newLabels } as Partial<T>);
  };

  return { handleAddLabel, handleUpdateLabel, handleDeleteLabel };
}

export function PanelHeader({
  title,
  chip,
  actions,
}: Readonly<{
  title: string;
  chip?: ReactNode;
  actions?: ReactNode;
}>) {
  return (
    <Box sx={{ mb: "1rem" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: 32,
          mb: "0.5rem",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Typography variant="h6" fontSize={16} fontWeight={600}>
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
}: Readonly<{
  title: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <Box sx={{ mt: "1rem" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: 32,
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          {title}{count !== undefined ? ` (${count})` : ""}
        </Typography>
        {actions}
      </Box>
      <Divider sx={{ mt: "0.25rem", mb: "1rem" }} />
      {children}
    </Box>
  );
}

export function PanelCard({
  children,
  highlighted,
}: Readonly<{
  children: ReactNode;
  highlighted?: boolean;
}>) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: "0.5rem",
        bgcolor: highlighted ? "action.hover" : "var(--mui-palette-card-bg)",
        borderColor: "var(--mui-palette-card-border)",
        "&:hover": highlighted
          ? {
              borderColor: "action.disabled",
            }
          : undefined,
      }}
    >
      {children}
    </Paper>
  );
}

const TOPOBUILDER_LABEL_PREFIX = "topobuilder.eda.labs/";

function InheritedLabels({ labels }: Readonly<{ labels?: Record<string, string> }>) {
  const filteredLabels = Object.entries(labels || {}).filter(
    ([key]) => !key.startsWith(TOPOBUILDER_LABEL_PREFIX)
  );
  if (filteredLabels.length === 0) return null;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <Box sx={{ mb: "0.5rem" }}>
        <Typography variant="body2" fontWeight={600}>
          Inherited Labels
        </Typography>
        <Divider sx={{ mt: "0.25rem" }} />
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
        {filteredLabels.map(([key, value]) => (
          <Chip
            key={key}
            label={`${key}=${value}`}
            size="small"
            variant="outlined"
            sx={{
              bgcolor: "var(--mui-palette-card-bg)",
              borderColor: "var(--mui-palette-card-border)",
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

const SPECIAL_LABELS: Record<string, string[]> = {
  "eda.nokia.com/role": ["leaf", "spine", "borderleaf", "superspine"],
  "eda.nokia.com/security-profile": ["managed"],
};

// Label key/value editor component
export function LabelEditor({
  labelKey,
  labelValue,
  onUpdate,
  onDelete,
  disableSuggestions = false,
}: Readonly<{
  labelKey: string;
  labelValue: string;
  onUpdate: (key: string, value: string) => void;
  onDelete: () => void;
  disableSuggestions?: boolean;
}>) {
  const [localKey, setLocalKey] = useState(labelKey);
  const [localValue, setLocalValue] = useState(labelValue);

  useEffect(() => {
    setLocalKey(labelKey);
    setLocalValue(labelValue);
  }, [labelKey, labelValue]);

  const isSpecialLabel = !disableSuggestions && labelKey in SPECIAL_LABELS;
  const enumOptions = SPECIAL_LABELS[labelKey];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "65fr 35fr auto",
        gap: "0.5rem",
        alignItems: "center",
      }}
    >
      <TextField
        size="small"
        label="Key"
        value={localKey}
        onChange={(e) => setLocalKey(e.target.value)}
        onBlur={() => onUpdate(localKey, localValue)}
        fullWidth
        disabled={isSpecialLabel}
      />
      {isSpecialLabel ? (
        <Autocomplete
          freeSolo
          size="small"
          options={enumOptions}
          value={localValue}
          onInputChange={(_, value) => setLocalValue(value)}
          onBlur={() => onUpdate(localKey, localValue)}
          fullWidth
          renderInput={(params) => <TextField {...params} label="Value" />}
        />
      ) : (
        <TextField
          size="small"
          label="Value"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onUpdate(localKey, localValue)}
          fullWidth
        />
      )}
      <Box sx={{ width: 32, display: "flex", justifyContent: "center" }}>
        {!isSpecialLabel && (
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

export function EditableLabelsSection({
  labels,
  inheritedLabels,
  onUpdate,
}: Readonly<{
  labels?: Record<string, string>;
  inheritedLabels?: Record<string, string>;
  onUpdate: (labels: Record<string, string>) => void;
}>) {
  const handleAddLabel = () => {
    let counter = 1;
    let newKey = `eda.nokia.com/label-${counter}`;
    while (labels?.[newKey] || inheritedLabels?.[newKey]) {
      counter++;
      newKey = `eda.nokia.com/label-${counter}`;
    }
    onUpdate({ ...labels, [newKey]: "" });
  };

  const handleUpdateLabel = (oldKey: string, newKey: string, value: string) => {
    const newLabels = { ...labels };
    if (oldKey !== newKey) {
      delete newLabels[oldKey];
    }
    newLabels[newKey] = value;
    onUpdate(newLabels);
  };

  const handleDeleteLabel = (key: string) => {
    const newLabels = { ...labels };
    delete newLabels[key];
    onUpdate(newLabels);
  };

  const hasVisibleInheritedLabels = Object.keys(inheritedLabels || {}).some(
    (key) => !key.startsWith(TOPOBUILDER_LABEL_PREFIX)
  );

  return (
    <Box>
      <InheritedLabels labels={inheritedLabels} />
      <Box sx={{ mt: hasVisibleInheritedLabels ? "0.75rem" : 0 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            Labels
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={handleAddLabel}>
            Add
          </Button>
        </Box>
        <Divider sx={{ mt: "0.25rem", mb: "1rem" }} />
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {Object.entries(labels || {}).map(([key, value]) => (
          <LabelEditor
            key={key}
            labelKey={key}
            labelValue={value}
            onUpdate={(newKey, newValue) => handleUpdateLabel(key, newKey, newValue)}
            onDelete={() => handleDeleteLabel(key)}
            disableSuggestions
          />
        ))}
      </Box>
    </Box>
  );
}
