# Security Policy

## Supported Versions

Only the latest major/minor release is actively maintained with security updates.

| Version | Supported |
| --- | --- |
| 1.x.x | :white_check_mark: |
| < 1.0 | :x: |

Local `2.0.0` is **Unreleased**, not evidence of a published 2.x release. This does not add a maintenance or backport commitment for another release line. Report development vulnerabilities through the same private reporting channels below; include the commit and local version.

## Reporting a Vulnerability

Do not post secrets or exploit details in public issues. Use a [private GitHub advisory](https://github.com/sirrakadembasti/llm-manager/security/advisories/new), or email `sirrakadembasti@users.noreply.github.com` with subject `[SECURITY VULNERABILITY] llm-manager`.

Include impact, reproduction/PoC, affected component, OS and Node version. Acknowledgment target: 48 hours; triage: 5 business days. Coordinate a fix/release before public disclosure.

## Security Architecture Principles

- **Zero Secret Leakage:** keys/passwords stay server-side; logs redact secrets and message content.
- AES-256-GCM: 12-byte IV, 16-byte authentication tag; back up profiles and encryption key together.
- HTTPS plus socket/DNS SSRF filtering; private hosts require explicit permission. Proxy DNS uses a destination allowlist instead of local IP filtering.
- Mutating HTTP requests require `X-LLM-CSRF: 1`; admin and chat identities remain separate.
- Production needs TLS, strong credentials and service-account-only file access. Windows requires ACLs; POSIX 0600 alone is insufficient.

Controls and planned protections: [threat model](docs/THREAT_MODEL.md). A local security test/audit does not prove remote deployment safety.
