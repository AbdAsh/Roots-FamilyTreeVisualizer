# Contributing to Roots

Thank you for your interest in contributing to Roots! This document provides guidelines and information to help you get started.

## Development Setup

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm 9+

### Getting Started

```bash
git clone https://github.com/AbdAsh/FamilyTreeVisualizer.git
cd FamilyTreeVisualizer
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

### Available Scripts

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start the development server        |
| `npm run build`     | Type-check and build for production |
| `npm run preview`   | Preview the production build        |
| `npm run typecheck` | Run TypeScript compiler (no emit)   |

## Project Architecture

Roots is a **zero-backend, client-only** SPA. There is no database, no server, no accounts. The entire family tree is encrypted, compressed, and stored in the URL hash.

```
src/
├── app/           → Root component (App.tsx)
├── components/    → React components (editor/, tree/, ui/)
├── hooks/         → Zustand stores and custom hooks
├── lib/           → Core logic (crypto, compression, layout, i18n)
├── styles/        → Tailwind v4 theme
└── types/         → TypeScript type definitions
```

Path alias: `@/` resolves to `src/`.

## Code Conventions

### State Management

- All application state lives in **Zustand stores** (`useTree.ts`, `useAuth.ts`).
- **Always call `pushSnapshot()` before mutating the tree** so undo/redo stays consistent.
- Never mutate state directly — always use the store's action functions.

### TypeScript

- **Strict mode** is enabled with `noUnusedLocals` and `noUnusedParameters`.
- All data structures are defined in `src/types/family.ts` and validated with **Zod schemas** in `src/lib/validation.ts`.
- Use the `@/` path alias for imports from `src/`.

### Styling

- **Tailwind CSS v4** utility classes only — no CSS modules.
- The colour palette is defined as `@theme` custom properties in `src/styles/globals.css`.
- Fonts: **Playfair Display** (headings), **DM Sans** (body).
- Icons: **lucide-react** exclusively.

### Internationalisation (i18n)

The app supports **three locales**: English (`en`), Arabic (`ar`, RTL), and Turkish (`tr`).

- All UI strings are defined in the `Translations` interface in `src/lib/i18n.tsx`.
- **New strings must be added to all three locale objects** — TypeScript will error if any locale is missing a key.
- Interpolation: `t(template, { key: value })` for `{key}` placeholders.
- Plurals: `tPlural(template, count)` — templates use `||` separator: `"{count} member||{count} members"`.

### Components

- Reusable UI primitives live in `src/components/ui/` — **prefer reusing** `Button`, `Input`, `Select`, `Modal`, `Panel`, etc.
- Animation: **Framer Motion** for panels/modals; CSS keyframes for subtle effects.

### Relationships

- `from` = parent, `to` = child for `parent-child` relationships.
- Spouse and sibling relationships are **symmetric** but stored with a canonical direction. `hasDuplicate()` in `useTree.ts` checks both directions.

## Submitting Changes

### Before You Commit

1. **Run `npm run build`** — this type-checks the entire project and builds for production. There should be zero errors.
2. Test your changes in the browser — create a tree, add members, verify the feature works.
3. Check that the URL-based save/load cycle works (lock → unlock with same passphrase).

### Pull Request Process

1. Fork the repository and create a feature branch from `main`.
2. Make your changes with clear, descriptive commit messages.
3. Ensure `npm run build` passes with no errors.
4. Open a pull request describing:
   - What the change does
   - Why it's needed
   - Any trade-offs or limitations

### Important Constraints

- **URL size limit:** ~8 KB max. Be mindful when adding fields to `FamilyMember` — every byte counts after compression + encryption.
- **No server dependencies:** Everything must work client-side only.
- **Brotli WASM** is excluded from Vite's `optimizeDeps` — don't change this.

## Reporting Issues

Use [GitHub Issues](https://github.com/AbdAsh/FamilyTreeVisualizer/issues) to report bugs or suggest features. For security vulnerabilities, see [SECURITY.md](SECURITY.md).

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
