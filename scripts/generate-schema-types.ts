import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { compile, type JSONSchema } from 'json-schema-to-typescript';

const STATIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/static');
const SCHEMA_FILE = 'schema.json';

interface TopologySchema {
  properties?: { spec?: JSONSchema };
}

async function generate(schemaPath: string) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as TopologySchema;
  const spec = schema.properties?.spec;
  if (!spec) return;

  spec.title = 'TopologySpec';
  const output = await compile(spec, 'TopologySpec', {
    bannerComment: '/* eslint-disable */\n// Auto-generated from schema.json - do not edit',
    additionalProperties: false,
  });

  fs.writeFileSync(schemaPath.replace(SCHEMA_FILE, 'spec.ts'), output);
}

const schemas = [
  path.join(STATIC_DIR, SCHEMA_FILE),
  ...fs.readdirSync(STATIC_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('v'))
    .map(e => path.join(STATIC_DIR, e.name, SCHEMA_FILE))
    .filter(fs.existsSync),
];

Promise.all(schemas.map(generate)).catch(console.error);
