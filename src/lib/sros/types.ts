/**
 * SR OS hardware-catalog types, ported from the srsim-hw-schema project.
 *
 * `srsim-hardware.json` carries the SR OS appendix hardware tables (per-model default layouts
 * and supported-hardware rows) plus the EDA YANG catalog (typedefs, per-MDA connector profiles,
 * per-chassis component defaults). The matrix module folds the tables into per-chassis entries
 * that drive the wizard's constrained dropdowns.
 */

export type MatrixSource = 'default_layout' | 'supported_hardware';

export type RawHardwareRecord = Record<string, string>;

export interface HardwareModelEntry {
  default_layout?: RawHardwareRecord[];
  supported_hardware?: RawHardwareRecord[];
  supported_values?: Record<string, string[]>;
}

export interface HardwareSchema {
  $schema?: string;
  generated_at?: string;
  source?: string;
  eda?: EdaYangCatalog;
  models: Record<string, HardwareModelEntry>;
}

export interface MatrixRow {
  model: string;
  source: MatrixSource;
  values: Record<string, string[]>;
}

export interface MatrixEntry {
  chassis: string;
  models: string[];
  rows: MatrixRow[];
}

export interface SrsimMda {
  slot?: string | number;
  type?: string;
}

export interface SrsimXiom {
  slot?: string | number;
  type?: string;
  mda?: SrsimMda[];
}

export interface SrsimComponent {
  slot?: string | number;
  type?: string;
  mda?: SrsimMda[];
  xiom?: SrsimXiom[];
}

export type EdaTopoNodeComponentKind =
  | 'controlCard'
  | 'lineCard'
  | 'fabric'
  | 'mda'
  | 'connector'
  | 'xiom'
  | 'powerShelf'
  | 'powerModule';

export interface EdaTopoNodeComponent {
  kind: EdaTopoNodeComponentKind;
  slot: string;
  type: string;
}

export interface EdaConnectorDefault {
  kind: 'connector';
  count: number;
  type: string;
}

export type EdaCatalogComponentDefault = EdaTopoNodeComponent | EdaConnectorDefault;

export interface EdaTopoNodeComponentDefaults {
  components: EdaCatalogComponentDefault[];
}

export interface EdaConnectorGroup {
  count: number;
  defaultType: string;
  types: string[];
}

export interface EdaMdaConnectorProfile {
  mdaType: string;
  connectors: EdaConnectorGroup[];
}

export interface EdaYangCatalog {
  $schema?: string;
  source?: string;
  toponode_component_kinds?: EdaTopoNodeComponentKind[];
  toponode_component_defaults?: Record<string, EdaTopoNodeComponentDefaults>;
  toponode_connector_profiles?: Record<string, EdaMdaConnectorProfile>;
  typedefs?: {
    card?: string[];
    connector_breakout?: string[];
    control_card?: string[];
    fabric?: string[];
    mda?: string[];
    power_module?: string[];
    power_shelf?: string[];
    xiom?: string[];
    xiom_mda?: string[];
    [key: string]: string[] | undefined;
  };
}
