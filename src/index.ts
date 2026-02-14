/* eslint-disable import-x/max-dependencies */
import './styles.css';

export { default as TopologyEditor, type TopologyEditorProps } from './components/TopologyEditor';
export {
  default as AppLayout,
  createTopologyTheme,
  defaultTopologyThemeOptions,
  type TopologyThemingProps,
} from './components/AppLayout';
export { default as ContextMenu } from './components/ContextMenu';
export {
  default as YamlEditor,
  getEditorContent,
  jumpToNodeInEditor,
  jumpToLinkInEditor,
  jumpToSimNodeInEditor,
  jumpToMemberLinkInEditor,
} from './components/YamlEditor';

export {
  SelectionPanel,
  NodeTemplatesPanel,
  LinkTemplatesPanel,
  SimNodeTemplatesPanel,
} from './components/PropertiesPanel';

export * from './components/nodes';
export * from './components/edges';
export * from './components/edges/cards';
export * from './components/panels';

export { useCopyPaste } from './hooks/useCopyPaste';

export * from './lib/store';
export * from './lib/yaml-converter';
export * from './lib/constants';
export * from './lib/testIds';
export { validateNetworkTopology } from './lib/validate';

export type * from './types/ui';
export type {
  Operation,
  LinkType,
  LinkSpeed,
  EncapType,
  SimNodeType,
  NodeTemplate,
  LinkTemplate,
  SimNodeTemplate,
  TopoNode as SchemaTopoNode,
  SimNode as SchemaSimNode,
  EndpointLocal,
  EndpointRemote,
  EndpointSim,
  Endpoint,
  Link,
  Simulation,
  TopologyMetadata,
  TopologySpec,
  Topology,
  ParsedTopology,
} from './types/schema';
