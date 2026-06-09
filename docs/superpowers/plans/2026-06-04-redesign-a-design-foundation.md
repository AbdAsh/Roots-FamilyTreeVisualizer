# Redesign A — Design Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the editorial-paper visual language with light/dark theming, remove every "AI-generated" tell, and restyle all non-canvas chrome — without touching tree nodes (rebuilt in B), crypto/URL, data model, or i18n behavior.

**Architecture:** Tailwind v4 `@theme` tokens are CSS custom properties; we re-skin centrally by (1) remapping the existing token *values* to an OKLCH editorial palette and (2) overriding those same `--color-*` variables under `[data-theme="dark"]`. A tiny Zustand `useTheme` store flips a `data-theme` attribute on `<html>`; an inline `<head>` script applies it before first paint. Existing Tailwind class names (`bg-charcoal`, `text-cream`, `text-amber`, …) are kept as semantic aliases so we re-skin without renaming hundreds of `className`s.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Zustand, Framer Motion, lucide-react, Vite 7.

**Spec:** `docs/superpowers/specs/2026-06-04-redesign-a-design-foundation.md`

**Branch:** `redesign/editorial-paper` (already created off `origin/main`). All commits land here.

---

## File map

- Modify: `src/styles/globals.css` — rewrite `@theme` tokens (OKLCH light), add `[data-theme="dark"]` overrides + `--tree-*` vars, delete `.noise-bg` and `pulse-glow`, retune focus ring/scrollbar/link classes.
- Modify: `index.html` — swap Google Fonts to Spectral + Hanken Grotesk, add FOUC theme script, keep `<meta name="theme-color">` (now updated at runtime).
- Create: `src/hooks/useTheme.ts` — theme store (light/dark/system), persists `roots-theme`, applies `data-theme` + `theme-color`.
- Modify: `src/app/App.tsx` — header de-glass + hairline + theme toggle button.
- Modify: `src/components/ui/PassphraseScreen.tsx` — delete blobs + glass card, editorial layout, concept line, theme toggle.
- Modify (restyle): `src/components/ui/{Button,Input,Select,TextArea,Modal,ConfirmModal,Badge,Avatar,Legend,LanguageSwitcher,ShareModal}.tsx`.
- Modify: `src/components/ui/AboutModal.tsx` — rewrite "How it works" copy.
- Modify: `src/lib/i18n.tsx` — add keys for concept line, About sections (en/ar/tr).

> **Note for visual tasks (A3, A4):** the restyle is taste-driven. Those tasks invoke `/frontend-design:frontend-design` then `/impeccable:impeccable` with the concrete acceptance criteria given. Do not hand-author "final" pixel values outside those skills; the criteria below are the contract.

---

## Task A1: Theme tokens + dark mode + remove texture/glow

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Replace the `@theme` block** with the editorial-paper light palette (keep token *names*).

```css
@import "tailwindcss";

/* ===== Editorial Paper — light is the default theme ===== */
@theme {
  /* Surfaces (warm paper) */
  --color-charcoal: oklch(0.972 0.012 85);        /* page canvas */
  --color-charcoal-light: oklch(0.992 0.008 85);  /* raised surface: modal, header */
  --color-charcoal-lighter: oklch(0.885 0.010 80);/* hairline / border / input bg */

  /* Ink (text) */
  --color-cream: oklch(0.28 0.020 60);            /* primary ink */
  --color-cream-dark: oklch(0.42 0.018 60);       /* secondary ink */

  /* Accent — forest / olive (used sparingly) */
  --color-amber: oklch(0.48 0.07 145);
  --color-amber-light: oklch(0.55 0.08 145);
  --color-amber-dark: oklch(0.42 0.07 145);

  /* Semantic */
  --color-sage: oklch(0.55 0.08 150);
  --color-sage-light: oklch(0.62 0.08 150);
  --color-sage-dark: oklch(0.46 0.08 150);
  --color-rust: oklch(0.55 0.10 45);
  --color-wine: oklch(0.48 0.10 18);
  --color-gold: oklch(0.62 0.09 80);
  --color-error: oklch(0.55 0.15 25);
  --color-error-light: oklch(0.92 0.05 25);

  /* Type */
  --font-display: "Spectral", Georgia, serif;
  --font-body: "Hanken Grotesk", system-ui, sans-serif;

  /* Tree canvas vars (consumed in B) */
  --tree-text: oklch(0.30 0.02 60);
  --tree-text-dim: oklch(0.46 0.018 60);
  --tree-text-faint: oklch(0.62 0.015 60);
  --tree-ring: oklch(0.48 0.07 145);
  --tree-ring-search: oklch(0.55 0.08 145);
  --tree-link: oklch(0.55 0.012 60);       /* ink-toned link */
  --tree-link-ref: oklch(0.68 0.010 60);   /* reference link (lighter) */
  --tree-surface: oklch(0.992 0.008 85);   /* node card bg */
}
```

- [ ] **Step 2: Add the dark override + base styles** in `@layer base` (replace the existing base block; delete `overflow:hidden` only if it breaks — keep as-is otherwise).

```css
@layer base {
  html {
    font-family: var(--font-body);
    color: var(--color-cream);
    background-color: var(--color-charcoal);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  body { min-height: 100dvh; overflow: hidden; }
  #root { min-height: 100dvh; }

  /* ===== Dark theme overrides ===== */
  [data-theme="dark"] {
    --color-charcoal: oklch(0.20 0.012 70);
    --color-charcoal-light: oklch(0.25 0.012 70);
    --color-charcoal-lighter: oklch(0.34 0.012 70);
    --color-cream: oklch(0.93 0.012 85);
    --color-cream-dark: oklch(0.80 0.012 85);
    --color-amber: oklch(0.66 0.09 145);
    --color-amber-light: oklch(0.74 0.09 145);
    --color-amber-dark: oklch(0.58 0.09 145);
    --color-error: oklch(0.68 0.15 25);

    --tree-text: oklch(0.90 0.012 85);
    --tree-text-dim: oklch(0.70 0.012 85);
    --tree-text-faint: oklch(0.52 0.012 85);
    --tree-ring: oklch(0.66 0.09 145);
    --tree-ring-search: oklch(0.74 0.09 145);
    --tree-link: oklch(0.62 0.012 85);
    --tree-link-ref: oklch(0.46 0.012 85);
    --tree-surface: oklch(0.25 0.012 70);
  }
}
```

- [ ] **Step 3: Delete the AI tells** — remove the entire `.noise-bg::before` rule and the `@keyframes pulse-glow` + `.animate-pulse-glow` rules. Retune `::-webkit-scrollbar-thumb:hover` to `var(--color-amber-dark)` (already references it — fine) and the focus ring `outline` stays `var(--color-amber)`.

- [ ] **Step 4: Retune link classes** (still used until B replaces them) to ink tones differentiated by dash/weight:

```css
.tree-link-parent-child { stroke: var(--tree-link); stroke-width: 1.4; fill: none; opacity: .8; }
.tree-link-spouse { stroke: var(--tree-link); stroke-width: 1.4; stroke-dasharray: 5 4; fill: none; opacity: .7; }
.tree-link-sibling { stroke: var(--tree-link); stroke-width: 1; stroke-dasharray: 1.5 3; fill: none; opacity: .6; }
```

- [ ] **Step 5: Remove `noise-bg` usages** — grep and delete the `noise-bg` class from `App.tsx` (root div) and `PassphraseScreen.tsx` (handled fully in A3, but remove the class token now to avoid a dangling no-op): `grep -rn "noise-bg" src/`. Remove the class string occurrences.

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`
Expected: build succeeds (Tailwind generates utilities from the new tokens). If it fails on an unknown utility, note which class and add the missing token alias.

- [ ] **Step 7: Commit**

```bash
git add src/styles/globals.css src/app/App.tsx src/components/ui/PassphraseScreen.tsx
git commit -m "feat(a): editorial-paper OKLCH tokens + dark overrides; remove noise/glow tells"
```

---

## Task A2: Fonts + FOUC script + theme-color in index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the Google Fonts `<link>`** (the Playfair + DM Sans line) with:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 2: Add the FOUC theme script** in `<head>`, immediately after the `<meta name="theme-color">` line:

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem('roots-theme');
      if (t !== 'light' && t !== 'dark') {
        t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', t);
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', t === 'dark' ? '#211e1a' : '#f6f3ec');
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
</script>
```

- [ ] **Step 3: Verify** — `npm run dev`, open the app, confirm the page renders on warm paper (light) with Spectral wordmark / Hanken body, no console errors. Toggle OS dark mode + clear `localStorage` to confirm system preference is honored on first load.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(a): load Spectral + Hanken Grotesk; FOUC-safe theme bootstrap"
```

---

## Task A3 was split: A3a (theme store), A3b (toggle wiring)

## Task A3a: `useTheme` store

**Files:**
- Create: `src/hooks/useTheme.ts`

- [ ] **Step 1: Write the hook**

```ts
/**
 * Theme store: light/dark with system-preference fallback.
 * The initial value is read from the `data-theme` attribute the inline
 * index.html bootstrap already set (avoids a flash), falling back to
 * localStorage / prefers-color-scheme. Applying a theme writes the
 * attribute, the persisted key, and the address-bar theme-color.
 */
import { create } from 'zustand';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'roots-theme';
const META_LIGHT = '#f6f3ec';
const META_DARK = '#211e1a';

function readInitial(): Theme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === 'light' || s === 'dark') return s;
  } catch { /* ignore */ }
  if (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function apply(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? META_DARK : META_LIGHT);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readInitial(),
  setTheme: (t) => { apply(t); set({ theme: t }); },
  toggle: () => { const n: Theme = get().theme === 'dark' ? 'light' : 'dark'; apply(n); set({ theme: n }); },
}));
```

- [ ] **Step 2: Typecheck** — `npm run typecheck` → passes.
- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTheme.ts
git commit -m "feat(a): useTheme store (light/dark, persisted, theme-color sync)"
```

## Task A3b: Wire the theme toggle

**Files:**
- Modify: `src/app/App.tsx` (header action group), `src/components/ui/PassphraseScreen.tsx` (top bar).

- [ ] **Step 1:** In `App.tsx`, import `Sun, Moon` from `lucide-react` and `useThemeStore`. Add a ghost `Button` in the header action row (near About/Share/Lock) that calls `toggle()` and shows `Moon` in light mode / `Sun` in dark mode, with an `aria-label` (localized: "Switch to dark/light theme"). Use the existing `Button variant="ghost" size="sm"`.
- [ ] **Step 2:** In `PassphraseScreen.tsx`, add the same toggle button to the top bar beside the `LanguageSwitcher` (top-right).
- [ ] **Step 3: Verify** — toggling flips the whole app (paper↔ink), reload preserves the choice, address-bar color updates, no flash on reload.
- [ ] **Step 4: Commit**

```bash
git add src/app/App.tsx src/components/ui/PassphraseScreen.tsx
git commit -m "feat(a): theme toggle in header and passphrase screen"
```

---

## Task A4: Restyle chrome to editorial paper (frontend-design + impeccable)

> This is the taste-driven core. Execute by invoking the design skills with the scope and acceptance criteria below.

**Files (restyle only — no logic changes):** `App.tsx` header; `PassphraseScreen.tsx`; `ui/Button.tsx`, `Input.tsx`, `Select.tsx`, `TextArea.tsx`, `Modal.tsx`, `ConfirmModal.tsx`, `Badge.tsx`, `Avatar.tsx`, `Legend.tsx`, `LanguageSwitcher.tsx`, `ShareModal.tsx`.

- [ ] **Step 1: Invoke `/frontend-design:frontend-design`** scoped to "restyle the non-canvas chrome of Roots to the editorial-paper system" with these **hard requirements**:
  - Use only the A1 tokens (`bg-charcoal`/`charcoal-light`/`charcoal-lighter`, `text-cream`, `text-amber` accent). No new hardcoded hex/rgba.
  - **No** `backdrop-blur`, `blur-3xl`, glass translucency, drop-shadow-heavy cards (`shadow-2xl`), gradients, or noise.
  - Surfaces are flat paper with **hairline borders** (`border-charcoal-lighter`); accent only on primary action / links / focus.
  - Spectral (`font-display`) for wordmark + headings; Hanken (`font-body`) elsewhere.
  - **`PassphraseScreen`:** remove the blur-blob layer and the floating card entirely; lay out as a calm centered editorial column on the page canvas (wordmark, concept line [A5], single field column, retuned strength meter, reset link, footer). Keep all existing handlers/props/state.
  - **Header:** remove translucency/blur; hairline bottom border; keep all controls and behavior.
  - Generous whitespace; restrained type scale.
- [ ] **Step 2: Invoke `/impeccable:impeccable audit`** on the changed screens; fix all **P0/P1** findings. Specifically verify **WCAG AA contrast** for every `text-cream/NN` opacity step on paper in **both** themes; bump low steps (raise opacity or use `cream-dark`) where they fail.
- [ ] **Step 3: Invoke `/impeccable:polish`** for final alignment/spacing/consistency.
- [ ] **Step 4: Verify acceptance**
  - `grep -rn "backdrop-blur\|blur-3xl\|shadow-2xl\|noise-bg\|pulse-glow\|Playfair\|DM Sans" src/ index.html` → **no matches** (except intentional none).
  - Light and dark both look intentional; no card-in-card; no decorative elements.
  - `npm run typecheck && npm run build` pass.
- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat(a): restyle chrome to editorial paper (frontend-design + impeccable)"
```

---

## Task A5: Walkthrough copy — concept line + About rewrite (i18n)

**Files:**
- Modify: `src/lib/i18n.tsx` (add keys to en/ar/tr), `src/components/ui/PassphraseScreen.tsx` (render concept line), `src/components/ui/AboutModal.tsx` (render new sections).

- [ ] **Step 1: Add i18n keys.** In `i18n.tsx`, add under `auth`: `conceptLine`. Under a new/`about` group: `whatTitle/whatBody`, `linkTitle/linkBody`, `cryptoTitle/cryptoBody`, `shareTitle/shareBody`, `exportTitle/exportBody`, `langTitle/langBody`, `sizeNote`. English values:
  - `auth.conceptLine`: "Your whole family tree lives inside its own link, locked by a passphrase. No accounts, no servers."
  - `about.whatTitle`: "What is Roots?" / `whatBody`: "A private family-tree maker that runs entirely in your browser."
  - `about.linkTitle`: "The link is the database" / `linkBody`: "Your tree is compressed and packed into the page link itself — there's no server storing it."
  - `about.cryptoTitle`: "Encrypted with your passphrase" / `cryptoBody`: "The link is encrypted with AES-256-GCM. Your passphrase never leaves your browser; without it the link is unreadable."
  - `about.shareTitle`: "Sharing" / `shareBody`: "Send someone the link and the passphrase and they can view or edit the tree. Changes live only in their copy of the link."
  - `about.exportTitle`: "Export & import" / `exportBody`: "Save your tree as JSON, PNG, or SVG, and import JSON back."
  - `about.langTitle`: "Languages" / `langBody`: "English, Arabic (right-to-left), and Turkish."
  - `about.sizeNote`: "Because the whole tree fits in a link, very large trees may hit a size limit."
  
  Provide Arabic + Turkish translations for each (mirror the English meaning; the maintainer can refine). For `auth.conceptLine`:
  - ar: "شجرة عائلتك بأكملها موجودة داخل رابطها الخاص، محمية بعبارة مرور. بلا حسابات، بلا خوادم."
  - tr: "Tüm aile ağacın kendi bağlantısının içinde yaşar, bir parolayla kilitlenir. Hesap yok, sunucu yok."
  (Translate the `about.*` strings similarly for ar/tr.)

- [ ] **Step 2: Render concept line** in `PassphraseScreen` under the wordmark (`strings.auth.conceptLine`), styled as quiet secondary ink, max-width readable measure.
- [ ] **Step 3: Rewrite `AboutModal`** body to render the seven `about.*` title/body sections (plain, scannable; Spectral subheads, Hanken body) + the size note as a small footnote. Remove any hype/jargon.
- [ ] **Step 4: Verify** — open About in en/ar/tr; RTL lays out correctly; concept line shows on the passphrase screen.
- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.tsx src/components/ui/PassphraseScreen.tsx src/components/ui/AboutModal.tsx
git commit -m "feat(a): concept line + plain-language About copy (en/ar/tr)"
```

---

## Task A6: Final verification of A

- [ ] **Step 1:** `npm run typecheck` → pass.
- [ ] **Step 2:** `npm run build` → pass.
- [ ] **Step 3: Manual** — `npm run dev`: passphrase screen (create + unlock), header, modals (About/Share/Confirm), language switch (incl. Arabic RTL), theme toggle + reload (no flash) all render in editorial paper, light and dark. The tree canvas still renders (old SVG nodes, now ink links) — that's expected; nodes are rebuilt in B.
- [ ] **Step 4:** Confirm the anti-AI grep from A4 Step 4 is clean.
- [ ] **Step 5: Commit** any fixups.

**A is done when:** all six tasks complete, greps clean, both themes pass AA, typecheck+build green.
