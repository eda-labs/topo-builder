import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';

import {
  availableNumericSlotOptions,
  componentCardSlotOptions,
  componentCpmSlotOptions,
  componentTypeOptions,
  cpmOptions,
  defaultComponentsForEntry,
  defaultSfmForEntry,
  deploymentMode,
  deploymentModeLabel,
  directMdaOptions,
  directMdaSlotOptions,
  getEntry,
  isCpmSlot,
  platformOfEntry,
  schemaNumericSlotOptions,
  sfmOptions,
  srosWizardEntries,
  wizardComponents,
  xiomMdaOptions,
  xiomMdaSlotOptions,
  xiomOptions,
  type MatrixEntry,
  type SrsimComponent,
  type SrsimMda,
  type SrsimXiom,
} from '../lib/sros';
import { frontPanelMetaOf, paintPanel, panelDims, resolveFrontPanel } from '../lib/frontpanel';
import type { Component } from '../types/schema';

import { FavoriteToggle } from './PlatformDetailsPopover';

const NESTED_SLOT_COUNT = 2;
const FIELD_FONT = { fontSize: 12 } as const;
const MENU_PROPS = { slotProps: { paper: { sx: { maxHeight: 320 } } } } as const;

export interface SrosWizardResult {
  platform: string;
  components: Component[];
  label: string;
}

function withoutEmptyNested(component: SrsimComponent): SrsimComponent {
  return {
    ...component,
    mda: component.mda?.length ? component.mda : undefined,
    xiom: component.xiom?.length ? component.xiom : undefined,
  };
}

function TypeSelect({ label, value, options, onChange, testId }: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  testId?: string;
}) {
  // Keep a stale selection visible while options catch up so the Select never warns.
  const values = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <TextField
      select
      size="small"
      fullWidth
      label={label}
      value={value}
      data-testid={testId}
      onChange={e => { onChange(e.target.value); }}
      slotProps={{ input: { sx: FIELD_FONT }, select: { MenuProps: MENU_PROPS } }}
    >
      {values.map(option => (
        <MenuItem key={option} value={option} sx={FIELD_FONT}>{option}</MenuItem>
      ))}
    </TextField>
  );
}

function SlotSelect({ value, options, onChange }: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const values = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <TextField
      select
      size="small"
      label="Slot"
      value={value}
      onChange={e => { onChange(e.target.value); }}
      sx={{ width: 76, flexShrink: 0 }}
      slotProps={{ input: { sx: FIELD_FONT }, select: { MenuProps: MENU_PROPS } }}
    >
      {values.map(option => (
        <MenuItem key={option} value={option} sx={FIELD_FONT}>{option}</MenuItem>
      ))}
    </TextField>
  );
}

function RemoveButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <Tooltip title={title}>
      <IconButton size="small" onClick={onClick} sx={{ flexShrink: 0 }}>
        <DeleteIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}

function AddRowButton({ label, disabled, onClick, testId }: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <Button size="small" startIcon={<AddIcon />} disabled={disabled} onClick={onClick} data-testid={testId} sx={{ alignSelf: 'flex-start' }}>
      {label}
    </Button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.5 }}>
      {children}
    </Typography>
  );
}

function FaceplatePreview({ stencil }: { stencil: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const meta = frontPanelMetaOf(stencil);
  const width = 480;
  const dims = meta ? panelDims(meta) : null;
  const height = dims ? Math.max(10, Math.round((width * dims.h) / dims.w)) : 0;
  useLayoutEffect(() => {
    if (ref.current && meta) {
      paintPanel(ref.current, meta, { width, height, freeFill: '#222B37', freeLine: '#394455' });
    }
  }, [meta, width, height]);
  if (!meta?.layout.length) return null;
  return (
    <Box sx={{ bgcolor: '#000', borderRadius: 1, p: 1, lineHeight: 0, alignSelf: 'flex-start' }}>
      <canvas ref={ref} aria-hidden style={{ display: 'block' }} />
    </Box>
  );
}

export default function SrosWizardDialog({ open, onClose, onAdd }: {
  open: boolean;
  onClose: () => void;
  onAdd: (result: SrosWizardResult) => void;
}) {
  // The dialog is mounted on demand, so lazy initialisers run when it opens.
  const entries = useMemo(() => srosWizardEntries(), []);

  const [chassis, setChassis] = useState('sr-1');
  const [sfm, setSfm] = useState(() => defaultSfmForEntry(getEntry(entries, 'sr-1')));
  const [components, setComponentsState] = useState<SrsimComponent[]>(
    () => defaultComponentsForEntry(getEntry(entries, 'sr-1')),
  );
  const [includeConnectors, setIncludeConnectors] = useState(false);

  const entry = useMemo(() => getEntry(entries, chassis), [entries, chassis]);
  const mode = deploymentMode(entry);
  const distributed = mode === 'distributed';

  const applyChassis = (nextChassis: string, nextEntry: MatrixEntry | undefined) => {
    setChassis(nextChassis);
    setComponentsState(defaultComponentsForEntry(nextEntry));
    setSfm(defaultSfmForEntry(nextEntry));
  };

  // ---- normalisation: after any edit, drop selections the matrix no longer supports ----

  const normalizeComponent = (component: SrsimComponent, currentSfm: string): SrsimComponent => {
    if (distributed && isCpmSlot(component.slot)) {
      const options = cpmOptions(entry, currentSfm);
      return {
        slot: component.slot,
        type: component.type && options.includes(component.type) ? component.type : (options[0] ?? ''),
      };
    }

    const typeOptions = distributed
      ? componentTypeOptions(entry, { slot: component.slot }, currentSfm)
      : cpmOptions(entry, currentSfm);
    const type = component.type && typeOptions.includes(component.type)
      ? component.type
      : (typeOptions[0] ?? (distributed ? '' : component.type ?? ''));
    const next: SrsimComponent = { slot: component.slot, type };
    const base = { slot: component.slot, type };

    const directOptions = directMdaOptions(entry, base, currentSfm);
    const directMdas = (component.mda ?? []).filter(mda => mda.type && directOptions.includes(mda.type));
    if (directMdas.length) next.mda = directMdas;

    const validXioms = (component.xiom ?? []).flatMap(xiom => {
      const options = xiomOptions(entry, base, currentSfm);
      if (!xiom.type || !options.includes(xiom.type)) return [];
      const xiomBase = { slot: xiom.slot, type: xiom.type };
      const mdaOptions = xiomMdaOptions(entry, base, xiomBase, currentSfm);
      const mdas = (xiom.mda ?? []).filter(mda => mda.type && mdaOptions.includes(mda.type));
      return [withoutEmptyNested({ ...xiom, mda: mdas })];
    });
    if (validXioms.length) next.xiom = validXioms;

    return withoutEmptyNested(next);
  };

  const normalizeComponents = (list: SrsimComponent[], currentSfm: string) =>
    list
      .map(component => normalizeComponent(component, currentSfm))
      .filter(item => item.mda?.length || item.xiom?.length || item.type);

  const setComponents = (list: SrsimComponent[]) => {
    let nextSfm = sfm;
    let clean = normalizeComponents(list, nextSfm);
    const compatible = sfmOptions(entry, clean);
    if (compatible.length && !compatible.includes(nextSfm)) {
      const preferred = defaultSfmForEntry(entry);
      nextSfm = compatible.includes(preferred) ? preferred : compatible[0];
      clean = normalizeComponents(list, nextSfm);
    }
    setSfm(nextSfm);
    setComponentsState(clean);
  };

  const applySfm = (value: string) => {
    setSfm(value);
    setComponentsState(normalizeComponents(components, value));
  };

  // ---- derived views ----

  const indexed = components.map((component, index) => ({ component, index }));
  const cpms = indexed.filter(({ component }) => isCpmSlot(component.slot));
  const cards = indexed.filter(({ component }) => !isCpmSlot(component.slot));
  const cpmSlotOptions = componentCpmSlotOptions(entry);
  const cardSlotOptions = componentCardSlotOptions(entry, cards.map(({ component }) => component));
  const usedCpmSlots = new Set(cpms.map(({ component }) => String(component.slot ?? '').toUpperCase()));
  const availableCpmSlots = cpmSlotOptions.filter(slot => !usedCpmSlots.has(slot));
  const usedCardSlots = new Set(cards.map(({ component }) => String(component.slot ?? '')));
  const availableCardSlots = cardSlotOptions.filter(slot => !usedCardSlots.has(String(slot)));
  const sharedSfmOptions = sfmOptions(entry, components);
  const integratedComponent: SrsimComponent = components[0] ?? { slot: 'A', mda: [] };
  const xiomSlotOptions = schemaNumericSlotOptions([], NESTED_SLOT_COUNT);

  const platform = entry ? platformOfEntry(entry) : '';
  const edaComponents = useMemo(
    () => (entry ? wizardComponents(entry, sfm, components, { connectors: includeConnectors }) : []),
    [entry, sfm, components, includeConnectors],
  );
  const stencil = useMemo(
    () => resolveFrontPanel(platform, edaComponents),
    [platform, edaComponents],
  );
  const cardTypes = edaComponents
    .filter(c => c.kind === 'mda' || c.kind === 'lineCard' || c.kind === 'controlCard')
    .map(c => c.type);
  const favoriteLabel = [platform, ...cardTypes.slice(0, 3)].join(' · ');
  const canAdd = Boolean(platform && edaComponents.length);

  // ---- edit helpers ----

  const updateComponent = (index: number, updates: Partial<SrsimComponent>) => {
    const next = [...components];
    next[index] = withoutEmptyNested({ ...next[index], ...updates });
    setComponents(next);
  };

  const directMdaSlotsFor = (component: SrsimComponent, mdaType = '') =>
    directMdaSlotOptions(entry, component, sfm, NESTED_SLOT_COUNT, 1, mdaType);

  const xiomMdaSlotsFor = (component: SrsimComponent, xiom: SrsimXiom, mdaType = '') =>
    xiomMdaSlotOptions(entry, component, xiom, sfm, NESTED_SLOT_COUNT, 1, mdaType);

  const nextDirectMdaFor = (component: SrsimComponent): SrsimMda | null => {
    const mdas = component.mda ?? [];
    for (const type of directMdaOptions(entry, component, sfm)) {
      const slot = availableNumericSlotOptions(directMdaSlotsFor(component, type), mdas)[0];
      if (slot) return { slot, type };
    }
    return null;
  };

  const nextXiomMdaFor = (component: SrsimComponent, xiom: SrsimXiom): SrsimMda | null => {
    const mdas = xiom.mda ?? [];
    for (const type of xiomMdaOptions(entry, component, xiom, sfm)) {
      const slot = availableNumericSlotOptions(xiomMdaSlotsFor(component, xiom, type), mdas)[0];
      if (slot) return { slot, type };
    }
    return null;
  };

  const addCpm = () => {
    const slot = availableCpmSlots[0];
    if (!slot) return;
    setComponents([...components, { slot, type: cpmOptions(entry, sfm)[0] ?? '' }]);
  };

  const addCard = () => {
    const slot = availableCardSlots[0];
    if (!slot) return;
    setComponents([...components, { slot, type: componentTypeOptions(entry, { slot }, sfm)[0] ?? '' }]);
  };

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ platform, components: edaComponents, label: favoriteLabel });
  };

  // ---- nested editors ----

  const renderMdaRows = (
    component: SrsimComponent,
    mdas: SrsimMda[],
    slotsFor: (mdaType: string) => number[],
    typeOptions: string[],
    onUpdate: (mdaIndex: number, updates: Partial<SrsimMda>) => void,
    onRemove: (mdaIndex: number) => void,
  ) => mdas.map((mda, mdaIndex) => (
    <Box key={mdaIndex} sx={{ display: 'flex', gap: 1, alignItems: 'center', pl: 2 }}>
      <SlotSelect
        value={String(mda.slot ?? '')}
        options={slotsFor(mda.type ?? '').map(String)}
        onChange={slot => { onUpdate(mdaIndex, { slot: Number(slot) }); }}
      />
      <TypeSelect
        label="MDA"
        value={mda.type ?? ''}
        options={typeOptions}
        onChange={type => { onUpdate(mdaIndex, { type }); }}
      />
      <RemoveButton title="Remove MDA" onClick={() => { onRemove(mdaIndex); }} />
    </Box>
  ));

  const renderCardEditor = ({ component, index }: { component: SrsimComponent; index: number }) => {
    const cardXiomOptions = xiomOptions(entry, component, sfm);
    const mdas = component.mda ?? [];
    const xioms = component.xiom ?? [];
    return (
      <Box key={index} sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <SlotSelect
            value={String(component.slot ?? '')}
            options={cardSlotOptions.map(String)}
            onChange={slot => { updateComponent(index, { slot: Number(slot) }); }}
          />
          <TypeSelect
            label="Line card"
            value={component.type ?? ''}
            options={componentTypeOptions(entry, { slot: component.slot }, sfm)}
            onChange={type => { updateComponent(index, { type }); }}
            testId={`sros-wizard-card-type-${index}`}
          />
          <RemoveButton title="Remove card" onClick={() => { setComponents(components.filter((_, i) => i !== index)); }} />
        </Box>

        {renderMdaRows(
          component,
          mdas,
          mdaType => availableNumericSlotOptions(directMdaSlotsFor(component, mdaType), mdas.filter(m => m.type !== mdaType)),
          directMdaOptions(entry, component, sfm),
          (mdaIndex, updates) => {
            const next = [...mdas];
            next[mdaIndex] = { ...next[mdaIndex], ...updates };
            updateComponent(index, { mda: next });
          },
          mdaIndex => { updateComponent(index, { mda: mdas.filter((_, i) => i !== mdaIndex) }); },
        )}
        <AddRowButton
          label="Add MDA"
          disabled={!nextDirectMdaFor(component)}
          onClick={() => {
            const nextMda = nextDirectMdaFor(component);
            if (nextMda) updateComponent(index, { mda: [...mdas, nextMda] });
          }}
        />

        {xioms.map((xiom, xiomIndex) => {
          const xiomMdas = xiom.mda ?? [];
          return (
            <Box key={xiomIndex} sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <SlotSelect
                  value={String(xiom.slot ?? '')}
                  options={xiomSlotOptions.map(String)}
                  onChange={slot => {
                    const next = [...xioms];
                    next[xiomIndex] = { ...next[xiomIndex], slot: Number(slot) };
                    updateComponent(index, { xiom: next });
                  }}
                />
                <TypeSelect
                  label="XIOM"
                  value={xiom.type ?? ''}
                  options={cardXiomOptions}
                  onChange={type => {
                    const next = [...xioms];
                    next[xiomIndex] = { ...next[xiomIndex], type };
                    updateComponent(index, { xiom: next });
                  }}
                />
                <RemoveButton title="Remove XIOM" onClick={() => { updateComponent(index, { xiom: xioms.filter((_, i) => i !== xiomIndex) }); }} />
              </Box>
              {renderMdaRows(
                component,
                xiomMdas,
                mdaType => availableNumericSlotOptions(xiomMdaSlotsFor(component, xiom, mdaType), xiomMdas.filter(m => m.type !== mdaType)),
                xiomMdaOptions(entry, component, xiom, sfm),
                (mdaIndex, updates) => {
                  const nextMdas = [...xiomMdas];
                  nextMdas[mdaIndex] = { ...nextMdas[mdaIndex], ...updates };
                  const next = [...xioms];
                  next[xiomIndex] = { ...next[xiomIndex], mda: nextMdas };
                  updateComponent(index, { xiom: next });
                },
                mdaIndex => {
                  const next = [...xioms];
                  next[xiomIndex] = { ...next[xiomIndex], mda: xiomMdas.filter((_, i) => i !== mdaIndex) };
                  updateComponent(index, { xiom: next });
                },
              )}
              <AddRowButton
                label="Add XIOM MDA"
                disabled={!nextXiomMdaFor(component, xiom)}
                onClick={() => {
                  const nextMda = nextXiomMdaFor(component, xiom);
                  if (!nextMda) return;
                  const next = [...xioms];
                  next[xiomIndex] = { ...next[xiomIndex], mda: [...xiomMdas, nextMda] };
                  updateComponent(index, { xiom: next });
                }}
              />
            </Box>
          );
        })}
        {cardXiomOptions.length > 0 && (
          <AddRowButton
            label="Add XIOM"
            disabled={availableNumericSlotOptions(xiomSlotOptions, xioms).length === 0}
            onClick={() => {
              const slot = availableNumericSlotOptions(xiomSlotOptions, xioms)[0];
              if (!slot) return;
              updateComponent(index, { xiom: [...xioms, { slot, type: cardXiomOptions[0] ?? '', mda: [] }] });
            }}
          />
        )}
      </Box>
    );
  };

  const integratedMdas = integratedComponent.mda ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="sros-wizard">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <Typography component="span" sx={{ fontWeight: 700, flex: 1 }}>
          SR OS chassis wizard
        </Typography>
        {canAdd && (
          <FavoriteToggle label={favoriteLabel} platform={platform} components={edaComponents} testId="sros-wizard-favorite" />
        )}
        <IconButton size="small" onClick={onClose} aria-label="Close wizard">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
          <Autocomplete
            size="small"
            fullWidth
            disableClearable
            options={entries}
            value={entry}
            getOptionLabel={option => platformOfEntry(option)}
            isOptionEqualToValue={(a, b) => a.chassis === b.chassis}
            onChange={(_, next) => { applyChassis(next.chassis, next); }}
            renderInput={params => <TextField {...params} label="Chassis" data-testid="sros-wizard-chassis" />}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.chassis} sx={{ display: 'flex', gap: 1 }}>
                <Typography variant="body2" sx={{ flex: 1 }}>{platformOfEntry(option)}</Typography>
                <Chip size="small" label={deploymentModeLabel(option)} sx={{ height: 16, fontSize: 9 }} />
              </Box>
            )}
          />
          <Tooltip title="Reset to the default layout">
            <IconButton size="small" onClick={() => { applyChassis(chassis, entry); }}>
              <ResetIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {distributed && sharedSfmOptions.length > 0 && (
          <TypeSelect label="Switch fabric (SFM)" value={sfm} options={sharedSfmOptions} onChange={applySfm} testId="sros-wizard-sfm" />
        )}

        {distributed ? (
          <>
            <SectionLabel>CONTROL MODULES</SectionLabel>
            {cpms.map(({ component, index }) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <SlotSelect
                  value={String(component.slot ?? '').toUpperCase()}
                  options={cpmSlotOptions}
                  onChange={slot => { updateComponent(index, { slot }); }}
                />
                <TypeSelect
                  label="CPM"
                  value={component.type ?? ''}
                  options={cpmOptions(entry, sfm)}
                  onChange={type => { updateComponent(index, { type }); }}
                />
                <RemoveButton title="Remove CPM" onClick={() => { setComponents(components.filter((_, i) => i !== index)); }} />
              </Box>
            ))}
            <AddRowButton label="Add CPM" disabled={!availableCpmSlots.length} onClick={addCpm} testId="sros-wizard-add-cpm" />

            <SectionLabel>LINE CARDS</SectionLabel>
            {cards.map(renderCardEditor)}
            <AddRowButton label="Add line card" disabled={!availableCardSlots.length} onClick={addCard} testId="sros-wizard-add-card" />
          </>
        ) : (
          <>
            <TypeSelect
              label="Card"
              value={integratedComponent.type ?? ''}
              options={cpmOptions(entry, sfm)}
              onChange={type => {
                setComponents([withoutEmptyNested({ ...integratedComponent, type })]);
              }}
              testId="sros-wizard-integrated-type"
            />
            <SectionLabel>MDAS</SectionLabel>
            {renderMdaRows(
              integratedComponent,
              integratedMdas,
              mdaType => availableNumericSlotOptions(directMdaSlotsFor(integratedComponent, mdaType), integratedMdas.filter(m => m.type !== mdaType)),
              directMdaOptions(entry, integratedComponent, sfm),
              (mdaIndex, updates) => {
                const next = [...integratedMdas];
                next[mdaIndex] = { ...next[mdaIndex], ...updates };
                setComponents([withoutEmptyNested({ ...integratedComponent, mda: next })]);
              },
              mdaIndex => {
                setComponents([withoutEmptyNested({ ...integratedComponent, mda: integratedMdas.filter((_, i) => i !== mdaIndex) })]);
              },
            )}
            <AddRowButton
              label="Add MDA"
              disabled={!nextDirectMdaFor(integratedComponent)}
              onClick={() => {
                const nextMda = nextDirectMdaFor(integratedComponent);
                if (nextMda) setComponents([withoutEmptyNested({ ...integratedComponent, mda: [...integratedMdas, nextMda] })]);
              }}
              testId="sros-wizard-add-mda"
            />
          </>
        )}

        {stencil && <FaceplatePreview stencil={stencil} />}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }} data-testid="sros-wizard-summary">
          {edaComponents.filter(c => c.kind !== 'connector').map(c => (
            <Chip key={`${c.kind}-${c.slot ?? ''}`} size="small" label={`${c.kind} ${c.slot ?? ''} · ${c.type}`} sx={{ height: 18, fontSize: 10 }} />
          ))}
          {includeConnectors && (
            <Chip size="small" label={`${edaComponents.filter(c => c.kind === 'connector').length} connectors`} sx={{ height: 18, fontSize: 10 }} variant="outlined" />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <FormControlLabel
          control={(
            <Checkbox
              size="small"
              checked={includeConnectors}
              onChange={e => { setIncludeConnectors(e.target.checked); }}
            />
          )}
          label={<Typography variant="caption">Include default connectors</Typography>}
          sx={{ mr: 'auto' }}
        />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={<AddIcon />} disabled={!canAdd} onClick={handleAdd} data-testid="sros-wizard-add">
          Add to canvas
        </Button>
      </DialogActions>
    </Dialog>
  );
}
