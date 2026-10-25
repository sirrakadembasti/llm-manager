export default function python() {
  return {
    'llm_client.py': `import urllib.request
import urllib.error
import json
import os

LLM_URL = os.environ.get("LLM_MANAGER_URL", "http://127.0.0.1:8010/api/llm/chat")

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
            data = {"error": str(error)}
        raise LLMError(data.get("error", str(error)), data.get("code"), error.code) from error
`
  };
}
