export default function express({ PKG, esm }) {
  const header = esm
    ? `import { mountLLMIntegration } from '${PKG}/integration';
import { createLLMManager } from '${PKG}/core';
import { fileURLToPath } from 'node:url';
const integrationRoot = fileURLToPath(new URL('.', import.meta.url));`
    : `const { mountLLMIntegration } = require('${PKG}/integration');
const { createLLMManager } = require('${PKG}/core');
const integrationRoot = __dirname;`;
  return {
    'llm.js': `${header}
let activeManager = null;
${esm ? 'export ' : ''}function setupLLM(app, options = {}) {
  activeManager = mountLLMIntegration(app, {
    cwd: integrationRoot,
    ...options
  });
  return activeManager;
}
${esm ? 'export ' : ''}async function askLLM(prompt, options = {}) {
  if (!activeManager) activeManager = createLLMManager({ dataDir: process.env.LLM_DATA_DIR || integrationRoot + '/data' });
  return activeManager.ask(prompt, options);
}
${esm ? '' : 'module.exports = { setupLLM, askLLM };'}
`
  };
}
