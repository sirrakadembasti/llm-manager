import path from 'node:path';

export function projectOptionsFromEnv(env = process.env, cwd = process.cwd()) {
  const root = env.LLM_PROJECT_ROOT?.trim();
  if (!root) return false;
  return {
    root: path.resolve(cwd, root),
    ...(env.LLM_GRAPHIFY_PYTHON ? { graphifyPython: path.resolve(cwd, env.LLM_GRAPHIFY_PYTHON) } : {}),
    ...(env.LLM_OPENCODE_PATH ? { opencodePath: env.LLM_OPENCODE_PATH } : {})
  };
}
