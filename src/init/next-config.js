import fs from 'node:fs';
import path from 'node:path';

// Match a small, literal configuration subset without evaluating host code.
function configEdit(source, packageName) {
  const tokens = [];
  const lexer = /\s+|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[\w$]+|[^\s]/g;
  for (const match of source.matchAll(lexer)) {
    if (/^(?:\s|\/\/|\/\*)/.test(match[0])) continue;
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }
  const text = tokens.map(t => t.text);
  if (text.includes('`')) return null;
  const joined = text.join(' ');
  const prefix =
    /^(?:import type \{ NextConfig \} from ['"]next['"] ; )?(?:export default |module \. exports = |(?:const|let|var) nextConfig (?:: NextConfig )?= )\{/;
  const match = joined.match(prefix);
  if (!match) return null;
  const open = text.indexOf('{', text[0] === 'import' ? text.indexOf(';') + 1 : 0);
  let depth = 1;
  let close = open + 1;
  for (; close < text.length && depth; close++) {
    if (text[close] === '{') depth++;
    if (text[close] === '}') depth--;
  }
  close--;
  if (depth) return null;
  const suffix = text.slice(close + 1).join(' ');
  const declaration = /(?:const|let|var) nextConfig/.test(match[0]);
  if (declaration ? !/^;? ?export default nextConfig ?;?$/.test(suffix) : !/^;?$/.test(suffix)) return null;
  let external = null;
  let i = open + 1;
  while (i < close) {
    const key = text[i++];
    if (!/^(?:[\w$]+|'[\w$]+'|"[\w$]+")$/.test(key) || text[i++] !== ':') return null;
    const start = i;
    const stack = [];
    while (i < close && !(text[i] === ',' && !stack.length)) {
      const token = text[i++];
      if (['{', '[', '('].includes(token)) stack.push(token);
      if (['}', ']', ')'].includes(token) && stack.pop() !== { '}': '{', ']': '[', ')': '(' }[token]) return null;
    }
    if (stack.length) return null;
    if (key.replace(/['"]/g, '') === 'serverExternalPackages') {
      if (external) return null;
      external = { start, end: i };
    }
    if (text[i] === ',') i++;
  }
  if (external) {
    const values = text.slice(external.start, external.end);
    if (values.shift() !== '[' || values.pop() !== ']') return null;
    const packages = [];
    for (let n = 0; n < values.length; n++) {
      if (n % 2 ? values[n] !== ',' : !/^(['"])[^'"\\]*\1$/.test(values[n])) return null;
      if (!(n % 2)) packages.push(values[n].slice(1, -1));
    }
    if (packages.includes(packageName)) return source;
    const position = tokens[external.end - 1].start;
    const comma = values.length && values.at(-1) !== ',' ? ', ' : '';
    return source.slice(0, position) + comma + JSON.stringify(packageName) + source.slice(position);
  }
  const position = tokens[open].end;
  return (
    source.slice(0, position) + `\n  serverExternalPackages: [${JSON.stringify(packageName)}],` + source.slice(position)
  );
}
export async function configureNext({ cwd, journal, promptUser, yes, logger, packageName }) {
  for (const name of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
    const full = path.join(cwd, name);
    if (!fs.existsSync(full)) continue;
    const original = fs.readFileSync(full, 'utf8');
    const updated = configEdit(original, packageName);
    if (updated === original) return;
    const instruction = `${name}: serverExternalPackages: [${JSON.stringify(packageName)}] ekleyin.`;
    if (updated === null) {
      logger(instruction);
      return;
    }
    const answer = yes ? 'e' : await promptUser('Next.js serverExternalPackages ayarı eklensin mi? (e/H): ');
    if (!/^(e|evet|y|yes)$/i.test(String(answer).trim())) {
      logger(instruction);
      return;
    }
    journal.write(full, updated);
    return;
  }
}
