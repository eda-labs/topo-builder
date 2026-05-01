import schemaV26 from '../static/schema.json';
import schemaV25 from '../static/v25/schema.json';

type SchemaVersion = typeof schemaV26 | typeof schemaV25;

const schemas: Record<number, SchemaVersion> = {
  25: schemaV25,
  26: schemaV26,
};

let activeVersion = 26;

export function setActiveVersion(version: number) {
  activeVersion = version;
}

function extractEnums(schema: SchemaVersion) {
  const spec = schema.properties.spec.properties;
  return {
    operations: spec.operation.enum,
    linkTypes: spec.linkTemplates.items.properties.type.enum,
    linkSpeeds: spec.linkTemplates.items.properties.speed.enum,
    encapTypes: spec.linkTemplates.items.properties.encapType.enum,
    simNodeTypes: spec.simulation.properties.simNodeTemplates.items.properties.type.enum,
    componentKinds: ((spec.nodeTemplates.items.properties as unknown as Record<string, { items: { properties: { kind: { enum: string[] } } } }>).components ?? (spec.nodeTemplates.items.properties as unknown as Record<string, { items: { properties: { kind: { enum: string[] } } } }>).component)?.items.properties.kind.enum ?? [],
    defaultOperation: spec.operation.default ?? spec.operation.enum[0],
    defaultLinkType: spec.linkTemplates.items.properties.type.enum[0],
    edgeLinkType: spec.linkTemplates.items.properties.type.enum[1],
  };
}

const enumCache = new Map<number, ReturnType<typeof extractEnums>>();

export function getSchemaEnums(version: number = activeVersion) {
  let cached = enumCache.get(version);
  if (!cached) {
    cached = extractEnums(schemas[version] ?? schemaV26);
    enumCache.set(version, cached);
  }
  return cached;
}

export function getSchema(version: number = activeVersion): object {
  return (schemas[version] ?? schemaV26) as object;
}

export const supportedVersions = Object.keys(schemas).map(Number);

// Build cross-version mapping by index position
const migrationMap = new Map<string, Map<number, string>>();

function buildMigration(enumKey: 'operations' | 'linkTypes' | 'encapTypes') {
  const versions = supportedVersions.map(v => ({ v, values: getSchemaEnums(v)[enumKey] }));
  for (const from of versions) {
    for (const to of versions) {
      if (from.v === to.v) continue;
      for (let i = 0; i < from.values.length && i < to.values.length; i++) {
        let entry = migrationMap.get(from.values[i]);
        if (!entry) {
          entry = new Map();
          migrationMap.set(from.values[i], entry);
        }
        entry.set(to.v, to.values[i]);
      }
    }
  }
}

buildMigration('operations');
buildMigration('linkTypes');
buildMigration('encapTypes');

export function migrateValue(value: string, toVersion: number): string {
  return migrationMap.get(value)?.get(toVersion) ?? value;
}
