# Security Policy

## Reporting a Vulnerability

Roots handles **client-side encryption** of family data using AES-256-GCM via the Web Crypto API. Security is critical to this project.

If you discover a security vulnerability — especially anything related to the encryption pipeline, key derivation, or data exposure — please report it responsibly.

### How to Report

**Email:** [abdulrahmanmahmutoglu@gmail.com](mailto:abdulrahmanmahmutoglu@gmail.com)

Please include:

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Potential impact** (data exposure, bypass, etc.)
4. **Suggested fix** (if you have one)

### What to Expect

- **Acknowledgment** within 48 hours
- **Assessment** within one week
- **Fix or mitigation** as soon as feasible, with credit to the reporter (unless anonymity is preferred)

### Please Do NOT

- Open a public GitHub issue for security vulnerabilities
- Share exploit details publicly before a fix is available
- Attempt to access other users' encrypted data

## Security Architecture

For context, here is how Roots handles encryption:

| Component | Detail |
| --- | --- |
| Algorithm | AES-256-GCM (authenticated encryption) |
| Key derivation | PBKDF2, 600,000 iterations, SHA-256 |
| Salt | 16 bytes, randomly generated per save |
| IV | 12 bytes, randomly generated per save |
| Wire format | `[16B salt][12B IV][ciphertext]` |
| Storage | URL hash only (no server, no cookies, no localStorage for tree data) |
| Passphrase | Kept in memory only; cleared on lock |
| Brute-force protection | Exponential backoff throttle on failed attempts |

All cryptographic operations use the **Web Crypto API** — no custom crypto implementations.

## Scope

The following are in scope for security reports:

- Weaknesses in the encryption/decryption pipeline
- Key derivation issues (insufficient iterations, weak salt handling)
- Data leakage (tree data appearing in localStorage, cookies, network requests, etc.)
- Brute-force throttle bypass
- XSS or injection attacks that could expose decrypted data

## Supported Versions

| Version                | Supported   |
| ---------------------- | ----------- |
| Latest (`main` branch) | Yes         |
| Older releases         | Best-effort |
