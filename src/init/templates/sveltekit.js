import { serverHelper, webRoutes } from './shared.js';
export default function sveltekit({ PKG, pagePath = '/llm', apiPath = '/api/llm' }) {
  return {
    'src/lib/server/llm.js': serverHelper(PKG, true, { pagePath, apiPath }),
    [`src/routes${apiPath}/[...slug]/+server.js`]: webRoutes('$lib/server/llm.js', true),
    [`src/routes${pagePath}/[...slug]/+server.js`]: webRoutes('$lib/server/llm.js', true),
    'src/routes/api/ask/+server.js': `import { llm } from '$lib/server/llm.js';
// Uses the same authenticated chat policy as the manager route.
export const POST = ({ request }) => llm.fetch(new Request(new URL(${JSON.stringify(apiPath + '/chat')}, request.url), request));
`
  };
}
