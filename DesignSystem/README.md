# OpenPlotAgent · Design System

**OpenPlotAgent** is a local-first AI agent that turns experimental data into publication-ready academic figures. Unlike online charting tools (Datawrapper, Flourish), it targets paper authors: PGF backend, LaTeX formulas, journal submission sizes, full git-based provenance, and a three-tier memory system so the agent accumulates style preferences across projects.

Audience: grad students, postdocs, PIs who already live in LaTeX, Python, and the terminal. They want the right tool, not a pretty one. Interface density is a feature.

## Sources

- **Repository:** `plll4zzx/open-plot-agent` (GitHub)
  - `UI_DESIGN.md` — interface spec v1 (authoritative visual direction)
  - `REQUIREMENTS.md` — product requirements v1
  - `frontend/src/App.jsx` — actual React implementation (Dashboard + Workspace)
  - `frontend/src/components/ChatPanel.jsx` — agent turn + tool-call UI
  - `frontend/src/index.css` — base tokens, font imports

All visual decisions below are grounded in that repo. Screenshots were not used.

---

## Index

| File | Purpose |
|---|---|
| `README.md` | This file — content, visuals, iconography, manifest |
| `colors_and_type.css` | Core tokens — color, typography, spacing, radii, shadow, motion |
| `SKILL.md` | Agent skill manifest (cross-compatible with Claude Code skills) |
| `assets/` | Brand and icon assets copied from source |
| `preview/` | Design-system cards rendered in the Design System tab |
| `ui_kits/app/` | High-fidelity React recreation of the product (Dashboard + Workspace) |

---

## CONTENT FUNDAMENTALS

**Language.** Simplified Chinese is primary. Every user-facing string in the app is Chinese (`新建项目`, `学术图表 工作室`, `已保存`, `选择或新建一个任务`). Latin letters appear only for product names (OpenPlotAgent, Nature, IEEE), technical terms (git, venv, PGF, LaTeX, API), filenames (`plot.py`, `TASK.md`), and mono-typed code tags (`[FINAL]`, `[STYLE]`, `v7`). When writing UI copy, write in Chinese first and let technical identifiers pass through untranslated.

**Tone.** Precise, unornamented, peer-to-peer. The product treats the user as a capable engineer. Never condescending, never cheerful. Examples from the actual UI:

- Hero subtitle: `用 matplotlib + PGF 输出投稿级 PDF。每次编辑 git 自动留痕。` — two sentences, full stop, no exclamation, no "!" anywhere in the app.
- Empty state: `还没有项目，点击新建开始` — flat imperative.
- Agent first message (inherited project): `你好！这是 Nature 2026 项目的新任务。已载入项目偏好（88mm 单栏、Times 字体、Okabe-Ito 配色）。请上传数据或描述需求。` — brief `你好！`, then drops into factual mode immediately.

**You vs I.** Agent refers to itself in the first person (`我注意到`, `要我现在出图吗？`). User-facing copy uses `你` sparingly and prefers imperatives (`上传数据或描述需求`, `点击新建开始`).

**Casing.** Chinese ignores case. English technical terms keep canonical casing: `Claude Code`, `Ollama`, `Anthropic API`, `matplotlib`, `plot.py`, `git`, `venv`. Uppercase tracked labels are reserved for structural tags rendered in JetBrains Mono: `WORKSPACE · 7 PROJECTS`, `PROJECT`, `[FINAL]`, `[AI]`, `[DATA]`. Never use uppercase on Chinese text.

**Punctuation.** Full-width Chinese punctuation (`。`, `，`, `？`, `（…）`) for Chinese sentences. Half-width Latin punctuation for English/technical fragments. Middot `·` is the house separator — used between meta fragments (`4v · 2h 前 · ⭐ 已定稿`), section subtitles (`01 预览 · Fig.2`), and credit lines.

**Numbers & versions.** Versions are `v1`, `v2`, … always lowercase `v`, no space. Counts use mono: `24 × 8`, `n=2000`, `+3/s`. Times use `2h 前`, `30m 前`, `昨天`, `10:41` — terse, relative-first.

**What never appears.** Exclamation-heavy marketing tone, emoji as decoration, cutesy microcopy ("Oops!", "Awesome!"), generic CTAs like "Get started". Error toasts are factual: `保存失败 · 检查网络`.

**Emoji.** Used intentionally and sparingly as semantic glyphs, not decoration: `🔧` marks an agent tool call, `✨` marks an agent turn, `📡` marks a live ingest endpoint, `🔴` marks an actively-streaming file, `⭐` marks a finalized/starred item, `🧠` marks the memory tab, `🎨` marks the palette tab, `📊` marks compare mode, `🔒` marks a finalize action, `🔮` marks the agent's primary CTA (`Agent: 生成图表`). Never use smileys, hand gestures, or flags. One emoji per line, max.

---

## VISUAL FOUNDATIONS

### Color

The canvas is **warm beige `#F5F1EA`**, not white. Rationale: researchers stare at screens for hours and pure white is fatiguing. White is reserved for **chart containers and form inputs** — it's the visual anchor the eye returns to. Two very faint radial gradients (4% amber top-left, 4% teal bottom-right) sit on the body background for warmth — imperceptible individually but they stop the beige from feeling flat.

Three accent colors each have one job:

- **Amber `#B45309`** — 🔒 finalize only. The rule, from UI_DESIGN §7.1: any one screen may display amber on **at most one or two** buttons. If you use amber for anything else the whole interface gets muddy. Also used for the dashed editing-frame and for memory-related highlights.
- **Teal `#0F766E`** — success, positive feedback, git-saved badge, ColorBrewer qualitative set.
- **Violet `#7C3AED`** — everything agent/LLM: tool-call pill background, agent message sigil, "thinking" spinner, edit-mode badge.

Ink is stone-warm: `#1C1917` primary, cascading through `#44403C → #57534E → #78716C → #A8A29E → #C4BEB7`. Never use pure `#000` or `#666` — they read cold against the beige.

### Typography

Four families, each with a defined role, from UI_DESIGN §1.3:

- **Fraunces** (serif) — display, panel titles, card titles. Used italic for section headers to pair with the mono tag number (`01 预览`). The italic is the house move.
- **Geist** (sans) — body, buttons, form fields. 400/500/600.
- **JetBrains Mono** — code, data tables, timestamps, structural tags (`WORKSPACE · 7 PROJECTS`). Tracked 0.15em when uppercase.
- **Cormorant Garamond** (italic serif) — LaTeX preview only. Appears inside chart titles and the in-situ LaTeX editor to approximate PGF output.

Scale is compressed: body 13px, compact body 12.5px, code 11.5px, meta 11px, tag 10px. Hero 42px Fraunces — the single display moment per screen.

### Spacing & layout

4-based spacing: 4, 8, 12, 16, 20, 24, 32, 40. The Workspace grid is hard-coded: `200px | flex | 340px | 48px` (Project sidebar | main | Context tab-body | Activity rail). Section headers are a fixed pattern: 5px horizontal × 12px vertical, mono ordinal (`01`) then Fraunces italic title then `·`-separated subtitle, right-aligned actions. Repeat this pattern everywhere — it's the structural signature.

### Borders, radii, cards

Hairlines only, never double rules. Default border `#E7E0D1`; slightly stronger `#D6CFC2` for form inputs. Radii: `4 / 6 / 8 / 12 / 16`. Buttons and inputs 6–8px. Cards and chart containers 12px. Cards are `background: #FFFFFF, border: 1px solid #E7E0D1` — no shadow. Only chart containers get the dedicated `--shadow-chart`: a 1px contact shadow plus a soft 12px lifted halo. Modals use a simple pop-shadow.

### Backgrounds & imagery

No illustrations, no hand-drawn motifs, no photo hero. The background is the beige canvas plus those faint radial warmth gradients — that's the whole environmental palette. Translucent overlays are `rgba(245,241,234, 0.4–0.85)` over white, sometimes with `backdrop-filter: blur(6–8px)` on the header and modals. Use blur only on the app header and on modal backdrops — nowhere else.

### Animation

Quiet. From UI_DESIGN §7.3:

- Modal fade-in 200ms.
- Panel slide 300ms.
- Button hover: opacity 150ms (no transform).
- Chart skeleton uses a slow `pulse-soft` breathing animation (1.4s ease-in-out, 0.6↔1.0 opacity).
- Git-badge color transitions 300ms.

Explicitly banned: bouncy springs, paper-airplane flights, confetti — "对工程用户显得幼稚" (childish to engineer users).

### States

- **Hover** — opacity shift (typically `hover:opacity-70`) or a soft `rgba(28,25,23,0.06)` tinted background on nav items. Cards lift 0.5px on hover (`hover:-translate-y-0.5`). No color change on primary buttons.
- **Active tab / selected row** — white background `#FFFFFF` on the beige canvas, plus a 2px solid ink bar on the left edge (Activity rail pattern) or the `rgba(28,25,23,0.06)` tint (Project sidebar pattern).
- **Press** — background darkens 100ms. No shrink-scale.
- **Focus** — native outline is acceptable; fields rely on `outline: none` with border retained.
- **Disabled** — background `#E7E0D1`, text `#A8A29E`.

### Transparency & blur

Used only for the sticky header (`rgba(245,241,234,0.85) + blur 8px`) and modal backdrops (`rgba(28,25,23,0.4) + blur 6px`). Panel section headers have a very light white wash `rgba(255,255,255,0.4)` for subtle depth. Never apply blur to chart content or data tables.

### Fixed elements

The top header is sticky and blurred. The Activity Rail (48px) is always visible on the right edge of Workspace. Everything else scrolls in place.

---

## ICONOGRAPHY

Production uses **Lucide React** exclusively (imported in `App.jsx`: `BarChart3, Plus, Search, FolderOpen, Settings, ChevronRight, LayoutGrid, FileText, Star, GitBranch, MessageSquare, Sparkles, Check, Eye, EyeOff, SplitSquareHorizontal, Clock, Send, ChevronDown`). No custom icon font, no sprite for UI icons.

**Sizing:** 11–15px (13 default, 15 for header), `strokeWidth={2}` except the logo mark which uses `2.2`. Color defaults to current-text color; inactive tabs use `#A8A29E`, active uses `#1C1917`.

**Not in Lucide:** emoji glyphs fill semantic roles that no icon system conveys crisply — `🔧` (tool call), `✨` (agent), `🔮` (agent CTA), `📡` (live ingest), `🔴` (streaming), `🎨` (palette), `🧠` (memory), `🔒` (finalize), `⭐` (starred/final), `📄` `🖼` (file types). These are intentional and canonical — do not replace them with Lucide equivalents.

**In CDN prototypes:** load Lucide from `https://unpkg.com/lucide@0.400.0/dist/umd/lucide.js` or from `lucide-static/icons/<name>.svg`. For static HTML, link by name using the lucide-static SVG CDN. Any icon not in Lucide → **flag the substitution** and ask for an updated asset.

**Logo:** the app wordmark is `OpenPlotAgent` in Fraunces 17px italic 500, preceded by a 28×28 dark-ink square (`#1C1917`, 4px radius) containing Lucide `BarChart3` at 15px in cream (`#F5F1EA`). That small glyph doubles as the favicon (`assets/favicon.svg`).

**SVGs imported:** `assets/favicon.svg` (source favicon) and `assets/icons.svg` (social-icon symbol sheet — unused in the product proper, included for completeness).

---

## Caveats / substitutions

- Fonts are **loaded from Google Fonts via CDN** (same approach as production). If you want the design system to work offline, drop TTFs into `fonts/` and rewrite the `@import` in `colors_and_type.css`.
- The UI kit renders the screens that exist in `App.jsx` today (Dashboard + Workspace with Chat/History tabs). The five extra Context tabs specified in UI_DESIGN §4.6 (🎨 配色, `</>` 代码, 🧠 记忆, ⚙ 模型) are documented in this system but were not yet implemented in the repo — they are NOT recreated in the UI kit.
