import type { UIEdge, UILagGroup, UIEsiLeaf, UIMemberLink, SelectionState } from '../types/ui';

import { NAME_MAX_LENGTH, NAME_REGEX, ESI_LAG_MIN_EDGES, ESI_LAG_MAX_EDGES } from './constants';

export const isValidName = (name: string): boolean => {
  if (!name || name.length > NAME_MAX_LENGTH) return false;
  return NAME_REGEX.test(name);
};

export const getNameError = (name: string): string | null => {
  if (!name) return 'name cannot be empty';
  if (name.length > NAME_MAX_LENGTH) return `name must be ${NAME_MAX_LENGTH} characters or less`;
  if (!/^[a-z0-9]/.test(name)) return 'name must start with a lowercase letter or number';
  if (!/[a-z0-9]$/.test(name)) return 'name must end with a lowercase letter or number';
  if (/[A-Z]/.test(name)) return 'name must be lowercase';
  if (/[^a-z0-9-]/.test(name)) return 'name can only contain lowercase letters, numbers, and hyphens';
  return null;
};

export const validateNodeName = (
  name: string,
  existingNames: string[],
): string | null => {
  const nameError = getNameError(name);
  if (nameError) return nameError;
  if (existingNames.includes(name)) {
    return `Node name "${name}" already exists`;
  }
  return null;
};

export const validateLinkName = (
  name: string,
  existingNames: string[],
): string | null => {
  const nameError = getNameError(name);
  if (nameError) return nameError;
  if (existingNames.includes(name)) {
    return `Link name "${name}" already exists`;
  }
  return null;
};

export const validateSimNodeName = (
  name: string,
  existingNames: string[],
): string | null => {
  const nameError = getNameError(name);
  if (nameError) return nameError;
  if (existingNames.includes(name)) {
    return `SimNode name "${name}" already exists`;
  }
  return null;
};

export const validateTemplateName = (
  name: string,
  existingNames: string[],
): string | null => {
  const nameError = getNameError(name);
  if (nameError) return nameError;
  if (existingNames.includes(name)) {
    return `Template name "${name}" already exists`;
  }
  return null;
};

export const validateName = (
  name: string,
  existingNames: string[],
  entityType: 'node' | 'simNode' | 'link' | 'template' = 'node',
): string | null => {
  const nameError = getNameError(name);
  if (nameError) return nameError;
  if (existingNames.includes(name)) {
    return `${entityType === 'simNode' ? 'SimNode' : entityType.charAt(0).toUpperCase() + entityType.slice(1)} name "${name}" already exists`;
  }
  return null;
};

export const generateUniqueName = (prefix: string, existingNames: string[], startCounter?: number): string => {
  let counter = startCounter ?? 1;
  let name = `${prefix}${counter}`;
  while (existingNames.includes(name)) {
    counter++;
    name = `${prefix}${counter}`;
  }
  return name;
};

export const generateCopyName = (originalName: string, existingNames: string[]): string => {
  const baseName = originalName.replace(/-copy(\d+)?$/, '');
  let newName = `${baseName}-copy`;
  let counter = 1;
  while (existingNames.includes(newName)) {
    newName = `${baseName}-copy${counter}`;
    counter++;
  }
  return newName;
};

export const formatName = (value: string): string => value.replace(/\s+/g, '-').toLowerCase();

export const ROLE_ICONS: Record<string, string> = {
  spine: 'spine',
  leaf: 'leaf',
  borderleaf: 'leaf',
  superspine: 'superspine',
};

export const getNodeRole = (
  nodeData: { role?: string; labels?: Record<string, string> },
  templateLabels?: Record<string, string>,
): string | undefined => {
  return nodeData.role
    || nodeData.labels?.['eda.nokia.com/role']
    || templateLabels?.['eda.nokia.com/role'];
};

export const extractPortNumber = (iface: string): number => {
  const ethernetMatch = iface.match(/ethernet-1-(\d+)/);
  if (ethernetMatch) return parseInt(ethernetMatch[1], 10);
  const ethMatch = iface.match(/eth(\d+)/);
  if (ethMatch) return parseInt(ethMatch[1], 10);
  return 0;
};

export const getNextPortNumber = (
  nodeId: string,
  edges: UIEdge[],
  _isSimNode: boolean = false,
): number => {
  const portNumbers = edges.flatMap(e => {
    if (e.source === nodeId) return e.data?.memberLinks?.map(ml => extractPortNumber(ml.sourceInterface)) || [];
    if (e.target === nodeId) return e.data?.memberLinks?.map(ml => extractPortNumber(ml.targetInterface)) || [];
    return [];
  });
  return Math.max(0, ...portNumbers) + 1;
};

export const generateInterfaceName = (portNumber: number, isSimNode: boolean): string => {
  return isSimNode ? `eth${portNumber}` : `ethernet-1-${portNumber}`;
};

export const incrementInterface = (iface: string, fallbackIndex: number): string => {
  const match = iface.match(/^(.+?)(\d+)$/);
  return match ? `${match[1]}${parseInt(match[2], 10) + 1}` : `${iface}-${fallbackIndex}`;
};

export const generateLagName = (
  targetNode: string,
  sourceNode: string,
  lagCount: number,
): string => {
  return `${targetNode}-${sourceNode}-lag-${lagCount}`;
};

export const generateLagId = (edgeId: string, lagCount: number): string => {
  return `lag-${edgeId}-${lagCount}`;
};

export const indicesInExistingLag = (
  indices: number[],
  lagGroups: UILagGroup[],
): boolean => {
  return lagGroups.some(lag =>
    indices.some(idx => lag.memberLinkIndices.includes(idx)),
  );
};

export const getIndicesInLags = (lagGroups: UILagGroup[]): Set<number> => {
  const indices = new Set<number>();
  for (const lag of lagGroups) {
    for (const idx of lag.memberLinkIndices) {
      indices.add(idx);
    }
  }
  return indices;
};

export const createLagGroup = (
  edgeId: string,
  lagCount: number,
  targetNode: string,
  sourceNode: string,
  memberLinkIndices: number[],
  firstMemberLink?: UIMemberLink,
): UILagGroup => {
  return {
    id: generateLagId(edgeId, lagCount),
    name: generateLagName(targetNode, sourceNode, lagCount),
    template: firstMemberLink?.template,
    memberLinkIndices,
  };
};

export const findCommonNode = (
  edgeNodes: Array<{ source: string; target: string }>,
): string | null => {
  const allNodes = edgeNodes.flatMap(e => [e.source, e.target]);
  const nodeCounts = new Map<string, number>();
  allNodes.forEach(n => nodeCounts.set(n, (nodeCounts.get(n) || 0) + 1));
  const commonNodeEntries = [...nodeCounts.entries()]
    .filter(([_, count]) => count === edgeNodes.length);
  if (commonNodeEntries.length !== 1) return null;
  return commonNodeEntries[0][0];
};

export const validateEsiLagEdges = (edgeCount: number): string | null => {
  if (edgeCount < ESI_LAG_MIN_EDGES) return `ESI-LAG requires at least ${ESI_LAG_MIN_EDGES} edges`;
  if (edgeCount > ESI_LAG_MAX_EDGES) return `ESI-LAG cannot have more than ${ESI_LAG_MAX_EDGES} edges`;
  return null;
};

export const createEsiLeaf = (
  nodeId: string,
  nodeName: string,
): UIEsiLeaf => {
  return { nodeId, nodeName };
};

export const generateEsiLagName = (commonNodeName: string, count: number): string => {
  return `${commonNodeName}-esi-lag-${count}`;
};

export const EMPTY_STRING_SET: Set<string> = new Set<string>();

export const createEmptySelectionState = (): SelectionState => ({
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  selectedEdgeIds: [],
  selectedSimNodeName: null,
  selectedSimNodeNames: new Set<string>(),
  selectedMemberLinkIndices: [],
  selectedLagId: null,
});

export const clearAllSelections = (): SelectionState => createEmptySelectionState();

export const toggleInArray = <T>(array: T[], value: T): T[] => {
  return array.includes(value)
    ? array.filter(v => v !== value)
    : [...array, value];
};

export const toggleMemberLinkIndex = (
  currentIndices: number[],
  index: number,
): number[] => {
  return currentIndices.includes(index)
    ? currentIndices.filter(i => i !== index)
    : [...currentIndices, index].sort((a, b) => a - b);
};
