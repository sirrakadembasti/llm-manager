export default function spa({ cwd, fs }) {
  return {
    [fs.existsSync(cwd + '/src') ? 'src/llm.js' : 'llm.js']:
      `// UYARI: Tarayıcıya giden her değer herkese açıktır. Bu belirteç yalnız sohbet yetkilidir; üretimde kendi sunucunuz üzerinden çağırın.
const LLM_URL = import.meta.env?.VITE_LLM_URL || 'http://127.0.0.1:8010/api/llm/chat';
const LLM_TOKEN = import.meta.env?.VITE_LLM_CHAT_TOKEN;
export async function askLLM(prompt, options = {}) {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-LLM-CSRF': '1', ...(LLM_TOKEN ? { Authorization: 'Bearer ' + LLM_TOKEN } : {}) },
    body: JSON.stringify({ prompt, system: options.system })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'LLM isteği başarısız oldu.');
  return data.text || data.content;
}
`
  };
}
