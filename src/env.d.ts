/// <reference types="astro/client" />

declare const __COMMIT_SHA__: string | undefined;
declare const __APP_MODE__: 'standalone' | 'package' | undefined;

declare module '*.svg?raw' {
  const content: string;
  export default content;
}

declare module '*.yaml?raw' {
  const content: string;
  export default content;
}
