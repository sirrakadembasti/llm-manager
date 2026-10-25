export interface KeyFileOptions {
  dataDir?: string;
  filePath?: string;
  keyPath?: string;
}
export function ensureLLMEncryptionKey(options?: {
  envPath?: string;
  profilePath?: string;
  environment?: Record<string, string | undefined>;
  keyPath?: string;
  writeEnv?: boolean;
}): string;
export function rotateEncryptionKey(options?: KeyFileOptions & { oldKey?: string; newKey?: string }): {
  ok: true;
  count: number;
  newKey: string;
  backupKeyPath: string | null;
};
export function exportProfiles(
  options?: KeyFileOptions & { encryptionKey?: string; password?: string; outputPath?: string }
): {
  ok: true;
  profileCount: number;
  outputPath: string;
};
export function importProfiles(
  options?: KeyFileOptions & { encryptionKey?: string; password?: string; inputPath?: string; replace?: boolean }
): {
  ok: true;
  importedCount: number;
  totalCount: number;
};
