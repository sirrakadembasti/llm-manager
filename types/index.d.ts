import type { LLMManagerOptions, LLMManager, StructuredLogger } from './core.js';
import type * as Init from './init.js';
export * from './core.js';

export interface BasicAuthOptions {
  user?: string;
  password?: string;
  rateLimit?: boolean | { authFailuresPerMinute?: number };
  logger?: StructuredLogger;
}

export function createBasicAuth(options?: BasicAuthOptions): (req: any, res: any, next: (err?: any) => void) => void;

export interface MountOptions extends LLMManagerOptions {
  bodyLimit?: string | number;
  adminUser?: string;
  adminPassword?: string;
  requireAuth?: (req: any, res: any, next: (err?: any) => void) => void;
  apiPath?: string;
  pagePath?: string;
  requireCsrf?: boolean;
  chatAccess?: 'authenticated' | 'admin' | false;
  chatOverrides?: 'admin' | 'all' | 'none';
  allowLocalHttp?: boolean;
  locale?: 'tr' | 'en' | string;
  homeUrl?: string;
}

export interface MountedLLMManager {
  (...args: any[]): any;
  store: LLMManager['store'];
  ask: LLMManager['ask'];
  stream: LLMManager['stream'];
  fetch: LLMManager['fetch'];
  use(...args: any[]): unknown;
}
export function mountLLMManagement(app: any, options?: MountOptions): MountedLLMManager;

/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export function runInteractiveInit(options?: Init.InteractiveInitOptions): Promise<Init.InteractiveInitResult>;
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export function probeAndOpenBrowser(options?: Init.ProbeOptions): Promise<Init.ProbeResult>;
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export function initLLMProject(options?: Init.InitProjectOptions): Promise<Init.InitProjectResult>;
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export function verifyIntegration(options?: Init.VerifyOptions): Promise<Init.VerificationReport>;
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export function injectIntoEntryFile(options?: Init.InjectOptions): Promise<Init.InjectResult>;
