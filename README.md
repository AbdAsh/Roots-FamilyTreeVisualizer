<p align="center">
  <img src="public/favicon.svg" width="80" alt="Roots logo" />
</p>

<h1 align="center">Roots — Family Tree Visualizer</h1>

<p align="center">
  <strong>Zero-backend, encrypted family tree visualizer stored entirely in the URL.</strong><br />
  No accounts. No servers. No tracking. Just share a link + passphrase.
</p>

<p align="center">
  <a href="https://roots.abdash.net">Live Demo</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/react-19-61dafb?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/typescript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript Strict" />
  <img src="https://img.shields.io/badge/tailwind-v4-06b6d4?logo=tailwindcss&logoColor=white" alt="Tailwind v4" />
  <img src="https://img.shields.io/badge/vite-7-646cff?logo=vite&logoColor=white" alt="Vite 7" />
</p>

---

## Features

- **Completely client-side** — no server, no database, no accounts
- **End-to-end encrypted** — AES-256-GCM via the Web Crypto API; PBKDF2 with 600k iterations
- **URL-as-database** — the entire family tree is Brotli-compressed, encrypted, and stored in the URL hash
- **Share by link** — give someone the URL + passphrase and they can view & edit the tree
- **Interactive tree visualization** — Buchheim-Reingold-Tilford layout algorithm with couple containers, pan/zoom, smooth animations
- **Relationship types** — parent-child, spouse, and sibling relationships with auto-inferred suggestions
- **Multilingual** — English, Arabic (RTL), and Turkish
- **Export/Import** — JSON, PNG, and SVG export; JSON import
- **Undo/Redo** — full history stack (up to 50 snapshots)
- **Privacy-first** — data never leaves your browser; passphrase kept in memory only

## How It Works

Roots stores the entire family tree in the URL fragment (hash). The data pipeline runs entirely in the browser:

```
┌──────────┐     ┌────────────────┐     ┌─────────────────┐     ┌────────────┐     ┌──────────┐
│  JSON    │────▸│  Brotli        │────▸│  AES-256-GCM    │────▸│  Base64url │────▸│  URL     │
│ (Family  │     │  Compress      │     │  Encrypt        │     │  Encode    │     │  Hash    │
│  Tree)   │     │  (WASM, q=11)  │     │  (Web Crypto)   │     │            │     │  #...    │
└──────────┘     └────────────────┘     └─────────────────┘     └────────────┘     └──────────┘
```

**Loading reverses the pipeline:** `URL hash → base64url decode → AES-GCM decrypt → Brotli decompress → JSON`

### Why compress *before* encrypting?

Encrypted bytes have maximum entropy and don't compress well. By compressing the raw JSON first (which is highly compressible), we get the best size reduction before encryption makes the data incompressible.

### Encryption Details

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key derivation | PBKDF2 with 600,000 iterations |
| Salt | 16 bytes (random, prepended to ciphertext) |
| IV | 12 bytes (random, prepended after salt) |
| Wire format | `[16B salt][12B IV][ciphertext]` |

### Layout Algorithm

The tree visualization uses the **Buchheim-Reingold-Tilford** algorithm — an O(n) tree layout via contour comparison:

1. **BFS from root** assigns generation tiers (0 = root, negative = ancestors, positive = descendants)
2. **Couple containers** merge spouse pairs into single layout units
3. **First walk** (post-order) assigns preliminary x-positions via contour comparison (`apportion`)
4. **Second walk** (pre-order) accumulates modifiers for final x-coordinates
5. **Third walk** shifts everything to non-negative x

**Guarantees:** parents centered over children, subtrees never overlap, identical subtrees drawn identically, middle siblings evenly spaced.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Language | TypeScript (strict) |
| State | Zustand |
| Layout math | D3 (hierarchy only — no D3 selections/DOM) |
| Animation | Framer Motion |
| Styling | Tailwind CSS v4 |
| Build | Vite 7 |
| Validation | Zod |
| Compression | Brotli (WASM) |
| Encryption | Web Crypto API |

## Getting Started

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm 9+

### Installation

```bash
git clone https://github.com/AbdAsh/FamilyTreeVisualizer.git
cd FamilyTreeVisualizer
npm install
```

### Development

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build with TypeScript checking
npm run preview      # Preview the production build locally
npm run typecheck    # Run TypeScript compiler without emitting
```

## Project Structure

```
src/
├── app/
│   └── App.tsx              # Root component — header, tree, panels
├── components/
│   ├── editor/              # Edit panel, add-relative modal/form
│   ├── tree/
│   │   └── FamilyTreeView.tsx  # SVG tree renderer (pan/zoom/interactions)
│   └── ui/                  # Reusable UI primitives (Button, Modal, Panel, etc.)
├── hooks/
│   ├── useAuth.ts           # Passphrase auth (Zustand store)
│   ├── useKeyboardShortcuts.ts
│   ├── useSave.ts           # Auto-save (debounced hash write)
│   └── useTree.ts           # Tree state + undo/redo (Zustand store)
├── lib/
│   ├── compression.ts       # Brotli WASM compress/decompress
│   ├── crypto.ts            # AES-256-GCM encrypt/decrypt via Web Crypto
│   ├── i18n.tsx             # Translations (en, ar, tr) + context
│   ├── passphrase.ts        # Strength scoring + brute-force throttle
│   ├── tree-utils.ts        # Buchheim-Reingold-Tilford layout + helpers
│   ├── url.ts               # Save/load pipeline (JSON ↔ compress ↔ encrypt ↔ hash)
│   └── validation.ts        # Zod schemas for all data types
├── styles/
│   └── globals.css          # Tailwind v4 theme + custom properties
└── types/
    └── family.ts            # Core data types (FamilyMember, Relationship, FamilyTree)
```

## Key Constraints

- **URL size limit:** ~8 KB max hash (`MAX_HASH_BYTES`). All tree data must fit after compression + encryption.
- **No server calls:** Everything runs in the browser. Web Crypto API and Brotli WASM are the only non-trivial runtime dependencies.
- **Brotli WASM** is excluded from Vite's `optimizeDeps` to avoid bundling issues.
- **Relationship semantics:** `from` = parent, `to` = child for `parent-child` type. Spouse/sibling are symmetric but stored with a canonical direction.

## Deployment

Roots is deployed on [Netlify](https://www.netlify.com/). The `public/_redirects` file handles SPA routing. Any static hosting service works — just ensure all paths resolve to `index.html`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines, code conventions, and how to submit changes.

## Security

For reporting security vulnerabilities (especially crypto-related), see [SECURITY.md](SECURITY.md).

## License

This project is licensed under the Apache License 2.0 — see [LICENSE](LICENSE) for details.

## Author

**Abdulrahman Mahmutoglu** — Senior Frontend Engineer

- Website: [abdash.net](https://abdash.net)
- GitHub: [@AbdAsh](https://github.com/AbdAsh)
- LinkedIn: [abdash](https://linkedin.com/in/abdash)
