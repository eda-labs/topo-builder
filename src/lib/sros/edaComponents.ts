/**
 * SR OS wizard selections -> EDA TopoNode components.
 *
 * Ported from srsim-hw-schema's `edaComponents.ts` (EDA emission only). The nested wizard model
 * (chassis + cards with mda/xiom children) flattens into `{kind, slot, type}` components with the
 * EDA slot grammar: line card "N", direct MDA "N-a", XIOM "N-x1", XIOM MDA "N-x1-a", connector
 * "<mdaSlot>-<index>". Connector expansion follows the catalog's per-MDA connector profiles.
 */
import { clabChassisToken, isCpmSlot } from './matrix';
import type {
  EdaCatalogComponentDefault,
  EdaConnectorDefault,
  EdaConnectorGroup,
  EdaTopoNodeComponent,
  EdaTopoNodeComponentKind,
  EdaYangCatalog,
  SrsimComponent,
  SrsimMda,
  SrsimXiom,
} from './types';

const kindOrder = new Map<EdaTopoNodeComponentKind, number>([
  ['controlCard', 0],
  ['lineCard', 1],
  ['fabric', 2],
  ['xiom', 3],
  ['powerShelf', 4],
  ['powerModule', 5],
  ['mda', 6],
  ['connector', 7],
]);

function isConnectorDefault(component: EdaCatalogComponentDefault): component is EdaConnectorDefault {
  return component.kind === 'connector' && 'count' in component;
}

function edaCatalogDefaults(catalog: EdaYangCatalog, chassis: string): EdaCatalogComponentDefault[] {
  return catalog.toponode_component_defaults?.[clabChassisToken(chassis)]?.components ?? [];
}

function normalizedSlot(slot: string | number | undefined): string {
  return String(slot ?? '').trim();
}

function slotSortKey(slot: string): string {
  return slot
    .split(/(\d+)/)
    .map(part => (/^\d+$/.test(part) ? part.padStart(8, '0') : part.toLowerCase()))
    .join('');
}

function mdaSlotSuffix(slot: string | number | undefined): string {
  const text = normalizedSlot(slot);
  const number = Number(text || 1);
  if (Number.isInteger(number) && number > 0 && number <= 26) {
    return String.fromCharCode('a'.charCodeAt(0) + number - 1);
  }
  return text.toLowerCase() || 'a';
}

function numericParentSlot(slot: string | number | undefined): string {
  const text = normalizedSlot(slot);
  if (/^\d+$/.test(text)) return String(Number(text));
  if (/^[A-Z]$/i.test(text)) {
    return String(text.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0) + 1);
  }
  return text || '1';
}

function componentSort(left: SrsimComponent, right: SrsimComponent): number {
  const leftCpm = isCpmSlot(left.slot);
  const rightCpm = isCpmSlot(right.slot);
  if (leftCpm !== rightCpm) return leftCpm ? -1 : 1;
  return normalizedSlot(left.slot).localeCompare(normalizedSlot(right.slot), undefined, { numeric: true, sensitivity: 'base' });
}

export function edaComponentSort(left: EdaTopoNodeComponent, right: EdaTopoNodeComponent): number {
  const leftKind = kindOrder.get(left.kind) ?? 99;
  const rightKind = kindOrder.get(right.kind) ?? 99;
  if (leftKind !== rightKind) return leftKind - rightKind;
  const slotCompare = slotSortKey(left.slot).localeCompare(slotSortKey(right.slot));
  if (slotCompare) return slotCompare;
  return left.type.localeCompare(right.type, undefined, { numeric: true, sensitivity: 'base' });
}

function appendComponent(target: EdaTopoNodeComponent[], component: EdaTopoNodeComponent): void {
  if (!component.type || !component.slot) return;
  const key = `${component.kind}:${component.slot}`;
  if (!target.some(existing => `${existing.kind}:${existing.slot}` === key)) {
    target.push(component);
  }
}

function splitCombinedCardType(type: string): [string, string] | null {
  const index = type.indexOf('/');
  if (index === -1) return null;
  const controlCard = type.slice(0, index);
  const lineCard = type.slice(index + 1);
  return controlCard && lineCard ? [controlCard, lineCard] : null;
}

function cardTypeOptions(catalog: EdaYangCatalog, kind: 'controlCard' | 'lineCard'): string[] {
  const typedefs = catalog.typedefs ?? {};
  return (kind === 'controlCard' ? typedefs.control_card : typedefs.card) ?? [];
}

// Combined "cpm-1se/imm36-800g-qsfpdd" tokens carry both roles; pick this kind's half when the
// catalog knows it.
function edaCardType(catalog: EdaYangCatalog, kind: 'controlCard' | 'lineCard', type: string): string {
  const options = cardTypeOptions(catalog, kind);
  if (options.includes(type)) return type;
  const parts = splitCombinedCardType(type);
  if (!parts) return type;
  const candidate = kind === 'controlCard' ? parts[0] : parts[1];
  return options.includes(candidate) ? candidate : type;
}

function appendMda(target: EdaTopoNodeComponent[], parentSlot: string, mda: SrsimMda): void {
  if (!mda.type) return;
  appendComponent(target, {
    kind: 'mda',
    slot: `${parentSlot}-${mdaSlotSuffix(mda.slot)}`,
    type: mda.type,
  });
}

function appendXiom(target: EdaTopoNodeComponent[], parentSlot: string, xiom: SrsimXiom): void {
  const xiomSlot = normalizedSlot(xiom.slot) || '1';
  const edaXiomSlot = `${parentSlot}-x${xiomSlot}`;
  if (xiom.type) {
    appendComponent(target, {
      kind: 'xiom',
      slot: edaXiomSlot,
      type: xiom.type,
    });
  }
  for (const mda of xiom.mda ?? []) {
    appendMda(target, edaXiomSlot, mda);
  }
}

function configuredMdaSlots(components: EdaTopoNodeComponent[]): string[] {
  const slots = components
    .filter(component => component.kind === 'mda' && component.slot)
    .map(component => component.slot);
  return slots.length ? slots : ['1-a'];
}

function appendCatalogDefaults(
  target: EdaTopoNodeComponent[],
  catalog: EdaYangCatalog,
  chassis: string,
  connectors: boolean,
): void {
  const entries = edaCatalogDefaults(catalog, chassis);
  const mdaSlots = configuredMdaSlots(target);
  for (const entry of entries) {
    if (isConnectorDefault(entry)) {
      if (!connectors || !entry.type || !Number.isFinite(entry.count)) continue;
      for (const mdaSlot of mdaSlots) {
        for (let index = 1; index <= entry.count; index += 1) {
          appendComponent(target, { kind: 'connector', slot: `${mdaSlot}-${index}`, type: entry.type });
        }
      }
      continue;
    }
    appendComponent(target, {
      kind: entry.kind,
      slot: entry.slot,
      type: entry.type,
    });
  }
}

function edaConnectorGroupsForMda(catalog: EdaYangCatalog, mdaType: string): EdaConnectorGroup[] {
  return catalog.toponode_connector_profiles?.[mdaType.trim().toLowerCase()]?.connectors ?? [];
}

function appendGeneratedConnectors(target: EdaTopoNodeComponent[], catalog: EdaYangCatalog): void {
  const mdas = target.filter(component => component.kind === 'mda' && component.slot && component.type);
  for (const mda of mdas) {
    let connectorIndex = 1;
    for (const group of edaConnectorGroupsForMda(catalog, mda.type)) {
      const count = group.count;
      if (!Number.isInteger(count) || count <= 0) continue;
      const type = group.defaultType || group.types[0] || '';
      if (!type) continue;
      for (let index = 0; index < count; index += 1) {
        appendComponent(target, {
          kind: 'connector',
          slot: `${mda.slot}-${connectorIndex}`,
          type,
        });
        connectorIndex += 1;
      }
    }
  }
}

export interface WizardBuildInput {
  chassis: string;
  sfm: string;
  components: SrsimComponent[];
}

export interface WizardBuildOptions {
  /** emit the per-MDA default connector components (c1-…); off keeps the YAML lean */
  connectors?: boolean;
}

export function buildEdaTopoNodeComponents(
  config: WizardBuildInput,
  catalog: EdaYangCatalog,
  options: WizardBuildOptions = {},
): EdaTopoNodeComponent[] {
  const connectors = options.connectors ?? false;
  const components: EdaTopoNodeComponent[] = [];
  const numericSlots = config.components
    .map(component => normalizedSlot(component.slot))
    .filter(slot => /^\d+$/.test(slot));
  const fabricSlot = numericSlots[0] || '1';
  const includeControlCards = edaCatalogDefaults(catalog, config.chassis).length === 0;
  let wroteFabric = false;

  for (const component of [...config.components].sort(componentSort)) {
    const slot = normalizedSlot(component.slot);
    const parentSlot = numericParentSlot(component.slot);
    const cpm = isCpmSlot(component.slot);
    if (component.type && (!cpm || includeControlCards)) {
      const kind = cpm ? 'controlCard' : 'lineCard';
      appendComponent(components, {
        kind,
        slot: slot || parentSlot,
        type: edaCardType(catalog, kind, component.type),
      });
    }

    if (!cpm && config.sfm && !wroteFabric) {
      appendComponent(components, { kind: 'fabric', slot: fabricSlot, type: config.sfm });
      wroteFabric = true;
    }

    for (const xiom of component.xiom ?? []) {
      appendXiom(components, parentSlot, xiom);
    }
    for (const mda of component.mda ?? []) {
      appendMda(components, parentSlot, mda);
    }
  }

  appendCatalogDefaults(components, catalog, config.chassis, connectors);
  if (connectors) appendGeneratedConnectors(components, catalog);
  return components.sort(edaComponentSort);
}
