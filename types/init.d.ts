import type { HttpServer } from './server.js';
export type ProjectType =
  | 'express'
  | 'spa'
  | 'nextjs'
  | 'nuxt'
  | 'sveltekit'
  | 'electron'
  | 'dotnet'
  | 'python'
  | 'tauri'
  | 'fastify'
  | 'koa'
  | 'hono'
  | 'nestjs'
  | 'unknown';
export function detectProjectType(cwd?: string): ProjectType;
export function detectEntryFile(cwd?: string, type?: ProjectType): string | null;
export interface ChangeJournal {
  capture(file: string): void;
  write(file: string, content: string | Uint8Array): void;
  rollback(): void;
}
export function createChangeJournal(cwd?: string): ChangeJournal;
export interface InjectOptions {
  cwd?: string;
  entryFile?: string | null;
  type?: ProjectType;
  esm?: boolean;
  journal?: ChangeJournal;
}
export interface InjectResult {
  modified: boolean;
  alreadyIntegrated?: boolean;
  reason?: string;
  entryFile: string | null;
  addedLines: string[];
  diffPreview: string;
  rollback(): void;
}
export function injectIntoEntryFile(options?: InjectOptions): InjectResult;
export interface InitProjectOptions {
  cwd?: string;
  type?: ProjectType;
  password?: string;
  force?: boolean;
  journal?: ChangeJournal;
}
export interface InitProjectResult {
  type: ProjectType;
  esm: boolean;
  createdFiles: string[];
  scriptAdded: boolean;
  journal: ChangeJournal;
  targetFramework?: string;
}
export function initLLMProject(options?: InitProjectOptions): InitProjectResult;
export interface VerificationReport {
  ok: boolean;
  type: ProjectType;
  entryFile: string | null;
  warnings: string[];
  checks: Array<{ id: string; title: string; ok: boolean; error?: string; solution?: string; skipped?: boolean }>;
}
export interface VerifyOptions {
  cwd?: string;
  type?: ProjectType;
  entryFile?: string | null;
}
export function verifyIntegration(options?: VerifyOptions): VerificationReport;
export function formatVerificationReport(report: VerificationReport | null | undefined): string;
export interface ProbeOptions {
  cwd?: string;
  port?: number;
  password?: string;
  startServerIfNeeded?: boolean;
  openBrowser?: boolean;
  autoCloseStartedServer?: boolean;
  browserOpener?: (url: string) => unknown | Promise<unknown>;
}
export interface ProbeResult {
  ok: boolean;
  url: string;
  status: number;
  startedServer: boolean;
  openedBrowser: boolean;
  server?: HttpServer;
}
export function probeAndOpenBrowser(options?: ProbeOptions): Promise<ProbeResult>;
export interface InteractiveInitOptions extends InitProjectOptions {
  port?: number;
  yes?: boolean;
  openBrowser?: boolean;
  autoCloseServer?: boolean;
  askQuestion?: (prompt: string) => string | Promise<string>;
  logger?: (message: string) => void;
  browserOpener?: ProbeOptions['browserOpener'];
}
export type InteractiveInitResult =
  | { aborted: true; step: 'detect' }
  | { aborted: true; rolledBack: true; step: 'inject' }
  | { ok: false; step: 'verify'; verification: VerificationReport; rolledBack: boolean }
  | {
      ok: boolean;
      type: ProjectType;
      entryFile: string | null;
      initRes: InitProjectResult;
      injectRes: InjectResult;
      verification: VerificationReport;
      probe: ProbeResult;
    };
export function runInteractiveInit(options?: InteractiveInitOptions): Promise<InteractiveInitResult>;
