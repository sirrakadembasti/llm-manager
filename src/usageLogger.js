import fs from 'node:fs';
import path from 'node:path';

export function createUsageTracker({ dataDir = 'data', enabled = false } = {}) {
  const isEnabled = enabled === true || process.env.LLM_USAGE_LOG === 'true';

  function getLogFilePath(monthString) {
    const month = monthString || new Date().toISOString().slice(0, 7);
    return path.join(dataDir, `usage-${month}.jsonl`);
  }

  function record({ profileId, model, durationMs, inputTokens = 0, outputTokens = 0, code = 'OK' } = {}) {
    if (!isEnabled) return;
    try {
      const now = new Date();
      const month = now.toISOString().slice(0, 7);
      const filePath = getLogFilePath(month);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });

      const entry = {
        at: now.toISOString(),
        profileId: profileId || 'unknown',
        model: model || 'unknown',
        durationMs: Math.max(0, Math.round(durationMs || 0)),
        inputTokens: Math.max(0, Math.round(Number(inputTokens) || 0)),
        outputTokens: Math.max(0, Math.round(Number(outputTokens) || 0)),
        code: String(code || 'OK')
      };

      fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
    } catch {
      // Disk yazma hatası kullanıcı isteğini etkilememeli
    }
  }

  function getSummary(monthString) {
    const month = monthString || new Date().toISOString().slice(0, 7);
    const filePath = getLogFilePath(month);

    const summary = {
      month,
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      byProfile: {}
    };

    if (!fs.existsSync(filePath)) {
      return summary;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        try {
          const item = JSON.parse(line);
          summary.totalRequests++;
          const inTokens = Math.max(0, Math.round(Number(item.inputTokens) || 0));
          const outTokens = Math.max(0, Math.round(Number(item.outputTokens) || 0));
          summary.totalInputTokens += inTokens;
          summary.totalOutputTokens += outTokens;
          summary.totalTokens += inTokens + outTokens;

          const pid = item.profileId || 'unknown';
          if (!summary.byProfile[pid]) {
            summary.byProfile[pid] = {
              requests: 0,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              errors: 0
            };
          }
          const prof = summary.byProfile[pid];
          prof.requests++;
          prof.inputTokens += inTokens;
          prof.outputTokens += outTokens;
          prof.totalTokens += inTokens + outTokens;
          if (item.code && item.code !== 'OK' && item.code !== '200') {
            prof.errors++;
          }
        } catch {
          // Bozuk satırı atla
        }
      }
    } catch {
      // Okuma hatasında boş özete geri dön
    }

    return summary;
  }

  return {
    enabled: isEnabled,
    record,
    getSummary
  };
}
