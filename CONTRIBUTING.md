# Contributing Guidelines

Thank you for your interest in contributing to LLM Manager (`@sirrakadembasti/llm-manager`)!

This project is a standalone, framework-agnostic LLM provider and profile management plugin for Node.js and Express. To ensure quality, safety, and long-term stability, please follow these guidelines when submitting pull requests or making modifications.

---

## Code of Conduct & Development Workflow

1. **Standalone & Zero Host Coupling**:
   - The plugin must never rely on specific host frameworks or assume external environment variables unless explicitly provided via options.
   - Core runtime features (`src/core.js`) must remain framework-agnostic and work across Node.js Web standards (`fetch`, `Request`, `Response`).

2. **Zero Secret Leakage**:
   - API keys, admin passwords, and prompts must **never** be exposed to browser clients, returned in API listing responses, or printed in plain text inside logs.
   - Any sensitive object must be passed through `redact()` before logging.

3. **Test-Driven Development & Verification**:
   - Every bugfix and feature must be backed by automated tests under `tests/`.
   - Never commit code that breaks existing tests.

---

## Quality Verification Commands

Before creating a commit or submitting a pull request, run all verification scripts locally:

```sh
# 1. Run unit and integration tests
npm test

# 2. Check TypeScript definitions
npm run typecheck

# 3. Check code style and linting
npm run lint

# 4. Check formatting
npm run format:check

# 5. Check test coverage thresholds
npm run test:coverage

# 6. Audit production dependencies
npm audit --omit=dev
```

To automatically format files using Prettier:
```sh
npm run format
```

---

## Commit Guidelines (Conventional Commits)

We enforce Conventional Commits for clean history and automated versioning:

- `feat(...)`: A new user-facing or programmatic feature (e.g., `feat(ui): add clone profile button`)
- `fix(...)`: A bug fix (e.g., `fix(store): handle Windows EPERM on rename retry`)
- `docs(...)`: Documentation changes only (e.g., `docs(security): add threat model`)
- `test(...)`: Adding or updating tests without runtime changes (e.g., `test(coverage): add test:coverage script`)
- `refactor(...)`: Code refactoring that neither fixes a bug nor adds a feature
- `chore(...)`: Maintenance, dependency bumps, release tasks

---

## Updating Documentation & Changelog

Every contribution that alters behavior, adds endpoints, or resolves issues must:
1. Update `CHANGELOG.md` under the `## [Unreleased]` section following the [Keep a Changelog](https://keepachangelog.com/) standard.
2. Update relevant markdown files (`README.md`, `README.en.md`, `docs/ENTEGRASYON.md`, or `docs/DEPLOY.md`).
3. Add a single-line summary note in `GEMINI.md`.
