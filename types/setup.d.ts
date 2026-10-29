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
  /** @deprecated Use the default key file persistence instead. */
  writeEnv?: boolean;
}): string;
/**
 * Re-encrypts profiles and assistant history together. Stop all store users first.
 * Preserves data backups and the old key; restart with the new key after rotation.
 * Ordinary write failures roll back data; multi-file crash atomicity is not guaranteed.
 */
export function rotateEncryptionKey(options?: KeyFileOptions & { oldKey?: string; newKey?: string }): {
  ok: true;
  /** Number of re-encrypted profile secrets; excludes assistant history. */
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
