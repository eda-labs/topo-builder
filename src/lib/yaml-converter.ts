/**
 * YAML Converter - Pure functions for converting between YAML and UI types
 *
 * This module provides bidirectional conversion:
 * - yamlToUI(): Parse YAML string → UI state
 * - exportToYaml(): UI state → YAML string
 */

export type { ParsedEndpoint } from './yaml-converter/shared';
export {
  resetIdCounters,
  setIdCounters,
  getIdCounters,
  filterUserLabels,
  extractPosition,
  parseYamlEndpoint,
} from './yaml-converter/shared';

export type { YamlToUIOptions, YamlToUIResult } from './yaml-converter/yamlToUi';
export { yamlToUI } from './yaml-converter/yamlToUi';

export type { UIToYamlOptions } from './yaml-converter/uiToYaml';
export {
  exportToYaml,
  normalizeNodeCoordinates,
  buildCrd,
  downloadYaml,
} from './yaml-converter/uiToYaml';
