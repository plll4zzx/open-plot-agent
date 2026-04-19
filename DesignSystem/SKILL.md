---
name: openplotagent-design
description: Use this skill to generate well-branded interfaces and assets for OpenPlotAgent, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

# OpenPlotAgent · Design skill

Read `README.md` first — it is the source of truth for content tone, visual
foundations, and iconography. Then consult:

- `colors_and_type.css` — CSS custom properties for color, type, spacing,
  radii, shadows, and motion. Import this file or copy the `:root` vars into
  any new artifact.
- `fonts/` — self-hosted Geist Sans, Fraunces, JetBrains Mono, Cormorant Garamond.
- `preview/` — per-token preview cards; mine these for component-level examples
  (buttons, inputs, chat turn, section header, etc.).
- `ui_kits/app/` — React recreation of the Dashboard and Workspace. Copy whole
  components (`Header`, `Dashboard`, `Workspace`, `ChatTab`, `HistoryTab`,
  `CodeTab`, `PaletteTab`, `MemoryTab`) or the smaller atoms inside them.
- `assets/` — logo mark placeholder and Lucide-style icon set references.

## Quick rules

- **Type pairing.** Fraunces italic for display / section headers, Geist for
  UI and body, JetBrains Mono for code / metadata / hashes, Cormorant Garamond
  italic for chart labels. Never substitute.
- **Palette.** Warm canvas `#F5F1EA`, ink `#1C1917`, border `#E7E0D1`. Semantic:
  amber `#B45309` (finalize), teal `#0F766E` (success / saved), violet `#7C3AED`
  (agent / tool calls). Okabe-Ito or ColorBrewer for actual chart colors —
  never invent new chart palettes.
- **Section header pattern.** Mono ordinal (`01`) + Fraunces italic title — use
  this to open every panel and section.
- **Copy voice.** Bilingual zh/en; terse; mono for technical facts. No emoji
  in UI chrome — only the canonical set: 🔒 (finalized), ⭐ (starred),
  📝 (memory edit), 🔧 (tool call), ✨ (agent), ⏱ (running).
- **Density is a feature.** This is a pro tool, not a consumer app.

## When invoked

- If creating visual artifacts (slides, mocks, throwaway prototypes), copy
  referenced assets out of this skill and emit a self-contained static HTML
  file so the user can open it directly.
- If working on production code, read the rules here and inside the UI kit
  and act as an in-house designer — match the existing App.jsx conventions
  rather than reinventing them.
- If the user invokes this skill with no further guidance, ask what they want
  to build, confirm the surface (chart preview? onboarding? new tab?), then
  produce either HTML artifacts or production code as appropriate.
