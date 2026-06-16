# Anervea — Design System

A portable specification of the **warm editorial** theme used in the Pharma Pricing
Simulator, written so the same look can be rebuilt on any platform (web, iOS,
Android, Figma). Values are given as raw tokens (hex, px/rem) — not framework code —
so they translate anywhere.

> Machine-readable companion: [`design-tokens.json`](./design-tokens.json) (W3C
> Design Tokens / DTCG format — consumable by Figma Tokens, Style Dictionary, etc.).

---

## 1. Design principles

1. **Warm & editorial.** Cream paper background, terracotta/rust accents, and a serif
   display face — reads like a printed intelligence report, not a SaaS dashboard.
2. **Quiet surfaces, confident accents.** Cards are calm (white on cream, hairline
   warm borders); colour is spent only on actions, headings, and data.
3. **Serif headlines, sans body.** Personality in the headings and KPI numbers;
   neutral, legible Inter for everything functional.
4. **Data is colour-coded by meaning,** not decoration (references = blue,
   referenced-by = terracotta, ceiling = blue, floor = orange, etc.).

---

## 2. Colour

### 2.1 Primitive palette

**Warm neutrals (paper / surfaces / borders)**

| Token | Hex | Use |
|---|---|---|
| `cream` | `#faf5ee` | App background |
| `surface` | `#ffffff` | Cards, top bar, popovers |
| `surface-raised` | `#fffdfa` | Controls on cream (zoom buttons) |
| `panel` | `#f3ede1` | Sidebar / left rail |
| `muted` | `#f5efe4` | Subtle fills, table headers, inset cards |
| `inset` | `#f3ecdf` | Chips, code pills, mono cells |
| `hover` | `#ece3d4` | Sidebar item hover |
| `border` | `#e7dcc9` | Default 1px hairline border |
| `border-strong` | `#d9c9ad` | Dashed drop-zones, stronger dividers |

**Brand (rust / terracotta)**

| Token | Hex | Use |
|---|---|---|
| `primary` | `#9a3412` | Primary buttons, headings, key figures, active nav text |
| `primary-deep` | `#7c2d12` | Primary hover/pressed, deep gradient stop |
| `accent` | `#c2410c` | Accent figures, active-nav border, "referenced-by" data, highlights |
| `accent-strong` | `#b8430f` | Bright gradient stop (node fills) |
| `gold` | `#ffb74d` | Light-orange accent (logo `.ai`, secondary series, source nodes) |

**Text / ink**

| Token | Hex | Use |
|---|---|---|
| `ink` | `#2c2118` | Default text on cream/white (warm near-black) |
| `ink-plain` | `#0f1213` | Inputs, strong body emphasis |
| `text-muted` | `#6b7280` | Secondary text |
| `text-subtle` | `#94a3b8` | Tertiary / placeholder / captions |
| `text-faint` | `#9ca3af` | Disabled, meta footnotes |
| `sidebar-text` | `#5b4a3a` | Sidebar base text |
| `sidebar-text-muted` | `#6b5d4d` | Sidebar inactive items |
| `sidebar-text-faint` | `#9c8b76` | Sidebar collapse control |

### 2.2 Semantic / status colours

| Role | Text | Background | Border |
|---|---|---|---|
| Success | `#166534` | `#dcfce7` / `#f0fdf4` | `#bbf7d0` (green-200) |
| Error | `#b91c1c` / `#ef4444` | `#fef2f2` | `#fecaca` (red-200) |
| Warning | `#92400e` | `#fef3c7` / `#fff7ed` | `#fed7aa` |
| Info | `#1d4ed8` / `#2563eb` | `#eff6ff` | `#bfdbfe` |
| Ceiling (rule) | `#1d4ed8` | `#dbeafe` (blue-100) | — |
| Floor (rule) | `#c2410c` | `#ffedd5` (orange-100) | — |

### 2.3 Data-visualization palette

- **Categorical series** (charts, cascade order): `#c2410c`, `#ffb74d`, `#9a3412`,
  `#7c2d12`, `#6366f1` → extended: `#0891b2`, `#ca8a04`.
- **Graph reference edges:** references / incoming = `#2563eb` (blue); referenced-by /
  outgoing = `#c2410c` (terracotta).
- **Graph node fills (gradients, 145°):**
  - ERP user: `#7c2d12 → #9a3412 → #b8430f`
  - Source-only (e.g. DE): `#b94515 → #d95a22 → #f97316`
  - Informal (e.g. ES): `#2d3748 → #4a5568 → #718096`
  - Reference-only: `#ffffff → #f3ecdf` (ghost card)
- **Chart gridlines:** `#f3ecdf`; **axis/dot accents** from the series palette.

### 2.4 Contrast (WCAG)

- `primary #9a3412` on `surface #ffffff` ≈ **6.6:1** → passes AA for normal text.
- `ink #2c2118` on `cream #faf5ee` ≈ **13:1** → passes AAA.
- `accent #c2410c` on white ≈ **4.5:1** → use for **bold/large** text or non-text only.
- Body text must stay ≥ 4.5:1; `text-subtle #94a3b8` is for ≥ ~16px or non-essential meta.

---

## 3. Typography

### 3.1 Font families

| Role | Family | Fallback stack | Source |
|---|---|---|---|
| Display / headings / KPI numbers | **Fraunces** (serif, opsz 9–144) | `Georgia, "Times New Roman", serif` | Google Fonts |
| Body / UI | **Inter** | `ui-sans-serif, system-ui, -apple-system, sans-serif` | Google Fonts |
| Mono (code, formulas, data) | system mono | `ui-monospace, SFMono-Regular, Menlo, monospace` | OS |

Weights loaded: **400, 500, 600, 700**.

### 3.2 Type scale (16px root)

| Token | Size | px | Weight | Family | Line height | Used for |
|---|---|---|---|---|---|---|
| `display-lg` | 1.875rem | 30 | 700 | Fraunces | 1.1 | KPI / stat numbers |
| `display-md` | 1.5rem | 24 | 700 | Fraunces | 1.15 | Page titles (H1) |
| `heading` | 1rem | 16 | 700 | Fraunces | 1.2 | Card/section headings |
| `label` | 0.875rem | 14 | 600 | Inter | 1.3 | Section labels (often UPPERCASE) |
| `body` | 0.875rem | 14 | 400/500 | Inter | 1.625 | Default body |
| `small` | 0.75rem | 12 | 400/500 | Inter | 1.5 | Secondary / table cells |
| `micro` | 0.6875rem | 11 | 500/600 | Inter | 1.4 | Chips, badges, meta |
| `nano` | 0.625rem | 10 | 700 | Inter | 1.4 | Tiny uppercase tags |

### 3.3 Treatments

- **Headings & KPI numbers** use the serif (Fraunces) — apply via a `.font-display`
  utility or by setting `h1–h6` to the serif family.
- **Section labels:** `UPPERCASE`, weight 600–700, letter-spacing `0.025em`
  (`tracking-wide`) or `0.1em` (`tracking-widest`), often in `primary`.
- **Headings letter-spacing:** `-0.2px` (slight tightening) on large serif.
- **Body line-height:** `1.625` (relaxed) for paragraphs; `1.3–1.4` for dense UI.

---

## 4. Spacing

4px base grid (multiply the step by 4px):

| Step | px | Common use |
|---|---|---|
| 0.5 | 2 | Badge vertical padding |
| 1 | 4 | Icon gaps |
| 1.5 | 6 | Pill padding |
| 2 | 8 | Input padding, small gaps |
| 2.5 | 10 | Button vertical padding |
| 3 | 12 | Card inner gaps |
| 4 | 16 | Grid gaps, card padding (compact) |
| 5 | 20 | Card padding (default) |
| 6 | 24 | Page padding |

Page container: `padding: 24px`, `max-width: 64rem–72rem` (1024–1152px), centered.

---

## 5. Radius, borders, elevation

### Radius
| Token | Value | Use |
|---|---|---|
| `radius-sm` | 4px | Inputs, mono pills |
| `radius-md` | 8px | Buttons, inset tiles |
| `radius-lg` | 12px | Cards, panels |
| `radius-xl` | 14px | Graph node cards |
| `radius-full` | 9999px | Pills, badges, avatars |

### Borders
- Default: **1px solid `#e7dcc9`**.
- Active nav: **2px** right border in `accent #c2410c`.
- Drop zones / reference edges: **2px dashed** (`border-strong` / series colour).

### Elevation (shadows)
| Token | Value | Use |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Resting cards, active nav |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.10)` | Card hover |
| `shadow-pop` | `0 6px 24px rgba(0,0,0,0.14)` | Floating panels / popovers |
| `shadow-node` | `0 3px 14px rgba(0,0,0,0.20)` | Graph nodes (rest) |
| `shadow-node-hover` | `0 10px 32px rgba(0,0,0,0.28)` | Graph nodes (hover) |

Floating panels also use `background: rgba(255,255,255,0.95)` + `backdrop-filter: blur(8–12px)`.

---

## 6. Iconography & imagery

- Current icons are **Unicode/emoji glyphs** (nav: `⬡ ↗ $ ▶ ◈ ↑ ✦`; country **flag
  emoji** 🇦🇹 🇫🇷 …). For production parity on other platforms, swap to a real icon
  set (e.g. **Lucide** or **Phosphor**) at **16 / 18 / 20px**, coloured `currentColor`.
- Logo: triangular "A" mark + `anervea` wordmark (black) + `.ai` in `gold #ffb74d`.
  Full wordmark in expanded sidebar; triangle mark when collapsed / as favicon.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `transition-fast` | 150ms ease | Colour/background hovers |
| `transition` | 200ms ease | General |
| `spring` | 200ms `cubic-bezier(0.34, 1.56, 0.64, 1)` | Node hover lift/scale |
| `view-fit` | 450ms | Graph zoom-to-fit |
| `spin` | 800ms linear infinite | Loading spinner |

Hover lift example (graph node): `transform: scale(1.05) translateY(-1px)` with `spring`.

---

## 8. Components

> Each spec lists the tokens; rebuild with the equivalent primitives on your platform.

### Button — primary
- bg `primary #9a3412` → hover `primary-deep #7c2d12`; text `#ffffff`, weight 600.
- padding `10px 16px` (`py-2.5 px-4`); radius `radius-md (8px)`; size `body (14px)`.
- disabled: `opacity 0.5`.

### Button — secondary / outline
- bg transparent; border `1px primary`; text `primary`; hover → bg `primary`, text white.
- padding `6px 12px`; radius `radius-md`.

### Card
- bg `surface #ffffff`; border `1px border #e7dcc9`; radius `radius-lg (12px)`;
  padding `20px`. Optional `shadow-sm`; hover `shadow-md` + border `primary`.
- Header band variant: gradient `primary-deep → accent-strong`, white text.

### Input / Select
- bg `#ffffff`; border `1px #e5e7eb` (cool gray-200) or `border`; radius `radius-sm`;
  padding `6px 8px`; text `small/body`; focus ring `primary @ 30% opacity`, 2px.

### Badge / Pill
- radius `radius-full`; padding `2px 8px`; text `nano/micro (10–11px)`, weight 600–700.
- Variants use the semantic pairs in §2.2 (e.g. ceiling = blue-100/blue-700,
  floor = orange-100/orange-700, success/warn/error as listed).

### Table
- header row: bg `muted #f5efe4`, text `text-subtle`, UPPERCASE `nano`, weight 600.
- rows: top border `1px inset #f3ecdf`; hover bg `muted`; cells padding `8px 16px`,
  `small`. First column often `primary` weight 500.

### KPI / stat
- label: `nano/micro` UPPERCASE, `text-subtle`.
- value: `display-lg/md`, **serif**, in `primary` or `accent`.
- card per §Card; coloured top-border accent optional (orange/blue/green per metric).

### Sidebar (left rail)
- bg `panel #f3ede1`; right border `1px border`; width 224px (expanded) / 64px (collapsed).
- item: `body`, `sidebar-text-muted`; hover bg `hover #ece3d4`, text `primary`.
- **active item:** bg `surface #ffffff`, text `primary`, weight 600, **2px right border
  `accent`**, `shadow-sm`.

### Chat bubble (assistant copilot)
- user: bg `primary`, white text, radius `16px`.
- assistant: bg `surface`, border `1px border`, `ink` text, markdown-rendered
  (headings serif/`primary`, code pills `inset` bg + `primary` text, KaTeX for math).
- tool chips: `inset` bg, `primary` text, mono `nano`.

### Drop zone
- `2px dashed border-strong`; idle bg `surface`; hover border `primary`;
  active/drag border `accent`, bg `#fff5f0`. Radius `radius-lg`.

---

## 9. Token export & cross-platform mapping

The same tokens, three ways:

**CSS custom properties**
```css
:root {
  --color-cream: #faf5ee;  --color-surface: #ffffff;  --color-panel: #f3ede1;
  --color-muted: #f5efe4;  --color-inset: #f3ecdf;    --color-border: #e7dcc9;
  --color-primary: #9a3412; --color-primary-deep: #7c2d12; --color-accent: #c2410c;
  --color-gold: #ffb74d;   --color-ink: #2c2118;
  --font-display: "Fraunces", Georgia, serif;
  --font-body: "Inter", ui-sans-serif, system-ui, sans-serif;
  --radius-lg: 12px; --radius-md: 8px;
}
```

**Tailwind v4 `@theme`** (as used here)
```css
@theme {
  --color-brand-bg: #faf5ee;       --color-brand-text: #2c2118;
  --color-brand-navy: #9a3412;     --color-brand-navy-light: #7c2d12;  /* primary family */
  --color-brand-orange: #c2410c;   --color-brand-orange-light: #ffb74d;
  --color-brand-gray: #f5efe4;     --color-brand-border: #e7dcc9;
  --font-display: "Fraunces", "Lora", Georgia, serif;
}
```

**Platform notes**
- **Figma:** import `design-tokens.json` via the *Tokens Studio* plugin (DTCG format).
- **iOS (SwiftUI):** map colours to `Color(hex:)`; Fraunces & Inter bundled as custom
  fonts; the type scale → `Font.custom(...)` sizes from §3.2.
- **Android:** colours → `colors.xml`; type scale → `styles.xml`/`TextAppearance`;
  fonts in `res/font`.
- **Style Dictionary:** point it at `design-tokens.json` to generate any of the above.

---

## 10. Do / Don't

- ✅ Headings & big numbers in **Fraunces**; body in **Inter**.
- ✅ Cream page background, **white** cards, **hairline warm** borders.
- ✅ Spend colour on actions, headings, and data — keep surfaces calm.
- ❌ Don't use pure cool grays (`#f8fafc`, `#e2e8f0`) or navy `#134074` — those are the
  pre-theme cool palette this design replaced.
- ❌ Don't put `accent #c2410c` as small/thin text on white (fails AA at body size).
- ❌ Don't mix a second display serif — Fraunces is the only display face.
