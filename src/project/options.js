import path from 'node:path';

export function projectOptionsFromEnv(env = process.env, cwd = process.cwd()) {
  const root = env.LLM_PROJECT_ROOT?.trim();
  if (!root) return false;
  return {
    root: path.resolve(cwd, root),
    ...(env.LLM_GRAPHIFY_PYTHON ? { graphifyPython: path.resolve(cwd, env.LLM_GRAPHIFY_PYTHON) } : {}),
    ...(env.LLM_OPENCODE_PATH ? { opencodePath: env.LLM_OPENCODE_PATH } : {}),
    ...msOption('graphifyTimeoutMs', env.LLM_GRAPHIFY_TIMEOUT_MS),
    ...msOption('opencodeTimeoutMs', env.LLM_OPENCODE_TIMEOUT_MS)
  };
}

// 1 sn – 1 saat arası tam sayı milisaniye; geçersiz değer varsayılanı bozmaz.
function msOption(name, raw) {
  const value = Number(raw);
  return /^\d+$/.test(String(raw ?? '').trim()) && value >= 1000 && value <= 3600000 ? { [name]: value } : {};
}
