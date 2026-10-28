# Graph Report - result  (2026-10-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 898 nodes · 2499 edges · 62 communities (35 shown, 27 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61

## God Nodes (most connected - your core abstractions)
1. `createLLMManager()` - 67 edges
2. `LLMError` - 60 edges
3. `projectError()` - 39 edges
4. `createLLMProfileStore()` - 31 edges
5. `initLLMProject()` - 25 edges
6. `mountLLMManagement()` - 25 edges
7. `runInteractiveInit()` - 23 edges
8. `ErrorCodes` - 20 edges
9. `createProjectFiles()` - 19 edges
10. `createProjectTasks()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `getActive()` --calls--> `LLMError`  [EXTRACTED]
  tests/store-recovery.test.js → src/errors.js
- `handle()` --indirect_call--> `operation()`  [INFERRED]
  src/project/index.js → public/llm-ui.js
- `fixture()` --calls--> `createLLMManager()`  [EXTRACTED]
  tests/chat-completion-lifecycle.test.js → src/core.js
- `managerFixture()` --calls--> `createLLMManager()`  [EXTRACTED]
  tests/final-stream-regressions.test.js → src/core.js
- `exerciseCrud()` --calls--> `createLLMManager()`  [EXTRACTED]
  tests/host-store.test.js → src/core.js

## Import Cycles
- None detected.

## Communities (62 total, 27 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (63): audit(), files, upstream, analyzeProject(), role(), conflict(), createProjectChanges(), currentHash() (+55 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (50): ensureGitignore(), readEnv(), upsertEnv(), packageInstalled(), detectEntryFile(), detectProjectType(), hasFilesWithExt(), isEsmProject() (+42 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (24): decrypt(), encrypt(), parseEncryptionKey(), atomicWrite(), ensureEncryptionKey(), ensureLLMEncryptionKey(), exportProfiles(), importProfiles() (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (27): ErrorCodes, isLLMError(), LLMError, assertRevision(), conflictError(), createLLMProfileStore(), exists(), migrate() (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (15): BasicAuthOptions, MountedLLMManager, MountOptions, ./project.js, ClassifiedLLMError, NormalizedRuntimeOptions, ParsedProviderResponse, ProviderTransport (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (23): createMemoryStore(), checkProvider(), options, resolveApiKey(), runCatalogCheck(), credentialEndpointProblem(), CATALOG_UPDATED_AT, CATALOG_VERSION (+15 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (20): express, checkBasicAuth(), checkBearerToken(), safeEqual(), fetchHandler(), createUiAssets(), CSRF_HEADER, isValidMountPath() (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.19
Nodes (32): apiBase, button(), catalog, clearForm(), cloneProfile(), disabledBefore, editProfile(), fallbackOrder (+24 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (20): AsyncLLMStore, ChatResult, FetchOptions, GenerationResponse, HandleOptions, HandleResponse, LLMManagerLimits, LLMManagerOptions (+12 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (25): createLLMManager(), ask(), askWithAdmission(), chatCompletion(), streamGenerator(), handle(), handleRoute(), listModels() (+17 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (6): port, createStandaloneServer(), [mode, entry, dataDir], child(), fixture, root

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (22): jobs, test, node-version, os, name, on, pull_request, push (+14 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (22): default, types, default, types, exports, ./core, ./errors, ./init (+14 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (5): checkSource(), execute, execute, interpreter, exec

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (12): ChangeJournal, InitProjectOptions, InitProjectResult, InjectOptions, InjectResult, InteractiveInitOptions, InteractiveInitResult, ProbeOptions (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (6): guide, readme, scenarios, fixture(), guide, pkg

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (5): electron(), loadHelper(), fixture(), ready, source

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (15): author, dependencies, undici@^7.30.1, description, files, homepage, keywords, license (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (14): devDependencies, eslint@^10.13.0, @eslint/js@^10.0.1, express@^4.19.2, express5@npm:express@^5.3.0, globals@^17.13.0, prettier@^3.9.10, typescript@^7.0.2 (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.52
Nodes (12): createLLMProjectUI(), init(), lock(), perform(), refresh(), render(), renderCommand(), renderTask() (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (6): initLLMProject(), injectIntoEntryFile(), probeAndOpenBrowser(), runInteractiveInit(), verifyIntegration(), store

### Community 25 - "Community 25"
Cohesion: 0.17
Nodes (5): dummyApp, manager, messages, projectManager, projectOptions

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (11): scripts, format, format:check, lint, release:major, release:minor, release:patch, start (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (3): buildBody(), normalizeMessages(), parseStreamEvent()

### Community 31 - "Community 31"
Cohesion: 0.25
Nodes (5): args, fail(), projectOptionsFromEnv(), pkg, root

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (4): __dirname, srcDir, helpers, pkg

### Community 33 - "Community 33"
Cohesion: 0.39
Nodes (4): assertRepairResponse(), assertUiRepair(), recoveryFixture(), getActive()

### Community 35 - "Community 35"
Cohesion: 0.38
Nodes (5): frame(), managerFixture(), profile, start(), success()

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (4): fallback, fixture(), observedUsage, primary

### Community 38 - "Community 38"
Cohesion: 0.33
Nodes (5): ProjectCommandResult, ProjectInventory, ProjectOptions, ProjectSource, ProjectTask

### Community 40 - "Community 40"
Cohesion: 0.83
Nodes (4): createUsageTracker(), getLogFilePath(), getSummary(), record()

### Community 42 - "Community 42"
Cohesion: 0.50
Nodes (4): AskOptions, GenerationOptions, NetworkOptions, RuntimeOptions

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): optional, peerDependenciesMeta, express

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (3): repository, type, url

## Knowledge Gaps
- **8 isolated node(s):** `CATALOG_UPDATED_AT`, `CATALOG_VERSION`, `CSRF_HEADER`, `MESSAGES`, `PACKAGE_VERSION` (+3 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 368 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `Community 6` to `Community 0`, `Community 33`, `Community 35`, `Community 11`, `Community 18`, `Community 19`, `Community 50`, `Community 21`, `Community 23`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `createLLMManager()` (e.g. with `ask()` and `fetchHandler()`) actually correct?**
  _`createLLMManager()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `CATALOG_UPDATED_AT`, `CATALOG_VERSION`, `CSRF_HEADER` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07041198501872659 - nodes in this community are weakly interconnected._
- **Why does `handle()` connect `Community 0` to `Community 7`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06739811912225706 - nodes in this community are weakly interconnected._
- **Why does `operation()` connect `Community 7` to `Community 0`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._