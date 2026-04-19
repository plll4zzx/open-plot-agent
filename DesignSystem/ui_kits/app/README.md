# OpenPlotAgent · App UI Kit

A pixel-adjacent recreation of OpenPlotAgent's product UI — the **Dashboard** and the **Workspace** — composed from small JSX components that can be remixed for new designs.

## Files

- `index.html` — interactive click-through (default lands on Workspace; use the view toggle in the header to visit Dashboard).
- `Icon.jsx` — inline Lucide-style SVG icon set used throughout.
- `Dashboard.jsx` — `Header`, `Dashboard` (hero + project grid + recent tasks row).
- `Workspace.jsx` — `Workspace` with the four-column grid: `ProjectSidebar | Preview + chart + mini-timeline | Context tab body | Activity Rail`. Tab bodies: `ChatTab`, `HistoryTab`, `PaletteTab`, `CodeTab`, `MemoryTab` + a stub for the Model tab.
- `app.css` — scoped styles; imports `../../colors_and_type.css` for tokens.

## Fidelity

- Layout grid, tokens, section-header pattern, git-status badge, tool-call pill, rail + left-bar active indicator all match `frontend/src/App.jsx` and `ChatPanel.jsx`.
- The chart inside Preview is a hand-composed SVG standing in for matplotlib/PGF output — two series with CI bands, LaTeX-ish axis labels, right-anchored legend. This is a visual placeholder, not real matplotlib.
- `PaletteTab`, `CodeTab`, `MemoryTab` implement the **specified** UI from `UI_DESIGN.md` even though the current `App.jsx` has not built them — they follow the documented conventions.

## Known gaps

- No real data editor / ingest panel / element-editor popover (spec only).
- Model-provider tab is stubbed.
- Icons are inline SVG copies of Lucide glyphs (matches stroke weight and size); for production, `import { Icon } from 'lucide-react'`.
