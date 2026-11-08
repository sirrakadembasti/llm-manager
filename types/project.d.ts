/** Yerleşik kaynak analizi; proje kökü ve OpenCode yalnız sunucuda yapılandırılır. */
export interface ProjectOptions {
  root: string;
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  /** Server-only exact relative paths; cannot override privacy/file-access filters. */
  documentRoles?: Record<string, ProjectSourceRole>;
  /** Optional target analysis; runs only with an explicit Graphify scan request. */
  graphify?: false | { command: string; args?: string[] };
  graphifyPython?: string;
  graphifyAutoDetect?: boolean;
  opencodePath?: string;
  opencode?: { command: string; args?: string[] };
  commands?: Record<string, { command: string; args?: string[]; timeoutMs?: number }>;
}

export interface ProjectSource {
  path: string;
  startLine: number;
  endLine: number;
  role?: ProjectSourceRole;
}

export type ProjectSourceRole = 'canonical' | 'manifest' | 'code' | 'test' | 'historical' | 'plan';

export type ProjectRetrievalMode = 'basic' | 'graphify';
export interface ProjectGraphEvidence {
  fromPath: string;
  fromLine: number;
  toPath: string;
  toLine: number;
  kind: string;
  confidence: string;
}
export interface ProjectRetrievalTrace {
  requestedMode: ProjectRetrievalMode;
  effectiveMode: ProjectRetrievalMode;
  reason:
    'basic-selected' | 'graph-ready' | 'graph-unavailable' | 'graph-stale' | 'graph-disabled' | 'no-graph-contribution';
  sourceRevision: string;
  graphRevision: string | null;
  graphReady: boolean;
  /** Whether Graphify added source files or cited relation evidence at the same total budget. */
  graphContributed: boolean;
  /** At most 100 relative source paths; source text and tool commands are never stored here. */
  graphAddedFiles: string[];
  /** At most 20 source-referenced static relations; absent in older records. */
  graphEvidence?: ProjectGraphEvidence[];
}

export interface ProjectInventory {
  name: string;
  revision: string;
  scannedAt: string;
  fileCount: number;
  documentCount: number;
  bytes: number;
  excluded: number;
  exclusions?: Array<{ path: string; reason: ProjectExclusionReason }>;
  exclusionCounts?: Partial<Record<ProjectExclusionReason, number>>;
  exclusionsTruncated?: boolean;
  partial: boolean;
  /** Sayı/toplam boyut sınırı kaynak atladı; true iken plan/değişiklik görevi hazırlanmaz. */
  limited?: boolean;
  gitAware: boolean;
  files: Array<{ path: string; hash: string; bytes: number }>;
}

export type ProjectExclusionReason =
  | 'secret'
  | 'private-path'
  | 'directory'
  | 'unsafe-path'
  | 'unsupported-type'
  | 'ignored'
  | 'symlink'
  | 'binary'
  | 'encoding'
  | 'file-size'
  | 'total-size'
  | 'file-count'
  | 'scan-limit'
  | 'unreadable';

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
  retrieval?: ProjectRetrievalTrace;
  graphUsed?: boolean;
}
