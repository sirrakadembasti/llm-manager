import { serverHelper, webRoutes } from './shared.js';
export default function sveltekit({ PKG }) {
  return {
    'src/lib/server/llm.js': serverHelper(PKG),
    'src/routes/api/llm/[...slug]/+server.js': webRoutes('$lib/server/llm.js', true),
    'src/routes/llm/[...slug]/+server.js': webRoutes('$lib/server/llm.js', true),
    'src/routes/api/ask/+server.js': `import { llm } from '$lib/server/llm.js';
// Uses the same authenticated chat policy as the manager route.
export const POST = ({ request }) => llm.fetch(new Request(new URL('/api/llm/chat', request.url), request));
`
  };
}
