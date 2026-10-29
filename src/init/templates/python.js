export default function python({ apiPath = '/api/llm' } = {}) {
  return {
    'llm_client.py': `import urllib.request
import urllib.error
import json
import os

LLM_URL = os.environ.get("LLM_MANAGER_URL", ${JSON.stringify('http://127.0.0.1:8010' + apiPath + '/chat')})

class LLMError(Exception):
    def __init__(self, message, code=None, status=None):
        super().__init__(message)
        self.code = code
        self.status = status

def ask_llm(prompt: str, system: str = "") -> str:
    token = os.environ.get("LLM_CHAT_TOKEN", "")
    body = json.dumps({"prompt": prompt, "system": system}).encode("utf-8")
    req = urllib.request.Request(LLM_URL, data=body, headers={
        "Content-Type": "application/json", "X-LLM-CSRF": "1",
        "Authorization": f"Bearer {token}"
    }, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=330) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("content") or data.get("text") or ""
    except urllib.error.HTTPError as error:
        try:
            data = json.loads(error.read().decode("utf-8"))
        except (ValueError, UnicodeError):
            data = {}
        if not isinstance(data, dict):
            data = {}
        message = data.get("error")
        if not isinstance(message, str) or not message.strip():
            message = f"LLM isteği başarısız (HTTP {error.code})."
        raise LLMError(message, data.get("code"), error.code) from error
`
  };
}
