# Copilot Instructions — Roots (FamilyTreeVisualizer)

## Project Overview

Roots is a **zero-backend, client-only** family tree visualizer. The entire family tree is encrypted, Brotli-compressed, and stored in the **URL hash** — there is no database, no server, no accounts. Users share trees by sharing the URL + a passphrase.

**Stack:** React 19, TypeScript (strict), Zustand, D3 (layout math only), Framer Motion, Tailwind CSS v4, Vite 7, Zod validation. Path alias `@/` → `src/`.

## Architecture & Data Flow

```
URL hash (base64url) ←→ AES-GCM encrypt/decrypt ←→ Brotli compress/decompress ←→ JSON (FamilyTree)
```

- **Data pipeline** (`src/lib/url.ts`): `JSON → compress → encrypt → base64url → hash` on save; reverse on load. Compression happens _before_ encryption (encrypted bytes don't compress).
- **State** (`src/hooks/useTree.ts`): Single Zustand store holds the `FamilyTree`, selection state, and an undo/redo stack (serialized JSON snapshots, max 50). All mutations call `pushSnapshot()` before changing state.
- **Auth** (`src/hooks/useAuth.ts`): Passphrase unlocks the URL hash; kept in memory only. Brute-force throttle with exponential backoff lives in `src/lib/passphrase.ts`.
- **Auto-save** (`src/hooks/useSave.ts`): Debounced (400ms) write back to `window.location.hash` whenever the tree changes.
- **Crypto** (`src/lib/crypto.ts`): AES-256-GCM via Web Crypto API, PBKDF2 with 600k iterations. Wire format: `[16B salt][12B IV][ciphertext]`.

### Key Data Types (`src/types/family.ts`)

- `FamilyMember` — id, name, gender (`male|female|other|unknown`), dates, customFields
- `Relationship` — `{ id, type: 'parent-child'|'spouse'|'sibling', from, to }` (from=parent for parent-child)
- `FamilyTree` — members[], relationships[], rootMemberId

## Layout Engine (`src/lib/tree-utils.ts`)

`computeTieredLayout()` is the core layout algorithm: Uses the **Buchheim–Reingold–Tilford** algorithm (O(n) tree layout via contour comparison) with **couple containers**:

1. BFS from `rootMemberId` assigns generation tiers (0=root, negative=ancestors, positive=descendants). Edges are prioritised: parent-child first, then spouse, then sibling.
2. The layout tree is built from **parent-child edges only** — sibling edges are purely visual and never create tree-hierarchy links. Spouse pairs are merged into single "couple container" units.
3. `firstWalk` (post-order) assigns preliminary x + mod via contour comparison (`apportion`). Node separation uses `sep(left, right)` which accounts for each couple container's width.
4. `secondWalk` (pre-order) accumulates mod for final x; `thirdWalk` shifts for non-negative x
5. Positions are scaled to pixels; spouses offset by `SPOUSE_OFFSET`
6. Orphan nodes (reachable only via sibling edges) are placed adjacent to their peer post-Buchheim.

**Guarantees:** parents centred over children, subtrees never overlap, identical subtrees drawn identically, middle siblings evenly spaced.

Constants: `TIER_GAP=180`, `COL_GAP=200`, `SPOUSE_OFFSET=120`

The renderer (`src/components/tree/RadialTree.tsx`) uses raw SVG — no D3 selections. Pan/zoom is manual via transform refs, not D3-zoom. Link paths use cubic beziers for parent-child, quadratic arcs for siblings, straight lines for spouses.

## i18n (`src/lib/i18n.tsx`)

Three locales: `en`, `ar` (RTL), `tr`. All UI strings are in the `Translations` interface with strongly-typed keys. Interpolation uses `t(template, { key: value })` and `tPlural(template, count)` — plural forms separated by `||` (e.g. `"{count} member||{count} members"`).

## UI Conventions

- **Color palette** in `src/styles/globals.css` as `@theme` custom properties: charcoal backgrounds, amber accents, cream text, sage/wine/rust for relationship types
- **Fonts:** Playfair Display (display/headings), DM Sans (body) — loaded via Google Fonts in `index.html`
- Components use Tailwind utility classes; no CSS modules
- Icons: `lucide-react` exclusively
- Animations: Framer Motion for panels/modals; CSS keyframes for subtle effects (shake, fade-in, pulse-glow)
- The `Panel` component slides in from the right using Framer Motion; z-index layering: header=`z-10`, panel backdrop=`z-30`, panel=`z-20`

## Component Patterns

- **UI primitives** (`src/components/ui/`): `Button`, `Input`, `Select`, `TextArea`, `Modal`, `Panel`, `Badge`, etc. — prefer reusing these
- **Editor panels** (`src/components/editor/`): `EditPanel` (member details + relationships), `AddModal`/`AddRelativeForm` (adding relatives with inferred relationship suggestions)
- **Tree rendering** (`src/components/tree/RadialTree.tsx`): Single SVG-based component, all interaction (click, pan, zoom, delete) handled in callbacks
- `getInferredRelationships()` in tree-utils auto-suggests additional relationships (e.g. adding a child also suggests sibling links to existing children)

## Dev Workflow

```bash
npm run dev      # Vite dev server
npm run build    # Production build
npm run preview  # Preview production build
```

No test framework is configured. No linter config beyond TypeScript strict mode. Deployment target is Netlify (see `public/_redirects`).

## Export / Import (`src/components/ui/ExportImportBar.tsx`)

- **JSON export/import:** Raw `FamilyTree` object. Import replaces the current tree (with confirmation).
- **PNG/SVG export:** Renders the `#tree-svg` element. PNG uses `canvas.toBlob()`; SVG serializes the DOM node.

## Critical Constraints

- **URL size limit:** ~8KB max hash (`MAX_HASH_BYTES`). All tree data must fit after compression+encryption. Be mindful when adding fields to `FamilyMember`.
- **No server calls:** Everything runs in the browser. Web Crypto API and Brotli WASM are the only non-trivial runtime deps.
- **Brotli WASM** is excluded from Vite's `optimizeDeps` to avoid bundling issues.
- Relationship semantics: `from`=parent, `to`=child for `parent-child`. Spouse/sibling are symmetric but stored with a canonical direction. `hasDuplicate()` in useTree checks both directions for symmetric types.

## Contributing

Solo project, open-source. When submitting changes:

- Run `npm run build` to verify no TypeScript errors before committing.
- Keep all state mutations in `useTree.ts`; always call `pushSnapshot()` before mutating so undo/redo stays consistent.
- New UI strings must be added to all three locale objects (`en`, `ar`, `tr`) in `src/lib/i18n.tsx` — the `Translations` interface enforces this at compile time.
