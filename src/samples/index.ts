/**
 * Bundled example topologies (one per namespace) — the Nokia validated designs for data
 * center networks (github.com/nokia/nokia-validated-designs): the 3-stage EVPN/VXLAN fabric,
 * the collapsed-spine design and the two-stripe rail-optimized AI cluster, with node,
 * interface and server-homing wiring taken from the published clab topologies/EDA manifests.
 */
import threeStageYaml from './nvd-3stage.yaml?raw';
import collapsedSpineYaml from './nvd-collapsed-spine.yaml?raw';
import aiClusterYaml from './nvd-ai-cluster.yaml?raw';

export interface ExampleTopology {
  id: string;
  title: string;
  namespace: string;
  description: string;
  yaml: string;
}

export const exampleTopologies: readonly ExampleTopology[] = [
  {
    id: 'nvd-3stage',
    title: '3-stage EVPN/VXLAN',
    namespace: 'eda',
    description: 'Nokia validated design · 2 spines × 6 leaves · single/dual/quad-homed servers (ESI-LAG)',
    yaml: threeStageYaml,
  },
  {
    id: 'nvd-collapsed-spine',
    title: 'Collapsed spine',
    namespace: 'collapsed',
    description: 'Nokia validated design · 2 collapsed spines · 3 ToRs · hosts on spines and ToRs',
    yaml: collapsedSpineYaml,
  },
  {
    id: 'nvd-ai-cluster',
    title: 'AI cluster (rail-optimized)',
    namespace: 'ai-dc',
    description: 'Nokia validated design · two-stripe backend (H4/H5) · frontend + storage fabric · GPU rails',
    yaml: aiClusterYaml,
  },
];
