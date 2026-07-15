/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __RELEASE_DATE__: string;

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_APP_TITLE?: string;
    readonly NODE_ENV?: string;
    readonly DEV?: boolean;
    readonly PROD?: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
