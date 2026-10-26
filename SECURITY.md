# Security Policy

## Supported Versions

Only the latest major/minor release is actively maintained with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

### Current development

The local `package.json` version is `2.0.0`, tracked as **Unreleased** in `CHANGELOG.md`. This is development context, not evidence of a published 2.x release. The existing 1.x support policy above remains in place; this clarification does not add a maintenance or backport commitment for another release line. Report development vulnerabilities through the same private reporting channels below, including the commit and local version so the affected code can be identified.

## Reporting a Vulnerability

If you discover a potential security vulnerability in `@sirrakadembasti/llm-manager` (or `llm-manager`), please do **not** disclose it publicly via GitHub issues or discussions.

Instead, please report security issues responsibly through one of the following methods:

1. **GitHub Security Advisory**: Submit a private advisory at https://github.com/sirrakadembasti/llm-manager/security/advisories/new
2. **Email**: Contact the maintainer at `sirrakadembasti@users.noreply.github.com` with the subject `[SECURITY VULNERABILITY] llm-manager`.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:
- A clear description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- The affected component (e.g., `src/providerTransport.js`, `src/profileStore.js`, UI, or CLI).
- Operating system and Node.js version.

### Response Timeline

- **Initial Acknowledgment**: Within 48 hours of receipt.
- **Triage & Assessment**: Within 5 business days.
- **Resolution & Release**: A fix and release patch will be coordinated before public disclosure.

## Security Architecture Principles

- **Zero Secret Leakage**: API keys, master encryption keys, and admin passwords are never sent to browser clients, returned in public API responses, or printed in logs.
- **SSRF Prevention**: All provider outbound HTTP requests are restricted to HTTPS and validated against DNS/socket level filters blocking loopback and private IP ranges (RFC 1918 / RFC 4193).
- **CSRF Protection**: Mutating endpoints enforce `X-LLM-CSRF: 1`.
- **Encryption at Rest**: Profile secrets and API keys are stored using AES-256-GCM with a mandatory 12-byte IV and 16-byte authentication tag.
