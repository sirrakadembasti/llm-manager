# LLM Manager

Standalone LLM provider and profile management plugin for Node.js 22.12+ and Express.
Easily integrates into any host application without requiring Docker, frontend frameworks, or databases. Requires Node/npm.
Runs on Windows, Linux, and macOS using the same codebase.

## Features

> For release history, refer to [CHANGELOG.md](CHANGELOG.md). Mutating requests require the CSRF header:
> `X-LLM-CSRF: 1`.

- Built-in catalog of 20 providers (with default model lists and regional endpoints) + custom OpenAI-compatible provider; select models from catalog, manually enter endpoint/model, or fetch available models dynamically from the provider.
- Profile creation, modification, deletion, and single active profile semantics; keeps existing API keys safe with a 3-state encrypted key badge and status notification.
- AES-256-GCM encryption (with mandatory 12-byte IV and 16-byte authentication tag), secure atomic file writes, revision control.
- Timeout configurable from 5–300s (default: 120s). Max output tokens: 256–32768 (default: 8192). Reasoning/thinking mode: auto/enabled/disabled across supported providers.
- Interactive Playground panel in the UI with streaming SSE response, token consumption metrics, and latency measurement.
- Multi-language UI support (Turkish & English) via `mountLLMManagement({ locale: 'tr' | 'en' })`.
- Separate quick connectivity and full conversation tests with recorded timestamps, latency, and error codes (preserved as long as credentials and endpoint remain unchanged).
- Admin authorization, CSRF protection, secure HTTP headers (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`), HTTPS provider enforcement, socket-level SSRF prevention blocking private IPv4/IPv6 ranges; zero secret leakage in logs or responses.
- In-flight request deduplication, debounce locks, timeouts, and form state preservation even while fetching remote models.

## Installation & Standalone Usage

### CLI (`npx llm-manager`)

```sh
# Interactive setup wizard (detects architecture -> injects code -> verifies integration -> launches /llm in browser)
npx github:sirrakadembasti/llm-manager init --password strong-password

# Start standalone management server directly
npx github:sirrakadembasti/llm-manager --password strong-password --port 8010
```

CLI Options: `init`, `-t/--type` (`express | spa | nextjs | nuxt | sveltekit | electron | dotnet | python`), `-f/--force`, `-y/--yes` (auto-confirm), `--no-open` (do not launch browser), `-w/--password`, `-u/--user` (default: `admin`), `-c/--cors` (e.g. `http://localhost:5173` or `*`), `-p/--port`, `-h/--help`, `-v/--version`. Environment variables in `.env` are automatically loaded; encryption key and storage files are initialized in `./data/`.

### From Source

```sh
npm ci
npm test
```

To run the sample server, configure `LLM_ADMIN_PASSWORD` (default user is `admin` unless `LLM_ADMIN_USER` is specified) and run `npm start`. The server listens strictly on `127.0.0.1:8010`; visit `/llm` in your browser.

PowerShell example (Windows):

```powershell
$env:LLM_ADMIN_PASSWORD = 'your-strong-password'
npm start
```

Enter API keys only through the admin UI. Do not commit profile files or encryption keys under `data/` to version control. Always backup profile store files alongside their corresponding **encryption keys**.

### Key Management, Rotation, and Encrypted Backups

> [!WARNING]
> **If the encryption key is lost, encrypted profiles cannot be recovered!** Always backup `data/llm-encryption.key` alongside `data/llm-profiles.json`.

```sh
# 1. Rotate encryption key (generates new key, re-encrypts all saved API keys under lock, backups old key):
npx llm-manager key rotate

# 2. Export profiles to an encrypted portable backup file (encrypted with password via scrypt/AES-GCM):
npx llm-manager export --out backup.json --password backup-password

# 3. Import profiles from an encrypted backup:
npx llm-manager import backup.json --password backup-password
```

## Integration into Existing Projects (Zero-Config)

Install the package:

```sh
npm install github:sirrakadembasti/llm-manager
```

The encryption key and `data/` directory are generated automatically on startup; simply mount the plugin and query with `llm.ask()`:

```js
import express from 'express';
import { mountLLMManagement } from '@sirrakadembasti/llm-manager';

const app = express();
app.use(express.json({ limit: '32kb' }));

// 1. Mount the plugin (specify adminPassword for built-in basic auth, or requireAuth for custom middleware):
const llm = mountLLMManagement(app, {
  adminPassword: process.env.LLM_ADMIN_PASSWORD // or requireAuth: (req, res, next) => ...
});

// 2. Query the active model with a single call (API keys are never exposed to the client):
const answer = await llm.ask('Provide a brief summary.', {
  system: 'You are a helpful assistant.'
});
```

If you have a custom `generate(messages, options)` adapter, pass it in `mountLLMManagement({ generate })`. You can also configure `dataDir` (e.g. `app.getPath('userData')` in Electron) or provide a custom `store`.

The plugin automatically applies `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and strict `Content-Security-Policy` headers to its UI and API endpoints. Async router/store errors on Express 4 are forwarded to host error handlers via `next(err)`. Mutating endpoints require `X-LLM-CSRF: 1`.

### Non-Express Integrations (Next.js, Nuxt, SvelteKit, Vue/React SPA, C#/.NET, Python, Desktop)

Running `npx llm-manager init --password 12345` inside your project directory automatically detects your tech stack and entry file, scaffolds client code with your approval, verifies syntax and connectivity, and opens `/llm` in your default browser:

| Application Type | Detection (`--type`) | Scaffolding File | Target Entry File | How to Ask Questions |
| --- | --- | --- | --- | --- |
| **Express.js Server** (ESM & CJS) | `express` | `llm.js` | `server.js` / `app.js` / `index.js` | `await askLLM('Hello')` |
| **SPA / Static Web** (React, Vue, Vite) | `spa` | `src/llm.js` | `src/App.vue` / `src/App.jsx` / `src/main.ts` | `await askLLM('Hello')` |
| **Next.js** (App Router) | `nextjs` | `llm.js` + `app/llm` & `app/api/llm` | `app/page.js` / `src/app/page.tsx` | `await askLLM('Hello')` |
| **Nuxt 3** | `nuxt` | `llm.js` + `server/api/llm` & `server/routes/llm` | `app.vue` / `pages/index.vue` | `await askLLM('Hello')` |
| **SvelteKit** | `sveltekit` | `src/lib/llm.js` + `+server.js` routes | `src/routes/+page.svelte` | `await askLLM('Hello')` |
| **C# (.NET Core / MVC / MVP / Desktop)** | `dotnet` | `LlmClient.cs` | `Program.cs` / `Startup.cs` / `HomeController.cs` / `Form1.cs` | `await LlmClient.AskAsync("Hello")` |
| **Python** (Flask, FastAPI, Django) | `python` | `llm_client.py` | `main.py` / `app.py` / `manage.py` | `ask_llm("Hello")` |
| **Desktop (Electron / Tauri)** | `electron` | `llm.js` | `main.js` / `electron/main.js` | `await askLLM('Hello')` / `ipcRenderer.invoke('llm:ask', ...)` |

For detailed step-by-step guides, consult **[docs/ENTEGRASYON.md](docs/ENTEGRASYON.md)**.

```js
import { createLLMManager } from '@sirrakadembasti/llm-manager/core';

const llm = createLLMManager(); // data/ directory and encryption key are auto-created

// Direct question invocation:
const reply = await llm.ask('Hello!');

// Next.js / SvelteKit / Hono standard Web Request -> Response adapter:
const response = await llm.fetch(request);
```

## API & Store Contract

Default base route `/api/llm`:

| Operation | Path |
| --- | --- |
| Catalog & profiles | `GET /catalog`, `GET /profiles` |
| Create / Update / Delete | `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id` |
| Activate | `POST /profiles/:id/activate` |
| Test | `POST /profiles/:id/test`, JSON `{ "mode": "quick" }` or `conversation` |
| Model list | `GET /profiles/:id/models` |
| Model completion (Runtime) | `POST /chat`, JSON `{ "prompt": "..." }` or `{ "messages": [...] }` |
| Health check | `GET /health` |
| Monthly usage statistics | `GET /usage?month=YYYY-MM` |

The `POST /chat` endpoint executes calls server-side using the active profile (or an optional `profileId`) and returns `{ ok: true, content, profileId, profileName, provider, model, durationMs, usage }`. API keys are never leaked to clients.
Access level can be configured via `chatAccess`: `'authenticated'` (default: any authenticated user), `'admin'` (admins only), or `false` (disabled).

A custom store implementation can be provided instead of `createLLMProfileStore`: `list`, `get`, `getActive`, `save`, `remove`, `activate`, `recordTest(id, status, expectedRevision, details)`. `get` returns the decrypted `apiKey` exclusively server-side; `list` and `save` must never expose keys. Missing profiles yield `code: 'PROFILE_NOT_FOUND'` (`HTTP 404`), revision mismatches return `code: 'PROFILE_CONFLICT'` (`HTTP 409`). Multi-process file locking ensures integrity across worker processes on standard POSIX/Windows file systems.

### Enterprise Proxy and LAN Models (SSRF Security)

- **Corporate Proxy (`proxyUrl` / `LLM_HTTPS_PROXY`):** Outgoing API requests can be routed through an enterprise HTTPS proxy via `proxyUrl`. When proxying, destination addresses are restricted strictly to **known catalog provider domains** and explicitly configured `allowedHosts` (`LLM_DNS_BLOCKED`).
- **Local / LAN Model Servers (`allowedPrivateHosts` / `LLM_ALLOWED_PRIVATE_HOSTS`):** Connect to local Ollama, LM Studio, or vLLM instances (`http://192.168.1.50:11434`, `http://ollama.lan`) by configuring `allowedPrivateHosts: ['192.168.1.50:11434', 'ollama.lan']`. Only explicitly listed hosts bypass the private IP / HTTP restriction; all other endpoints strictly enforce HTTPS and SSRF protection.

## License & Versioning

MIT License ([LICENSE](LICENSE)). Follows [Semantic Versioning](https://semver.org/).
To release a version: `npm run release:patch|minor|major` (runs verification suite, bumps version, updates changelog, and creates git tag).

### Web authentication

Configure `createLLMManager({ adminPassword: process.env.LLM_ADMIN_PASSWORD, chatTokens: process.env.LLM_CHAT_TOKENS })` for Web routes. Management pages, scripts and APIs require an admin principal. Missing configuration fails closed with `AUTH_NOT_CONFIGURED`. A host can provide `authorize: async request => principal | null`; per-call `fetch(request, options)` settings override defaults. Bearer tokens can call POST /chat only; `chatAccess: 'admin'` excludes them. Browser-visible tokens are public; use your own backend in production. `insecureNoAuth: true` is an explicit insecure local opt-in. Direct `ask()` and `handle()` are trusted host APIs.

The installer stores credentials in ignored environment files, keeps secrets out of generated source and npm scripts, and preserves existing generated credentials on repeated runs.

## Migrating from 1.x to 2.0

The npm package named `llm-manager` belongs to another project. Bare `npx llm-manager` examples in this document mean the local executable **after installing this repository into the host**. The local 2.0 version does not imply an npm release or a published Git tag.

Run `npm uninstall llm-manager`, then `npm install github:sirrakadembasti/llm-manager`; change imports to `@sirrakadembasti/llm-manager`. The CLI name and existing data/key files remain unchanged. Await every file-store method; custom stores may return values or Promises. Use the `/init` subpath for synchronous wizard APIs. Key-file creation is the default; legacy `.env` writing requires deprecated `writeEnv:true`.

The catalog was verified on 2026-10-24; unverified suggestions were removed. Use model discovery for your account. [Primary source evidence and transport limits](docs/roadmap/CATALOG_SOURCES_2026-10-24.md) are recorded. Current always-on reasoning models reject unsupported disabled mode explicitly.

Purposes are `quick | diagnostic | default`; legacy manager/production aliases warn once. Custom generate callbacks no longer receive useManagedProfile/allowMockFallback. File stores use asynchronous I/O, FIFO writes and a five-second process-lock acquisition deadline on local disks. NFS/SMB guarantees are excluded. Keep keys backed up: lost keys cannot decrypt profiles. On Windows use service-account ACLs, not POSIX mode bits alone.

Optional usage logging stores numeric usage and timing, not prompt/response content. `/usage` is admin-only; `/health` is public and secret-free unless disabled. `locale` and `homeUrl` configure the UI. Fallback profiles retain user-selected order and share a total request timeout budget. [Integration details](docs/ENTEGRASYON.md) describe supported frameworks, server-only boundaries, rollback and compiler checks.
