export function serverHelper(PKG, esm = true) {
  const prefix = esm
    ? `import { createLLMManager } from '${PKG}/core';`
    : `const { createLLMManager } = require('${PKG}/core');`;
  const exp = esm ? 'export ' : '';
  return `${prefix}
try { process.loadEnvFile?.('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
${exp}const llm = createLLMManager({
  dataDir: process.env.LLM_DATA_DIR || './data',
  adminPassword: process.env.LLM_ADMIN_PASSWORD,
  chatTokens: process.env.LLM_CHAT_TOKENS?.split(',')
});
${exp}async function askLLM(prompt, options = {}) { return llm.ask(prompt, options); }
${esm ? '' : 'module.exports = { llm, askLLM };'}
`;
}
export function webRoutes(imp, svelte = false) {
  return (
    `import { llm } from '${imp}';\n` +
    ['GET', 'POST', 'PUT', 'DELETE']
      .map(
        method =>
          `export const ${method} = ${svelte ? '({ request }) => llm.fetch(request)' : '(req) => llm.fetch(req)'};`
      )
      .join('\n') +
    '\n'
  );
}
