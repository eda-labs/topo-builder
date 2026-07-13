/**
 * Bundled example topologies (one per namespace) exercising the platform/connector/breakout
 * combinations: an SR Linux fabric with template breakouts, the SR OS chassis/card matrix
 * with connector components, and a mixed pod. All three validate against a live cluster
 * with `kubectl apply --dry-run=server`.
 */
import srlFabricYaml from './srl-fabric.yaml?raw';
import srosCombosYaml from './sros-combos.yaml?raw';
import mixedPodYaml from './mixed-pod.yaml?raw';

export interface ExampleTopology {
  id: string;
  title: string;
  namespace: string;
  description: string;
  yaml: string;
}

export const exampleTopologies: readonly ExampleTopology[] = [
  {
    id: 'srl-fabric',
    title: 'SR Linux fabric',
    namespace: 'eda',
    description: '3-tier fabric · 2×400G / 4×100G / 4×10G breakouts · LAG · sim nodes',
    yaml: srlFabricYaml,
  },
  {
    id: 'sros-combos',
    title: 'SR OS chassis matrix',
    namespace: 'sros',
    description: 'Every 7750 flavour · IOM/MDA/XCM cards · c1/c2/c4/c10 connectors',
    yaml: srosCombosYaml,
  },
  {
    id: 'mixed-pod',
    title: 'Mixed pod',
    namespace: '1000',
    description: 'SRL ↔ SR OS links · breakouts both sides · ESI-LAG · edge links',
    yaml: mixedPodYaml,
  },
];
