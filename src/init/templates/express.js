export default function express({ PKG, esm }) {
  const header = esm
    ? `import { mountLLMManagement, createLLMManager } from '${PKG}';`
    : `const { mountLLMManagement, createLLMManager } = require('${PKG}');`;
  return {
    'llm.js': `${header}
try { process.loadEnvFile?.('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
let activeManager = null;
${esm ? 'export ' : ''}function setupLLM(app, options = {}) {
  activeManager = mountLLMManagement(app, {
    dataDir: process.env.LLM_DATA_DIR || './data',
    adminPassword: process.env.LLM_ADMIN_PASSWORD,
    chatTokens: process.env.LLM_CHAT_TOKENS?.split(','),
    ...options
  });
  return activeManager;
}
${esm ? 'export ' : ''}async function askLLM(prompt, options = {}) {
  if (!activeManager) activeManager = createLLMManager({ dataDir: process.env.LLM_DATA_DIR || './data' });
  return activeManager.ask(prompt, options);
}
${esm ? '' : 'module.exports = { setupLLM, askLLM };'}
`
  };
}
