import type { Server } from 'node:http';

export interface StandaloneServerOptions {
  host?: string;
  port?: number;
  adminUser?: string;
  adminPassword?: string;
  allowedOrigins?: string[];
  dataDir?: string;
  chatTokens?: string[];
  logger?: any;
}

export interface StandaloneServerInstance {
  app: any;
  server: Server;
  url: string;
  close(): Promise<void>;
}

export function createStandaloneServer(options?: StandaloneServerOptions): Promise<StandaloneServerInstance>;
