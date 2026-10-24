import type {
  LLMManager,
  LLMManagerOptions,
  LLMStore,
  LLMProfilePublic,
  LLMProfileInternal,
  LLMMessage,
  LLMErrorCode,
  StructuredLogger
} from './core.js';

export * from './core.js';

export interface BasicAuthOptions {
  user?: string;
  password?: string;
  rateLimit?: boolean;
}

export function createBasicAuth(options?: BasicAuthOptions): (req: any, res: any, next: (err?: any) => void) => void;

export interface MountOptions extends LLMManagerOptions {
  adminUser?: string;
  adminPassword?: string;
  requireAuth?: (req: any, res: any, next: (err?: any) => void) => void;
  apiPath?: string;
  pagePath?: string;
  requireCsrf?: boolean;
  chatAccess?: 'authenticated' | 'admin' | false;
  chatOverrides?: 'admin' | 'all' | 'none';
  allowLocalHttp?: boolean;
}

export function mountLLMManagement(app: any, options?: MountOptions): void;

/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export function runInteractiveInit(...args: unknown[]): Promise<unknown>;
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export function probeAndOpenBrowser(...args: unknown[]): Promise<unknown>;
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export function initLLMProject(...args: unknown[]): Promise<unknown>;
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export function verifyIntegration(...args: unknown[]): Promise<unknown>;
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export function injectIntoEntryFile(...args: unknown[]): Promise<unknown>;
