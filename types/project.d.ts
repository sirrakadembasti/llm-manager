/** Proje erişimi yalnız sunucu tarafından yapılandırılır; tarayıcı kaynak kökünü değiştiremez. */
export interface ProjectOptions {
  root: string;
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  graphifyPython?: string;
  /** Host PATH üzerindeki Graphify CLI otomatik keşfi; varsayılan true. */
  graphifyAutoDetect?: boolean;
  graphify?: { command: string; args?: string[] };
  opencodePath?: string;
  opencode?: { command: string; args?: string[] };
  commands?: Record<string, { command: string; args?: string[]; timeoutMs?: number }>;
}

export interface ProjectSource {
  path: string;
  startLine: number;
  endLine: number;
}

export interface ProjectInventory {
  name: string;
  revision: string;
  scannedAt: string;
  fileCount: number;
  documentCount: number;
  bytes: number;
  excluded: number;
  partial: boolean;
  gitAware: boolean;
  files: Array<{ path: string; hash: string; bytes: number }>;
}

export interface ProjectCommandResult {
  name: string;
  exitCode: number | null;
  passed: boolean;
  durationMs: number;
  output: string;
  sourceChanged?: boolean;
}

export interface ProjectTask {
  id: string;
  revision: string;
  mode: 'plan' | 'change';
  state: 'proposed' | 'planned' | 'applied' | 'reverted';
  createdAt: string;
  content: string;
  engineVersion: string;
  profile: { id: string; name: string; provider: string; model: string };
  files: Array<{ path: string; kind: 'create' | 'update' | 'delete'; before: string | null; after: string | null }>;
  commandResult: ProjectCommandResult | null;
}
