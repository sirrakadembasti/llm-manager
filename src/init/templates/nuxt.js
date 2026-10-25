import { serverHelper } from './shared.js';
export default function nuxt({ PKG }) {
  const route = `import { defineEventHandler, toWebRequest } from 'h3';
import { llm } from '../../utils/llm.js';
export default defineEventHandler(event => llm.fetch(toWebRequest(event)));
`;
  return {
    'server/utils/llm.js': serverHelper(PKG),
    'server/api/llm/[...slug].js': route,
    'server/routes/llm/[...slug].js': route
  };
}
