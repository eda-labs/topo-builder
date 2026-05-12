import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const outputDir = resolve(rootDir, 'dist/lib');

await mkdir(outputDir, { recursive: true });
await writeFile(
  resolve(outputDir, 'styles.css.d.ts'),
  'declare const styles: string;\nexport default styles;\n',
);
