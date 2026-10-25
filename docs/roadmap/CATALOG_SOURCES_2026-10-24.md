# Catalog source audit — 2026-10-24

Verified on **2026-10-24** against the primary sources linked below. This is a curated text-chat suggestion list, not an exhaustive upstream inventory or an authenticated availability guarantee. No paid generation calls or credentialed provider requests were made for this audit. Provider identities, transports, regional endpoints, and provider-level capability flags are preserved.

Every nonempty list below contains exact API IDs observed in official documentation or the provider's public model-list endpoint. An empty list means this audit could not establish a current model ID suitable for the configured default endpoint and transport. It does **not** mean the provider has no models. Users can enter a model manually or use authenticated model preview for their account and selected region.

## Retained suggestions and evidence

All rows were checked on **2026-10-24**. Regional/account permissions and installed local models still determine actual availability.

| Provider | Exact catalog IDs | Primary source and finding |
| --- | --- | --- |
| OpenAI | `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna` | [Model catalog](https://developers.openai.com/api/docs/models) supplies IDs. [GPT-6 guide](https://developers.openai.com/api/docs/guides/latest-model) explicitly supports Chat Completions for text requests. Astra and Sol require Responses for tool calling; this package's text-chat transport does not invoke tools. Reasoning requests have parameter restrictions described in that guide. |
| Anthropic | `claude-fable-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` | [Models overview](https://platform.claude.com/docs/en/models/overview), Claude API ID row. All support text input/output. See thinking restrictions below. |
| Google | `gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.5-flash-lite` | [Gemini models](https://ai.google.dev/gemini-api/docs/models?hl=en), stable model endpoint tables. Voice, Live, transcription, TTS, image-generation, and video-generation models are excluded. |
| xAI | `grok-4.7` | [Official Chat Completions example](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions) uses this exact ID and `https://api.x.ai/v1`. Chat Completions remains a legacy supported endpoint. |
| OpenRouter | `moonshotai/kimi-k3.1-pro` | [Public models API](https://openrouter.ai/api/v1/models) returns this exact ID with text output modality. Suggestions deliberately cover only a small subset of the aggregator. |
| Groq | `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` | [Supported models](https://console.groq.com/docs/models), production model IDs. The Llama entries are marked Enterprise and can require account approval. Speech and safety classifiers are excluded. |
| Together | `deepseek-ai/DeepSeek-V4-Pro-0813`, `deepseek-ai/DeepSeek-V4.1-Flash-1017`, `Qwen/Qwen3.8-Flash` | [Available serverless models](https://docs.together.ai/docs/serverless/models), Chat models / API model string column. |
| Fireworks | `accounts/fireworks/models/glm-5p3-flash` | [Serverless quickstart](https://docs.fireworks.ai/getting-started/quickstart) includes an OpenAI chat-completions request at the configured inference endpoint. |
| Cohere | `command-a-plus-05-2026`, `command-a-03-2025`, `command-r-plus-08-2024`, `command-r-08-2024` | [Models overview](https://docs.cohere.com/docs/models) marks these Live; [OpenAI compatibility guide](https://docs.cohere.com/docs/compatibility-api) demonstrates the configured compatibility endpoint and Command A+. |
| DeepSeek | `deepseek-flash`, `deepseek-v4-pro` | [Models and pricing](https://api-docs.deepseek.com/quick_start/pricing/) lists exact model names and OpenAI-format base URL. Current Flash alias is preferred over aliases serving retired underlying models. |
| Qwen | `qwen3.8-max`, `qwen3.7-plus`, `qwen3.8-flash` | [Recommended models](https://www.alibabacloud.com/help/en/model-studio/models) and [text generation model IDs](https://www.alibabacloud.com/help/en/model-studio/text-generation-model). Model Studio has regional catalogs; selecting a preset does not establish permission in every region. |
| Kimi | `kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed` | [Official quickstart](https://platform.kimi.ai/docs/get-your-api-key) names both and demonstrates Chat Completions with `https://api.moonshot.ai/v1`. |
| MiniMax | `MiniMax-M3.1-Flash`, `MiniMax-M3` | [Models overview](https://platform.minimax.io/docs/guides/models-intro) lists language models; [OpenAI SDK guide](https://platform.minimax.io/docs/api-reference/text-openai-api) documents supported models and chat-completions endpoint. Audio/video models are excluded. |
| Xiaomi MiMo | `mimo-v2.6-pro`, `mimo-v2.6-flash` | [Official model list](https://mimo.mi.com/docs/en-US/quick-start/model) reports V2.5 and V2.5 Pro deprecated on October 21, 2026. [MiMo V2.6 Pro](https://mimo.mi.com/models/en-US/mimo-v2-6-pro) demonstrates the exact OpenAI-compatible endpoint and model ID; [batch text-generation examples](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/text-generation/batch-api) demonstrate both V2.6 IDs for chat completions. |
| Ollama | `gpt-oss:20b` | [Official local-server Chat Completions example](https://docs.ollama.com/api/openai-compatibility) uses this exact tag. It must be installed on the user's server; this is not a claim about the local machine's installed inventory. |

## Cleared unverified lists

All old suggestions for the following providers were removed; provider and endpoint presets remain available. Sources were checked/attempted on **2026-10-24**.

| Provider | Removed suggestions | Evidence / reason for an empty list |
| --- | --- | --- |
| Perplexity | `sonar-pro`, `sonar`, `sonar-reasoning-pro`, `sonar-reasoning` | [Old Sonar documentation redirects to migration](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview); [current models](https://docs.perplexity.ai/docs/agent-api/models) uses Agent API IDs and Responses examples. Current IDs were not established for the existing Chat Completions transport, so none are substituted. |
| Zhipu GLM | `glm-4.5`, `glm-4-plus`, `glm-4-air`, `glm-4-flash`, `glm-z1-air` | [Z.ai chat reference](https://docs.z.ai/api-reference/llm/chat-completion) demonstrates `glm-5.3` at the global endpoint. That alone does not establish the same current inventory at this preset's default BigModel China endpoint; old defaults are cleared. |
| SiliconFlow | `deepseek-ai/DeepSeek-V3`, `deepseek-ai/DeepSeek-R1`, `Qwen/Qwen2.5-72B-Instruct` | [Quickstart](https://docs.siliconflow.com/en/userguide/quickstart) directs users to account model lists. [Chat reference](https://docs.siliconflow.com/en/api-reference/chat-completions/chat-completions) shows a global-endpoint Qwen example; this does not verify the configured China endpoint's current inventory. |
| Baidu | `ernie-4.5-turbo-128k`, `ernie-4.0-turbo-8k`, `ernie-speed-128k`, `deepseek-v3` | [Qianfan documentation](https://cloud.baidu.com/doc/qianfan/index.html) was reachable but did not establish current exact IDs for these suggestions. |
| Doubao | `doubao-seed-1-6-250615`, `doubao-1-5-pro-32k-250115`, `doubao-1-5-lite-32k-250115`, `deepseek-r1-250120` | [Ark model list](https://docs.volcengine.com/docs/ark/model-list?lang=zh) exposed only a JavaScript-required shell to the audit tool. No current exact IDs were established. |
| Hunyuan | `hunyuan-turbos-latest`, `hunyuan-pro`, `hunyuan-standard`, `hunyuan-lite` | [Tencent documentation](https://cloud.tencent.com/document/product/1729/104753) timed out in the audit tool. No current exact IDs were established. |
| Custom | None (already empty) | User-supplied endpoint; there is no universal upstream inventory to verify. |

Other old suggestions were replaced by the explicit IDs in the first table. This removal policy avoids treating a historic model name, a changed release label, or a matching name at a different provider as current verification. It does not assert that every removed model has been retired. In particular, models can remain available to particular accounts after they leave this curated list.

## Thinking and transport scope

The provider-level `thinking` flag describes an integration affordance, not a promise that every model supports both toggle values. [Anthropic's current thinking table](https://platform.claude.com/docs/en/build-with-claude/thinking) says all four suggested Claude models reject manual `enabled` plus `budget_tokens`. They accept adaptive thinking and use it when the field is omitted. Fable 5.1 and Opus 5.5 cannot disable thinking; Sonnet 5.5 uses `between_tools` instead of `disabled` at high effort or below; Haiku 5.5 accepts `disabled` at high effort or below. Transport handling must account for these distinctions; catalog inclusion alone does not validate toggle behavior.

## Repeating the account-specific check

Set a provider-specific environment variable such as `OPENAI_API_KEY` or `PROVIDER_KEY_OPENAI`, then run `node scripts/check-catalog.js --provider openai`. The optional generic `LLM_API_KEY` is considered only when a single provider is explicitly selected. A command-line key also requires `--provider`; it is never broadcast across providers. With no provider selector, only provider-specific keys are used. Keys are never printed.

The checker performs a model-list GET, reports returned model IDs and exact matches/missing suggestions, and does not issue generation requests. Successful matching is account-specific evidence, not proof that every generation parameter or region is supported. Some services do not implement the list endpoint. An unauthenticated/skipped run is not live verification. Local Ollama checking requires an installed model and explicit `--allow-local-http` plus a dummy key value because the SDK-compatible local API ignores that key.

Current transport updates use adaptive Claude thinking for the verified 5.5/5.1 IDs and explicitly reject unsupported full-off requests. Gemini 3/4 use `thinkingLevel: medium` for enabled, omit configuration for auto, and reject full-off; Gemini 2.5 Flash retains numeric budget support while 2.5 Pro rejects off. See [Google's official thinking parameter guide](https://ai.google.dev/gemini-api/docs/generate-content/thinking.md). GPT-6 disables unsupported sampling parameters while reasoning is active and uses effort `none` for disabled mode; see the OpenAI guide linked above.
