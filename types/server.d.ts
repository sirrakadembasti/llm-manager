/** Structural Node HTTP server lifecycle, without requiring Node ambient typings. */
export interface HttpServer {
  close(callback?: (error?: Error) => void): this;
  address(): { address: string; family: string; port: number } | string | null;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  listening: boolean;
  closeAllConnections(): void;
  closeIdleConnections(): void;
}
import type { LoggerInput } from './core.js';

export interface StandaloneServerOptions {
  host?: string;
  port?: number;
  adminUser?: string;
  adminPassword?: string;
  allowedOrigins?: string | string[];
  dataDir?: string;
  chatTokens?: string | string[];
  logger?: LoggerInput | null;
  /** Own this standalone process: SIGINT/SIGTERM close, exit 0, or exit 1 after 10s. Default false. */
  handleSignals?: boolean;
}

export interface StandaloneServerInstance {
  app: any;
  server: HttpServer;
  url: string;
  port: number;
  close(): Promise<void>;
}

export function createStandaloneServer(options?: StandaloneServerOptions): Promise<StandaloneServerInstance>;
