# Security Policy

## Reporting a Vulnerability

If you believe you've found a security vulnerability in Babbage AI,
please report it privately rather than opening a public issue.

**Email:** security@babagemed.com (or ceo@babagemed.com)

Please include:

- A description of the vulnerability
- Steps to reproduce
- Affected versions / components (web / desktop / iOS / Android / MCPs / backend)
- Your assessment of impact

We aim to acknowledge reports within 3 business days and to ship a fix
or mitigation within 30 days for high-severity issues.

## Supported Versions

Only the latest tagged release of each platform is supported with
security fixes.

| Component | Supported branch |
|-----------|------------------|
| Backend (Go)     | `main` |
| Web (Next.js)    | `main` |
| Desktop (Tauri)  | latest `desktop-v*` tag |
| iOS              | latest TestFlight / App Store build |
| Android          | latest Play Store / internal track |
| MCPs             | `main` |

## Disclosure Policy

Once we've shipped a fix, we'll publish an advisory in this repository
describing the issue and crediting the reporter (if they consent).

## Out of Scope

- Reports requiring physical access to a victim's device
- Self-XSS that requires the victim to paste malicious JS into the console
- Social engineering, phishing, or attacks against humans
- Findings that don't have a working reproduction
- Theoretical vulnerabilities without demonstrable impact
