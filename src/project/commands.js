import { runProjectProcess } from './process.js';
import { hasProjectSecret, projectError } from './policy.js';

export async function runProjectCommand({ workspace, definition, approved, signal }) {
  if (approved !== true)
    throw projectError('PROJECT_APPROVAL_REQUIRED', 'Komutun geçici çalışma kopyasında çalıştırılmasını onaylayın.');
  if (
    !definition ||
    typeof definition.command !== 'string' ||
    (definition.args && (!Array.isArray(definition.args) || definition.args.some(v => typeof v !== 'string')))
  ) {
    throw projectError('PROJECT_COMMAND_INVALID', 'Host tarafından tanımlanmış bir doğrulama komutu seçin.');
  }
  const started = Date.now();
  const result = await runProjectProcess({
    ...definition,
    timeoutMs: Math.max(100, Math.min(300000, definition.timeoutMs || 60000)),
    cwd: workspace.root,
    env: workspace.env,
    signal,
    maxOutputBytes: 256 * 1024
  });
  const redacted = hasProjectSecret(result.output);
  return {
    exitCode: result.code,
    passed: result.code === 0 && !result.signal,
    durationMs: Date.now() - started,
    redacted,
    output: redacted ? 'Çıktı sır içerebileceği için gösterilmedi.' : result.output.slice(0, 64000),
    truncated: result.output.length > 64000
  };
}
