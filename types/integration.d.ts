import type { MountOptions, MountedLLMManager } from './index.js';

export interface IntegrationOptions extends MountOptions {
  /** Host project root containing .env; generated helpers set this explicitly. */
  cwd?: string;
  /** Public URL prefix, e.g. /stok. Host/proxy must preserve or restore it before dispatch. */
  basePath?: string;
  /** Host mode requires an explicit authorization adapter; never falls back to Basic auth. */
  authMode?: 'basic' | 'host';
  /** Exact role names authorized by the host adapter, or req.user.isAdmin === true. Default ['admin']. */
  adminRoles?: string[];
}
export interface IntegratedLLMManager extends MountedLLMManager {
  pagePath: string;
  apiPath: string;
  authMode: 'basic' | 'host';
}
/** Register before catch-all routes. Reserves /llm, /llm1, ... against previously registered routes. */
export function mountLLMIntegration(app: any, options?: IntegrationOptions): IntegratedLLMManager;
