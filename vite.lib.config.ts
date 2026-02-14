import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

interface PackageJson {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const packageJsonPath = resolve(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
const externalPackages = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
]);

function isExternalDependency(id: string): boolean {
  if (id.endsWith('.css')) return false;

  for (const dependency of externalPackages) {
    if (id === dependency) return true;
    if (id.startsWith(`${dependency}/`)) return true;
  }
  return false;
}

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    lib: {
      entry: resolve(rootDir, 'src/index.ts'),
      name: 'TopoBuilder',
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'styles',
    },
    outDir: 'dist/lib',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: isExternalDependency,
    },
  },
});
