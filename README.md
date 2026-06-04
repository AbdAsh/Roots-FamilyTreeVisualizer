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
- **Interactive tree visualization** — union-aware layered layout: derives unions/couples from relationships, assigns generations, lays out each connected component with a contour packing, and draws cross-links (cycles, extra parents) as reference edges; pan/zoom, smooth animations
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

### Why compress _before_ encrypting?

Encrypted bytes have maximum entropy and don't compress well. By compressing the raw JSON first (which is highly compressible), we get the best size reduction before encryption makes the data incompressible.

### Encryption Details

| Parameter      | Value                                      |
| -------------- | ------------------------------------------ |
| Algorithm      | AES-256-GCM                                |
| Key derivation | PBKDF2 with 600,000 iterations             |
| Salt           | 16 bytes (random, prepended to ciphertext) |
| IV             | 12 bytes (random, prepended after salt)    |
| Wire format    | `[16B salt][12B IV][ciphertext]`           |

### Layout Algorithm

The tree visualization uses a **union-aware layered layout** implemented in pure TypeScript (`src/lib/layout/`):

1. **Build unions** (`unions.ts`) — derives unions from `relationships`: co-parents who share ≥1 child form a union; childless spouse pairs form a union with no children; a person may belong to multiple unions (remarriage, co-parenting); single and unmarried co-parents are handled naturally.
2. **Tier assignment** (`tiers.ts`) — longest-path layering over a spanning DAG; both partners of a union share a tier; cycle edges are excluded from tiering and emitted as reference links instead of breaking the layout.
3. **Connected components** (`components.ts`) — partitions the layout graph so disconnected branches still render, packed side-by-side with a clear gap.
4. **Per-component layout** (`layout.ts`) — a Buchheim–Reingold–Tilford contour pass over an alternating person/union tree: union nodes are virtual couple anchors; partners straddle the union centre; children are centred underneath. Components are then packed left-to-right and the whole layout is centred.
5. **Reference links** — cycle edges and extra-parent edges (a child's parents beyond its positioning union) are marked `kind: 'reference'` so the renderer can draw them distinctly without affecting positions.

**Handles:** multiple marriages / half-siblings (grouped per union), single parents, unmarried co-parents, both-sided ancestors, disconnected branches, cycles (drawn as reference links), and adoption (>2 parents). Covered by a Vitest fixture suite (24 tests, `npm test`).

## Tech Stack

| Layer       | Technology                                      |
| ----------- | ----------------------------------------------- |
| Framework   | React 19                                        |
| Language    | TypeScript (strict)                             |
| State       | Zustand                                         |
| Layout math | Pure TypeScript (union-aware layered engine)    |
| Animation   | Framer Motion                                   |
| Styling     | Tailwind CSS v4                                 |
| Theming     | Light/dark via CSS custom properties (OKLCH)    |
| Build       | Vite 7                                          |
| Validation  | Zod                                             |
| Testing     | Vitest                                          |
| Compression | Brotli (WASM)                                   |
| Encryption  | Web Crypto API                                  |

## Design

Roots uses an **editorial-paper aesthetic** — Spectral (serif) for headings, Hanken Grotesk for body text, and an OKLCH terracotta palette. A light/dark theme toggle is available in the header and persists across sessions via `localStorage`.

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
npm test             # Run Vitest layout fixture suite
```

## Project Structure

```
src/
├── app/
│   └── App.tsx              # Root component — header, canvas, modals
├── components/
│   ├── editor/              # DetailsModal + MemberForm (in-canvas editing)
│   ├── tree/
│   │   ├── FamilyTreeView.tsx  # SVG canvas renderer (pan/zoom/interactions)
│   │   ├── NodeCard.tsx        # Expand-to-card node with inline add form
│   │   ├── AddAffordances.tsx  # +parent / +child / +spouse / +sibling buttons
│   │   └── EdgeLayer.tsx       # Primary + reference link rendering
│   └── ui/                  # Reusable UI primitives (Button, Modal, etc.)
├── hooks/
│   ├── useAuth.ts           # Passphrase auth (Zustand store)
│   ├── useKeyboardShortcuts.ts
│   ├── useSave.ts           # Auto-save (debounced hash write)
│   └── useTree.ts           # Tree state + undo/redo (Zustand store)
├── lib/
│   ├── compression.ts       # Brotli WASM compress/decompress
│   ├── crypto.ts            # AES-256-GCM encrypt/decrypt via Web Crypto
│   ├── i18n.tsx             # Translations (en, ar, tr) + context
│   ├── layout/              # Union-aware layout engine + Vitest fixtures
│   │   ├── unions.ts        #   Derive unions from relationships
│   │   ├── tiers.ts         #   Longest-path tier assignment + cycle detection
│   │   ├── components.ts    #   Connected-component partitioning
│   │   └── layout.ts        #   BRT contour pass + component packing
│   ├── passphrase.ts        # Strength scoring + brute-force throttle
│   ├── tree-utils.ts        # Relationship queries + layout entry (delegates to lib/layout)
│   ├── url.ts               # Save/load pipeline (JSON ↔ compress ↔ encrypt ↔ hash)
│   └── validation.ts        # Zod schemas for all data types
├── styles/
│   └── globals.css          # Tailwind v4 theme + OKLCH custom properties
└── types/
    └── family.ts            # Core data types (FamilyMember, Relationship, FamilyTree)
```

## Key Constraints

- **URL size limit:** ~8 KB max hash (`MAX_HASH_BYTES`). All tree data must fit after compression + encryption.
- **No server calls:** Everything runs in the browser. Web Crypto API and Brotli WASM are the only non-trivial runtime dependencies.
- **Brotli WASM** is excluded from Vite's `optimizeDeps` to avoid bundling issues.
- **Relationship semantics:** `from` = parent, `to` = child for `parent-child` type. Spouse/sibling are symmetric but stored with a canonical direction.

## Deployment

Roots is deployed on [Cloudflare Pages](https://pages.cloudflare.com/). The `wrangler.jsonc` config points to the `dist/` build output. To deploy:

```bash
npm run build
npx wrangler pages deploy
```

The `public/_redirects` file handles SPA routing for Cloudflare Pages (and Netlify). Any static hosting service works — just ensure all paths resolve to `index.html`.

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
