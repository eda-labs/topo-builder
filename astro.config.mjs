// @ts-check
import { defineConfig } from 'astro/config';
import { execSync } from 'child_process';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const getGitCommitSha = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
};

// https://astro.build/config
export default defineConfig({
  site: 'https://topobuilder.x.eda.dev',
  base: '/',
  integrations: [react()],
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    define: {
      __COMMIT_SHA__: JSON.stringify(getGitCommitSha()),
    },
  }
});