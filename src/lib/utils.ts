const NAME_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const NAME_MAX_LENGTH = 63;

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

export const validateName = (
  name: string,
  existingNames: string[],
  entityType: 'node' | 'simNode' | 'link' | 'template' = 'node'
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

export interface ParsedEndpoint {
  sourceName: string;
  targetName: string | null;
  sourceInterface: string;
  targetInterface: string | null;
}

export interface YamlEndpoint {
  local?: { node: string; interface?: string };
  remote?: { node: string; interface?: string };
  sim?: { simNode?: string; simNodeInterface?: string; node?: string; interface?: string };
  type?: string;
}

function buildLocalRemoteEndpoint(ep: YamlEndpoint, defaultInterface: string): ParsedEndpoint {
  return {
    sourceName: ep.local!.node,
    targetName: ep.remote!.node,
    sourceInterface: ep.local!.interface || defaultInterface,
    targetInterface: ep.remote!.interface || defaultInterface,
  };
}

function buildLocalSimEndpoint(ep: YamlEndpoint, defaultInterface: string, defaultSimInterface: string): ParsedEndpoint {
  const simName = ep.sim!.simNode || ep.sim!.node;
  return {
    sourceName: simName!,
    targetName: ep.local!.node,
    sourceInterface: ep.sim?.simNodeInterface || ep.sim?.interface || defaultSimInterface,
    targetInterface: ep.local!.interface || defaultInterface,
  };
}

function buildLocalOnlyEndpoint(ep: YamlEndpoint, defaultInterface: string): ParsedEndpoint {
  return {
    sourceName: ep.local!.node,
    targetName: null,
    sourceInterface: ep.local!.interface || defaultInterface,
    targetInterface: null,
  };
}

export function parseYamlEndpoint(ep: YamlEndpoint, defaultInterface: string, defaultSimInterface: string): ParsedEndpoint | null {
  if (ep.local?.node && ep.remote?.node) {
    return buildLocalRemoteEndpoint(ep, defaultInterface);
  }
  if (ep.local?.node && (ep.sim?.simNode || ep.sim?.node)) {
    return buildLocalSimEndpoint(ep, defaultInterface, defaultSimInterface);
  }
  if (ep.local?.node) {
    return buildLocalOnlyEndpoint(ep, defaultInterface);
  }
  return null;
}

export function filterUserLabels(labels?: Record<string, string>): Record<string, string> | undefined {
  if (!labels) return undefined;
  const filtered = Object.fromEntries(
    Object.entries(labels).filter(([k]) => !k.startsWith('topobuilder.eda.labs/'))
  );
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
