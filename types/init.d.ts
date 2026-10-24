export function detectProjectType(cwd?: string): string;
export function detectEntryFile(cwd?: string, type?: string): string | null;

export interface InjectOptions {
  cwd?: string;
  entryFile?: string;
  type?: string;
  dryRun?: boolean;
}

export interface InjectResult {
  modified: boolean;
  backupPath?: string;
  entryFile: string;
  diff?: string;
}

export function injectIntoEntryFile(options?: InjectOptions): InjectResult;

export interface InitProjectOptions {
  cwd?: string;
  type?: string;
  dataDir?: string;
  adminPassword?: string;
  force?: boolean;
}

export function initLLMProject(options?: InitProjectOptions): {
  type: string;
  scaffoldedFiles: string[];
};

export function verifyIntegration(options?: { cwd?: string; type?: string; entryFile?: string }): {
  ok: boolean;
  checks: Array<{ name: string; pass: boolean; message?: string }>;
};

export function formatVerificationReport(report: unknown): string;

export function probeAndOpenBrowser(options?: { port?: number; dataDir?: string; open?: boolean }): Promise<void>;

export function runInteractiveInit(options?: { cwd?: string; yes?: boolean; open?: boolean }): Promise<void>;
