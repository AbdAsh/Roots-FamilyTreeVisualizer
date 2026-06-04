# Sub-project A — Design Foundation

**Date:** 2026-06-04 · **Branch:** `redesign/editorial-paper` · Part of the [redesign overview](2026-06-04-redesign-overview.md).

## Goal

Establish the **editorial-paper** visual language and light/dark theming, strip every "AI-generated"
tell, and restyle all **non-canvas** chrome. After A, the app looks intentional and human-made
everywhere except the tree nodes themselves, which are rebuilt in B.

## In scope

- Design tokens (OKLCH) for light + dark.
- Typography swap: Spectral + Hanken Grotesk.
- Theming infrastructure (`useTheme`, FOUC script, `data-theme`).
- Removal of AI tells.
- Restyle: header (`App.tsx`), `PassphraseScreen`, all UI primitives, modals, `Legend`, `LanguageSwitcher`.
- Walkthrough **copy**: passphrase concept line + `AboutModal` "How it works" rewrite.

## Out of scope (deferred to B)

- The tree node visuals and the `FamilyTreeView` canvas internals. A only ensures the canvas
  inherits theme tokens (background, link CSS vars); node chips are rebuilt in B.

## Anti-AI tell removal checklist

| Tell | Location | Fix |
|---|---|---|
| Decorative blur blobs | `PassphraseScreen.tsx` (the two `blur-3xl` divs) | Delete |
| Glassmorphism `backdrop-blur` | header (`App.tsx`), passphrase card, hint pill | Flat surfaces, no blur |
| Noise texture overlay | `.noise-bg::before` in `globals.css` | Delete the rule + all `noise-bg` usages |
| `pulse-glow` glow animation | `globals.css`, selection glow | Delete (selection becomes a hairline/accent ring in B) |
| Generic dark + bright amber | `@theme` tokens | Replace with warm-paper editorial palette |
| Playfair Display | `index.html`, `--font-display` | Spectral |
| Heavy `rounded-2xl shadow-2xl` floating cards | passphrase, modals | Hairline borders, minimal/no drop shadow |
| Gradient text / fills | any | None — flat ink only |

## Design tokens

Rewrite the `@theme` block in `src/styles/globals.css` to OKLCH. Default = **light**; a
`[data-theme="dark"]` block in `@layer base` overrides the same tokens. Keep the existing Tailwind
token **names** (`charcoal`, `charcoal-light`, `charcoal-lighter`, `amber`, `cream`, …) as
**semantic aliases** so the large surface area of existing `className`s keeps working and is
re-skinned centrally. (Renaming every utility class is out of scope and risky; we remap meaning,
not names. A follow-up cleanup may rename later.)

Semantic mapping (name → role):

| Token name (kept) | Role | Light value (approx) | Dark value (approx) |
|---|---|---|---|
| `charcoal` | page canvas (paper) | `oklch(97% .012 85)` | `oklch(20% .012 70)` |
| `charcoal-light` | raised surface (modal, header) | `oklch(99% .008 85)` | `oklch(25% .012 70)` |
| `charcoal-lighter` | hairline / border / input bg | `oklch(88% .010 80)` | `oklch(34% .012 70)` |
| `cream` | primary ink (text) | `oklch(28% .020 60)` | `oklch(93% .012 85)` |
| `amber` (accent alias) | **forest/olive accent** | `oklch(48% .07 145)` | `oklch(62% .08 145)` |
| `sage` | success/positive | keep green, retuned to palette | ditto |
| `error` | destructive | `oklch(55% .15 25)` | `oklch(68% .15 25)` |

- Text opacity steps (`text-cream/60`, `/40`, `/30`, `/25`, `/20`) continue to express
  secondary/tertiary ink — verify each resolves to **≥ WCAG AA** contrast on paper in both themes;
  bump the low steps if needed.
- `--font-display: "Spectral", Georgia, serif;` · `--font-body: "Hanken Grotesk", system-ui, sans-serif;`
- Introduce `--tree-*` CSS vars (text, dim, faint, ring, link tones) defined in `:root` and
  overridden under `[data-theme="dark"]`, ready for B's canvas. Tree link colors become **ink-toned**
  (one accent allowed for the selected path); differentiate relationship type by **dash/weight**, not hue.
- Focus ring: `2px solid` accent, offset 2px (keep `*:focus-visible`), retuned to the accent.

## Typography

- In `index.html`, replace the Google Fonts link: load **Spectral** (e.g. weights 400/500/600,
  plus italic for names if desired) and **Hanken Grotesk** (400/500/600/700). Keep `preconnect`.
- `font-display: swap`.
- Usage rule: Spectral for the wordmark, modal/section headings, and (in B) person names;
  Hanken Grotesk for everything else (labels, buttons, inputs, metadata, dates).

## Theming infrastructure

- **`src/hooks/useTheme.ts`** (new): Zustand or a small hook exposing `theme: 'light' | 'dark'`
  and `setTheme`/`toggle`. Resolution order: stored `localStorage["roots-theme"]` → else
  `matchMedia('(prefers-color-scheme: dark)')`. Applies `data-theme` to `document.documentElement`.
- **FOUC prevention:** inline `<script>` in `index.html <head>` (before the module script) that
  reads `localStorage["roots-theme"]` / system preference and sets `data-theme` before first paint.
- **Dynamic `theme-color`:** update the `<meta name="theme-color">` to match the active theme
  (paper in light, near-black in dark) — set by `useTheme` on change.
- **Toggle UI:** a quiet sun/moon (lucide) button in the header (`App.tsx`) and on the
  `PassphraseScreen` (top bar, near the language switcher).

## Component restyle list

- **`App.tsx` header** — remove `backdrop-blur`/translucency; hairline bottom border on paper;
  re-lay the wordmark (Spectral) + member count + save status; restyle search input, undo/redo,
  export bar trigger, language switcher, About/Share/Lock buttons; add theme toggle. Replace the
  one-off member-count hint pill (no glass).
- **`PassphraseScreen.tsx`** — **delete** the blur-blob layer and the glass card; lay out as a calm,
  centered editorial column on paper: Spectral wordmark, **one concept line** (walkthrough copy below),
  a single passphrase field (+ family name when creating), strength meter retuned, reset link, footer.
  No `rounded-2xl shadow-2xl`, no `backdrop-blur`, no decorative elements.
- **UI primitives** — `Button` (flat fills/ghost using accent sparingly), `Input`, `Select`,
  `TextArea` (paper fields, hairline borders, accent focus), `Modal` (centered, hairline, minimal
  shadow; the base for B's `DetailsModal`), `ConfirmModal`, `Badge`, `Avatar` (quiet gender tints —
  ink-leaning, not the saturated RGBA), `Legend` (ink link styles + dash/weight key), `LanguageSwitcher`,
  `Panel` (will be retired in B, but if A touches it, keep minimal — no need to invest).
- **`AboutModal.tsx`** — rewrite content (see walkthrough copy).
- **`ShareModal.tsx`** — restyle to match; copy unchanged except tone.

## Walkthrough copy (A's portion)

- **Passphrase concept line** (under the wordmark): *"Your whole family tree lives inside its own
  link, locked by a passphrase. No accounts, no servers — share the link and the passphrase, and
  someone can view or edit it."* (Localize into en/ar/tr.)
- **AboutModal "How it works"** — plain-language sections: what Roots is; how the link *is* the
  database; encryption (AES-256-GCM, passphrase never leaves the browser); sharing; export/import;
  languages; the 8 KB size note. No hype, no jargon walls.

## Implementation method

`/frontend-design:frontend-design` to set the component aesthetic, then `/impeccable:impeccable`
(`audit` + `polish`) for craft and an anti-AI pass.

## Success criteria

- None of the anti-AI tells remain (grep: no `noise-bg`, no `backdrop-blur`, no `blur-3xl`, no
  `pulse-glow`, no Playfair, no gradient text).
- Light/dark toggle works; reload preserves choice; **no flash** of the wrong theme.
- All non-canvas screens render in the editorial-paper style in both themes; contrast ≥ AA.
- Spectral + Hanken Grotesk load and apply.
- `npm run typecheck` and `npm run build` pass; i18n (en/ar/tr) and RTL layout intact.
