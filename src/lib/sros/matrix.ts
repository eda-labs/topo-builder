/**
 * SR OS hardware matrix — constraint propagation for the chassis wizard.
 *
 * Ported from srsim-hw-schema's `matrix.ts` (trimmed to what the wizard needs). Every option
 * function intersects the per-chassis matrix rows with the current selections so dropdowns only
 * ever offer combinations the SR OS appendix tables document as supported.
 */
import type {
  HardwareModelEntry,
  HardwareSchema,
  MatrixEntry,
  MatrixRow,
  RawHardwareRecord,
  SrsimComponent,
  SrsimMda,
  SrsimXiom,
} from './types';

const hardwareFields = new Set(['card', 'sfm', 'xiom', 'mda']);
const integratedChassis = new Set(['sr-1', 'sr-1s', 'ixr-r6', 'ixr-ec', 'ixr-e2', 'ixr-e2c']);
const redundantIntegratedChassis = new Set(['ixr-r6']);
const mdaSlotRestrictions = new Map<string, number[]>([
  ['ixr-r4:m20-1g-csfp', [1, 2, 3]],
  ['ixr-r4:m10-1g-sfp+2-10g-sfp+', [5]],
  ['ixr-r6:a32-chds1v2', [5, 6]],
  ['ixr-r6:m20-1g-csfp', [3, 4]],
]);

export type DeploymentMode = 'standalone' | 'integrated_redundant' | 'distributed';

// Matrix cell values are strings or numbers from JSON; anything else is treated as empty.
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function cleanText(value: unknown): string {
  return asText(value)
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function canonicalToken(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function isEmptyValue(value: unknown): boolean {
  const text = cleanText(value);
  return text === '' || text === '-' || text === '--' || text === 'N/A' || text === 'n/a';
}

export function uniqueSorted(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = cleanText(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result.sort((a, b) => {
    const aNum = /^\d+$/.test(a);
    const bNum = /^\d+$/.test(b);
    if (aNum && bNum) return Number(a) - Number(b);
    if (aNum !== bNum) return aNum ? -1 : 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function splitValues(value: unknown): string[] {
  const text = cleanText(value);
  if (isEmptyValue(text)) return [];

  const parts: string[] = [];
  for (const line of text.split('\n')) {
    for (const part of line.split(/\s+\bor\b\s+/i)) {
      const cleaned = cleanText(part);
      if (cleaned && !isEmptyValue(cleaned) && cleaned.toLowerCase() !== 'or') {
        parts.push(cleaned);
      }
    }
  }
  return uniqueSorted(parts.length ? parts : [text]);
}

export function clabChassisToken(value: unknown): string {
  return cleanText(value)
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/^(?:7250|7450|7705|7750|7950)\s+/i, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function normalizedRecordValues(field: string, value: unknown): string[] {
  const values = splitValues(value);
  if (field === 'chassis') {
    return uniqueSorted(values.map(clabChassisToken));
  }
  if (hardwareFields.has(field) || field.startsWith('mda_')) {
    return uniqueSorted(values.map(item => cleanText(item).toLowerCase()));
  }
  return uniqueSorted(values);
}

function aliasesFromEntry(model: string, entry: HardwareModelEntry): string[] {
  let aliases: string[] = [];
  for (const value of entry.supported_values?.chassis ?? []) {
    aliases = aliases.concat(normalizedRecordValues('chassis', value));
  }
  if (aliases.length) return uniqueSorted(aliases);

  for (const source of ['default_layout', 'supported_hardware'] as const) {
    for (const record of entry[source] ?? []) {
      if (record.chassis) {
        aliases = aliases.concat(normalizedRecordValues('chassis', record.chassis));
      }
    }
  }
  return aliases.length ? uniqueSorted(aliases) : uniqueSorted([clabChassisToken(model)]);
}

function normalizedRow(record: RawHardwareRecord): Record<string, string[]> {
  const row: Record<string, string[]> = {};
  for (const field of Object.keys(record).sort()) {
    const values = normalizedRecordValues(field, record[field]);
    if (values.length) row[field] = values;
  }
  return row;
}

function rowText(row: MatrixRow): string {
  const parts = [row.model, row.source];
  for (const field of ['slot', 'card', 'sfm', 'xiom', 'mda', 'memory']) {
    parts.push(...(row.values[field] ?? []));
  }
  return parts.join(' ').toLowerCase();
}

export function buildMatrix(data: HardwareSchema): MatrixEntry[] {
  const built = new Map<string, MatrixEntry & { seenRows: Set<string> }>();

  const ensureEntry = (chassis: string): MatrixEntry & { seenRows: Set<string> } => {
    const existing = built.get(chassis);
    if (existing) return existing;
    const next = { chassis, models: [], rows: [], seenRows: new Set<string>() };
    built.set(chassis, next);
    return next;
  };

  for (const [model, entry] of Object.entries(data.models).sort()) {
    const aliases = aliasesFromEntry(model, entry);
    for (const alias of aliases) {
      const target = ensureEntry(alias);
      target.models = uniqueSorted([...target.models, model]);
    }

    for (const source of ['default_layout', 'supported_hardware'] as const) {
      for (const record of entry[source] ?? []) {
        const values = normalizedRow(record);
        const rowAliases = values.chassis?.length ? values.chassis : aliases;
        for (const alias of rowAliases) {
          const target = ensureEntry(alias);
          target.models = uniqueSorted([...target.models, model]);
          const row = { model, source, values };
          const key = JSON.stringify(row);
          if (!target.seenRows.has(key)) {
            target.seenRows.add(key);
            target.rows.push(row);
          }
        }
      }
    }
  }

  return [...built.values()]
    .map(({ seenRows: _seenRows, ...entry }) => ({
      ...entry,
      rows: [...entry.rows].sort((a, b) =>
        rowText(a).localeCompare(rowText(b), undefined, { numeric: true, sensitivity: 'base' })),
    }))
    .sort((a, b) =>
      a.chassis.localeCompare(b.chassis, undefined, { numeric: true, sensitivity: 'base' }));
}

function cardLooksCpm(card: unknown): boolean {
  const value = asText(card);
  return value.startsWith('cpm') || value.startsWith('cpiom');
}

function rowHasAlphaSlot(row: MatrixRow): boolean {
  return (row.values.slot ?? []).some(slot => /^[AB]$/i.test(slot));
}

function rowHasNumericSlot(row: MatrixRow): boolean {
  return (row.values.slot ?? []).some(slot => /^\d+$/.test(slot));
}

function rowHasPayload(row: MatrixRow): boolean {
  return Boolean(rowMdaValues(row).length || (row.values.xiom ?? []).length);
}

function rowCpmCards(row: MatrixRow, entry?: MatrixEntry): string[] {
  const mode = deploymentMode(entry);
  const values: string[] = [];
  for (const card of row.values.card ?? []) {
    const splitForRoles = splitCardParts(card) !== null;
    if (mode === 'standalone' || mode === 'integrated_redundant') {
      values.push(roleCardValue(card, 'cpm'));
    } else if (rowHasAlphaSlot(row) || splitForRoles || (cardLooksCpm(card) && !rowHasPayload(row))) {
      values.push(roleCardValue(card, 'cpm'));
    }
  }
  return uniqueSorted(values);
}

function rowLineCards(row: MatrixRow, entry?: MatrixEntry): string[] {
  const mode = deploymentMode(entry);
  if (mode === 'standalone' || mode === 'integrated_redundant') return [];

  const values: string[] = [];
  for (const card of row.values.card ?? []) {
    if (rowHasNumericSlot(row) || rowHasPayload(row) || !cardLooksCpm(card)) {
      values.push(roleCardValue(card, 'line'));
    }
  }
  return uniqueSorted(values);
}

function firstNumericSlot(row: MatrixRow | undefined): string {
  return row?.values.slot?.find(slot => /^\d+$/.test(slot)) ?? '';
}

function firstAlphaSlot(row: MatrixRow | undefined): string {
  return row?.values.slot?.find(slot => /^[AB]$/i.test(slot)) ?? '';
}

function firstValue(row: MatrixRow | undefined, field: string): string {
  return row?.values[field]?.[0] ?? '';
}

export function getEntry(matrix: MatrixEntry[], chassis: string): MatrixEntry | undefined {
  return matrix.find(entry => entry.chassis === chassis) ?? matrix[0];
}

function entrySlots(entry: MatrixEntry | undefined): string[] {
  return uniqueSorted(
    (entry?.rows ?? [])
      .filter(row => row.source === 'default_layout')
      .flatMap(row => row.values.slot ?? []),
  );
}

export function deploymentMode(entry: MatrixEntry | undefined): DeploymentMode {
  const chassis = entry?.chassis ?? '';
  if (redundantIntegratedChassis.has(chassis)) return 'integrated_redundant';
  const slots = entrySlots(entry);
  const hasAlphaSlot = slots.some(slot => /^[A-Z]$/i.test(slot));
  const hasNumericSlot = slots.some(slot => /^\d+$/.test(slot));
  if (integratedChassis.has(chassis) || (hasAlphaSlot && !hasNumericSlot)) return 'standalone';
  return 'distributed';
}

function splitCardParts(card: string): [string, string] | null {
  const index = card.indexOf('/');
  if (index === -1) return null;
  const cpm = card.slice(0, index);
  const lineCard = card.slice(index + 1);
  return cardLooksCpm(cpm) && lineCard ? [cpm, lineCard] : null;
}

function roleCardValue(card: string, role: 'cpm' | 'line'): string {
  const parts = splitCardParts(card);
  if (parts) {
    return role === 'cpm' ? parts[0] : parts[1];
  }
  return card;
}

function mdaFields(row: MatrixRow): string[] {
  return Object.keys(row.values).filter(field => field === 'mda' || field.startsWith('mda_'));
}

function rowMdaValues(row: MatrixRow): string[] {
  return uniqueSorted(mdaFields(row).flatMap(field => row.values[field] ?? []));
}

function rowNumberedMdaSlots(row: MatrixRow, mdaType = ''): number[] {
  const wantedType = canonicalToken(mdaType);
  return uniqueNumbers(
    mdaFields(row)
      .filter(field => field.startsWith('mda_'))
      .filter(field => !wantedType || (row.values[field] ?? []).some(type => canonicalToken(type) === wantedType))
      .map(field => field.slice(4)),
  );
}

function directMdasFromRow(row: MatrixRow): SrsimMda[] {
  const mdas: SrsimMda[] = [];
  const fields = mdaFields(row);
  const numberedFields = fields.filter(field => field.startsWith('mda_'));
  for (const field of numberedFields.length ? numberedFields : fields) {
    const slot = field.startsWith('mda_') ? Number(field.slice(4)) : 1;
    for (const type of row.values[field] ?? []) {
      mdas.push({ slot, type });
    }
  }
  return mdas;
}

function componentMdasFromRow(row: MatrixRow): SrsimMda[] {
  const numberedFields = mdaFields(row).filter(field => field.startsWith('mda_'));
  if (numberedFields.length) return directMdasFromRow(row);

  const type = firstValue(row, 'mda');
  return type ? [{ slot: 1, type }] : [];
}

function rowMatchesComponent(
  row: MatrixRow,
  entry: MatrixEntry | undefined,
  component: SrsimComponent,
  sfm: string,
  omitField?: 'card' | 'sfm' | 'xiom' | 'mda',
): boolean {
  if (sfm && omitField !== 'sfm' && (row.values.sfm ?? []).length && !row.values.sfm.includes(sfm)) {
    return false;
  }
  const cardValues = isCpmSlot(component.slot) ? rowCpmCards(row, entry) : rowLineCards(row, entry);
  if (component.type && omitField !== 'card' && !cardValues.includes(component.type)) {
    return false;
  }
  const selectedXiom = component.xiom?.find(xiom => xiom.type)?.type ?? '';
  if (selectedXiom && omitField !== 'xiom' && !(row.values.xiom ?? []).includes(selectedXiom)) {
    return false;
  }
  const selectedMda = component.mda?.find(mda => mda.type)?.type
    ?? component.xiom?.flatMap(xiom => xiom.mda ?? []).find(mda => mda.type)?.type
    ?? '';
  if (selectedMda && omitField !== 'mda' && !rowMdaValues(row).includes(selectedMda)) {
    return false;
  }
  return true;
}

function optionRows(
  entry: MatrixEntry | undefined,
  component: SrsimComponent,
  sfm: string,
  omitField: 'card' | 'sfm' | 'xiom' | 'mda',
): MatrixRow[] {
  return (entry?.rows ?? []).filter(row => rowMatchesComponent(row, entry, component, sfm, omitField));
}

export function cpmOptions(entry: MatrixEntry | undefined, sfm: string): string[] {
  const values: string[] = [];
  for (const row of entry?.rows ?? []) {
    if (sfm && (row.values.sfm ?? []).length && !row.values.sfm.includes(sfm)) continue;
    values.push(...rowCpmCards(row, entry));
  }
  return uniqueSorted(values);
}

export function componentTypeOptions(entry: MatrixEntry | undefined, component: SrsimComponent, sfm: string): string[] {
  const values: string[] = [];
  for (const row of optionRows(entry, component, sfm, 'card')) {
    values.push(...rowLineCards(row, entry));
  }
  return uniqueSorted(values);
}

export function sfmOptions(entry: MatrixEntry | undefined, components: SrsimComponent[]): string[] {
  const selectedComponents = components.filter(component => component.type);
  if (!selectedComponents.length) {
    return uniqueSorted((entry?.rows ?? []).flatMap(row => row.values.sfm ?? []));
  }

  let intersection: string[] | null = null;
  for (const component of selectedComponents) {
    const values = uniqueSorted(
      (entry?.rows ?? [])
        .filter(row => rowMatchesComponent(row, entry, component, '', 'sfm'))
        .flatMap(row => row.values.sfm ?? []),
    );
    if (!values.length) continue;
    intersection = intersection === null ? values : intersection.filter(value => values.includes(value));
  }
  return uniqueSorted(intersection ?? []);
}

export function xiomOptions(entry: MatrixEntry | undefined, component: SrsimComponent, sfm: string): string[] {
  const base = { slot: component.slot, type: component.type };
  return uniqueSorted(optionRows(entry, base, sfm, 'xiom').flatMap(row => row.values.xiom ?? []));
}

export function directMdaOptions(entry: MatrixEntry | undefined, component: SrsimComponent, sfm: string): string[] {
  const base = { slot: component.slot, type: component.type };
  return uniqueSorted(
    optionRows(entry, base, sfm, 'mda')
      .filter(row => !(row.values.xiom ?? []).length)
      .flatMap(rowMdaValues),
  );
}

export function xiomMdaOptions(
  entry: MatrixEntry | undefined,
  component: SrsimComponent,
  xiom: SrsimXiom,
  sfm: string,
): string[] {
  const base = {
    slot: component.slot,
    type: component.type,
    xiom: xiom.type ? [{ slot: xiom.slot, type: xiom.type }] : [],
  };
  return uniqueSorted(
    optionRows(entry, base, sfm, 'mda')
      .filter(row => (row.values.xiom ?? []).length)
      .flatMap(rowMdaValues),
  );
}

function restrictedMdaSlots(chassis: string | undefined, mdaType: string): number[] {
  return mdaSlotRestrictions.get(`${clabChassisToken(chassis)}:${canonicalToken(mdaType)}`) ?? [];
}

function mdaSlotOptionsFromRows(
  entry: MatrixEntry | undefined,
  rows: MatrixRow[],
  fallbackSlotCount: number,
  minimumSlot: number,
  mdaType = '',
): number[] {
  const restrictedSlots = uniqueNumbers(
    (mdaType ? [mdaType] : uniqueSorted(rows.flatMap(rowMdaValues)))
      .flatMap(type => restrictedMdaSlots(entry?.chassis, type)),
  ).filter(slot => slot >= minimumSlot);
  if (mdaType && restrictedSlots.length) return restrictedSlots;

  const numberedSlots = uniqueNumbers(rows.flatMap(row => rowNumberedMdaSlots(row, mdaType)))
    .filter(slot => slot >= minimumSlot);
  if (numberedSlots.length) return numberedSlots;

  const fallbackSlots = numberRange(fallbackSlotCount, minimumSlot);
  return restrictedSlots.length ? uniqueNumbers([...fallbackSlots, ...restrictedSlots]) : fallbackSlots;
}

export function directMdaSlotOptions(
  entry: MatrixEntry | undefined,
  component: SrsimComponent,
  sfm: string,
  fallbackSlotCount = 2,
  minimumSlot = 1,
  mdaType = '',
): number[] {
  const base = { slot: component.slot, type: component.type };
  const rows = optionRows(entry, base, sfm, 'mda').filter(row => !(row.values.xiom ?? []).length);
  return mdaSlotOptionsFromRows(entry, rows, fallbackSlotCount, minimumSlot, mdaType);
}

export function xiomMdaSlotOptions(
  entry: MatrixEntry | undefined,
  component: SrsimComponent,
  xiom: SrsimXiom,
  sfm: string,
  fallbackSlotCount = 2,
  minimumSlot = 1,
  mdaType = '',
): number[] {
  const base = {
    slot: component.slot,
    type: component.type,
    xiom: xiom.type ? [{ slot: xiom.slot, type: xiom.type }] : [],
  };
  const rows = optionRows(entry, base, sfm, 'mda').filter(row => (row.values.xiom ?? []).length);
  return mdaSlotOptionsFromRows(entry, rows, fallbackSlotCount, minimumSlot, mdaType);
}

function uniqueNumbers(values: unknown[]): number[] {
  const numbers = values
    .map(value => Number(value))
    .filter(value => Number.isInteger(value) && value > 0);
  return [...new Set(numbers)].sort((a, b) => a - b);
}

function numberRange(max: number, min = 1): number[] {
  const start = Math.max(1, min);
  const end = Math.max(start, max);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function inferredComponentSlotCount(chassis: string | undefined): number {
  const value = chassis ?? '';
  const srA = /^sr-a(\d+)$/.exec(value);
  if (srA) return Number(srA[1]);

  const modular = /^(?:ess|ixr|sr|xrs)-(\d+)(?:[a-z]*)$/.exec(value);
  if (modular) return Number(modular[1]);

  return 1;
}

function matrixCardSlotOptions(entry: MatrixEntry | undefined, minimumSlot = 1): number[] {
  const matrixSlots = uniqueNumbers((entry?.rows ?? []).flatMap(row => row.values.slot ?? []));
  const maxSlot = Math.max(inferredComponentSlotCount(entry?.chassis), ...matrixSlots, minimumSlot);
  return numberRange(maxSlot, minimumSlot);
}

export function componentCpmSlotOptions(entry: MatrixEntry | undefined): string[] {
  const slots = (entry?.rows ?? [])
    .flatMap(row => row.values.slot ?? [])
    .filter(slot => /^[AB]$/i.test(slot))
    .map(slot => slot.toUpperCase());
  return uniqueSorted([...slots, 'A', 'B']);
}

export function componentCardSlotOptions(
  entry: MatrixEntry | undefined,
  components: { slot?: string | number }[] = [],
  minimumSlot = 1,
): number[] {
  const configuredSlots = uniqueNumbers(components.map(component => component.slot));
  const maxSlot = Math.max(...matrixCardSlotOptions(entry, minimumSlot), ...configuredSlots, minimumSlot);
  return numberRange(maxSlot, minimumSlot);
}

export function schemaNumericSlotOptions(
  items: { slot?: string | number }[] = [],
  minimumVisibleSlots = 1,
  minimumSlot = 1,
): number[] {
  const configuredSlots = uniqueNumbers(items.map(item => item.slot));
  const maxSlot = Math.max(minimumVisibleSlots, ...configuredSlots, minimumSlot);
  return numberRange(maxSlot, minimumSlot);
}

export function availableNumericSlotOptions(
  slotOptions: number[],
  items: { slot?: string | number }[] = [],
): number[] {
  const used = new Set(uniqueNumbers(items.map(item => item.slot)).map(String));
  return slotOptions.filter(slot => !used.has(String(slot)));
}

export function isCpmSlot(slot: unknown): boolean {
  const value = asText(slot).trim().toUpperCase();
  return value === 'A' || value === 'B';
}

function makeXiom(slot: string | number, type: string, mdaType: string): SrsimXiom {
  return { slot, type, mda: mdaType ? [{ slot: 1, type: mdaType }] : [] };
}

export function defaultComponentsForEntry(entry: MatrixEntry | undefined): SrsimComponent[] {
  if (!entry) return [];

  const components: SrsimComponent[] = [];
  const seen = new Set<string>();
  const seenSlots = new Set<string>();
  const addComponent = (component: SrsimComponent) => {
    const key = `${component.slot ?? ''}:${component.type ?? ''}:${JSON.stringify(component.mda ?? [])}:${JSON.stringify(component.xiom ?? [])}`;
    const slotKey = String(component.slot ?? '').trim().toUpperCase();
    if ((!component.type && !component.mda?.length && !component.xiom?.length) || seen.has(key)) return;
    if (slotKey && seenSlots.has(slotKey)) return;
    seen.add(key);
    if (slotKey) seenSlots.add(slotKey);
    components.push(component);
  };

  for (const row of entry.rows.filter(candidate => candidate.source === 'default_layout')) {
    if (deploymentMode(entry) === 'standalone' || deploymentMode(entry) === 'integrated_redundant') {
      const cpmType = rowCpmCards(row, entry)[0];
      const mdas = componentMdasFromRow(row);
      addComponent({
        slot: firstAlphaSlot(row) || 'A',
        type: cpmType,
        ...(mdas.length ? { mda: mdas } : {}),
      });
      continue;
    }
    for (const type of rowCpmCards(row, entry)) {
      addComponent({ slot: firstAlphaSlot(row) || 'A', type });
    }
    for (const type of rowLineCards(row, entry)) {
      const component: SrsimComponent = {
        slot: firstNumericSlot(row) || '1',
        type,
      };
      const xiom = firstValue(row, 'xiom');
      const mdas = directMdasFromRow(row);
      if (xiom) {
        component.xiom = [makeXiom(1, xiom, mdas[0]?.type ?? '')];
      } else if (mdas.length) {
        component.mda = mdas;
      } else {
        const fixedMdas = directMdaOptions(entry, component, firstValue(row, 'sfm'));
        if (fixedMdas.length === 1) {
          component.mda = [{ slot: 1, type: fixedMdas[0] }];
        }
      }
      addComponent(component);
    }
  }

  if (components.length) return components;

  const cpm = cpmOptions(entry, '')[0];
  const card = componentTypeOptions(entry, {}, '')[0];
  return [
    ...(cpm ? [{ slot: 'A', type: cpm }] : []),
    ...(card ? [{ slot: 1, type: card }] : []),
  ];
}

export function defaultSfmForEntry(entry: MatrixEntry | undefined): string {
  const defaults = entry?.rows.filter(row => row.source === 'default_layout') ?? [];
  const sfms = uniqueSorted(defaults.flatMap(row => row.values.sfm ?? []));
  return sfms[0] ?? '';
}
