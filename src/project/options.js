import path from 'node:path';

export function projectOptionsFromEnv(env = process.env) {
  const root = env.LLM_PROJECT_ROOT?.trim();
  if (!root) return false;
  return {
    root: path.resolve(root),
    ...(env.LLM_OPENCODE_PATH ? { opencodePath: env.LLM_OPENCODE_PATH } : {}),
    ...(env.LLM_GRAPHIFY_PYTHON ? { graphifyPython: env.LLM_GRAPHIFY_PYTHON } : {})
  };
}
