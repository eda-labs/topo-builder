/**
 * SR OS chassis wizard backend: the srsim hardware matrix scoped to the platforms this app can
 * emit, plus the translation from wizard selections to topo-builder `Component[]`.
 */
import type { Component } from '../../types/schema';
import srsimHardware from '../../generated/srsim-hardware.json';

import { buildMatrix, deploymentMode } from './matrix';
import { buildEdaTopoNodeComponents, type WizardBuildOptions } from './edaComponents';
import type { EdaYangCatalog, HardwareSchema, MatrixEntry, SrsimComponent } from './types';

export type { DeploymentMode } from './matrix';
export * from './matrix';
export type { EdaYangCatalog, MatrixEntry, SrsimComponent, SrsimMda, SrsimXiom } from './types';

const hardware = srsimHardware as unknown as HardwareSchema;

// 7250 IXR chassis exist in the SR OS tables too, but this app's 7250 catalog is SR Linux —
// offering both would produce nodes whose OS cannot be told apart. The wizard therefore covers
// the unambiguous SR OS families only.
const SROS_PLATFORM_RE = /^(?:7750|7450|7705|7950)\s/;

let cachedEntries: MatrixEntry[] | null = null;

/** Wizard-selectable chassis entries (built lazily — the matrix is only needed once opened). */
export function srosWizardEntries(): MatrixEntry[] {
  cachedEntries ??= buildMatrix(hardware)
    .filter(entry => entry.models.some(model => SROS_PLATFORM_RE.test(model)));
  return cachedEntries;
}

export function srosCatalog(): EdaYangCatalog {
  return hardware.eda ?? {};
}

/** The EDA TopoNode platform string for a chassis entry ("7750 SR-7s"). */
export function platformOfEntry(entry: MatrixEntry): string {
  return entry.models.find(model => SROS_PLATFORM_RE.test(model)) ?? entry.models[0] ?? entry.chassis;
}

export const deploymentModeLabel = (entry: MatrixEntry): string => {
  const mode = deploymentMode(entry);
  if (mode === 'distributed') return 'distributed';
  if (mode === 'integrated_redundant') return 'redundant integrated';
  return 'integrated';
};

/** Flatten wizard selections into the components a TopoNode carries. */
export function wizardComponents(
  entry: MatrixEntry,
  sfm: string,
  components: SrsimComponent[],
  options: WizardBuildOptions = {},
): Component[] {
  return buildEdaTopoNodeComponents(
    { chassis: entry.chassis, sfm, components },
    srosCatalog(),
    options,
  ).map(component => ({ kind: component.kind, slot: component.slot, type: component.type }));
}
