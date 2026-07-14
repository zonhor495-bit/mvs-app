/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_APP_TITLE?: string;
    readonly VITE_GOOGLE_CLIENT_ID?: string;
    readonly NODE_ENV?: string;
    readonly DEV?: boolean;
    readonly PROD?: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
