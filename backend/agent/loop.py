"""
Agent turn loop.
One AgentLoop instance per active task. Maintains conversation history
and drives the tool-use cycle until the model returns stop_reason=end_turn
or the tool round limit is reached.
"""
import asyncio
import hashlib
import json
from pathlib import Path
from typing import Callable, Coroutine

from agent.providers.base import Done, LLMProvider, TextDelta, ThinkingDelta, ToolCall
from agent.chart_validator import (
    format_issues_for_agent,
    validate_chart,
    validate_chart_visual,
)
from agent.context_compressor import maybe_compress
from agent.tools import TOOL_REGISTRY, get_schemas
from sandbox.runner import SandboxRunner

# Maximum number of validation-driven retries within one turn.
MAX_VISUAL_RETRIES_PER_TURN = 2

CONTEXT_FILE = ".plotsmith/context.json"
PENDING_EDITS_FILE = ".plotsmith/pending_edits.json"

SYSTEM_PROMPT = """\
You are OpenPlotAgent, an AI assistant specialized in generating publication-quality \
academic charts using matplotlib. Every chart is split into a two-stage pipeline:

- **Stage 1 — Data** (`chart/data_prep.py`): load, clean, and reshape data; expose a \
`get_data()` function.
- **Stage 2 — Plot** (`chart/plot.py`): import from `data_prep`, build the matplotlib figure, \
save `output.svg`.

Keeping the stages separate means data logic and visual logic can be revised independently.

## Path conventions
Tool paths (list_files, read_file, write_file) are relative to the **task root**, NOT to chart/.
- `processed/data.csv`  — user's processed data (task-root-relative)
- `chart/data_prep.py`  — Stage 1: data loading / cleaning (task-root-relative)
- `chart/plot.py`       — Stage 2: matplotlib figure (task-root-relative)
- `chart/output.svg`    — SVG output (written by plot.py)
- `raw/<filename>`      — experiment raw data (resolved automatically to experiment level)

execute_python runs with cwd=chart/, so inside code use `../processed/data.csv`.

## Data tools (use these instead of reading raw CSV into context)
- **summarize_data(path)** — Get a concise natural language summary of a data file. \
Best for initial exploration — gives you an overview in one compact paragraph. \
Use this FIRST, then inspect_data only if you need precise column details.
- **recommend_charts(path)** — Analyze a data file and suggest 2-4 appropriate chart \
types with reasoning. Use this when the user is unsure what chart to make, or to \
confirm your own chart choice matches the data shape.
- **inspect_data(path)** — Get shape, columns, types, stats, and a preview. \
Use when you need precise column-level details (dtypes, exact stats, sample values). \
Works with both `processed/...` and `raw/...` paths.
- **query_data(path, columns?, filter?, sort_by?, head?)** — Retrieve a subset of data. \
Use when you need specific columns or filtered rows from a large file.
- **transform_data(input_path, output_path, operations)** — Clean and reshape data: \
forward_fill (expand merged cells), transpose, pivot, melt, rename_columns, drop_columns, \
set_header_row, flatten_multi_header, to_numeric, fillna. Use this when raw data needs \
restructuring before plotting.
- **write_data(path, rows | records)** — Write processed data to a CSV file.

## Memory tools (persist notes across turns and sessions)
- **memory_read(scope)** — Read persistent notes. scope ∈ {'global','project','experiment','task'}. \
Call memory_read('global') and memory_read('project') at the start of any new task to \
pick up user preferences (color palette, journal requirements, recurring reviewer feedback).
- **memory_write(scope, content, mode?)** — Record a new note. Use mode='append' (default) \
to preserve history, or 'replace' to overwrite. Examples: after user says "I always want \
Okabe-Ito colors", call memory_write('global', 'Palette: Okabe-Ito'). After fixing an \
issue based on reviewer comments, call memory_write('task', 'Reviewer asked for p-values…').

## Git tools (version control)
- **git_log(n?, path?)** — View commit history. Optionally filter by file path (e.g. 'chart/plot.py').
- **git_diff(hash1, hash2?, path?)** — Compare two versions. See what changed in code or data.
- **git_restore(hash, path?)** — Restore a file to a previous version. Use git_log first to find the hash.

## Environment & packages
- **install_package(name, version?)** — Install a Python package into the \
**per-task sandbox venv** (used only by execute_python / plot.py). Use this \
ONLY when `execute_python` fails with ImportError. The package is \
automatically recorded in requirements.txt.
- Pre-installed in sandbox venv: matplotlib, pandas, numpy, scipy, seaborn.
- For specialized charts (e.g. networkx, sklearn, statsmodels), install on demand.
- **install_package does NOT affect backend tools** (inspect_data, summarize_data, \
transform_data, query_data, write_data, recommend_charts). Those run in the \
backend Python process. If one of them returns a `backend_dependency_missing` \
hint, STOP and tell the user to install it into their backend venv — don't \
retry with install_package.

## Knowledge tools (semantic search over past charts)
- **search_charts(query, k?)** — Search your history of successfully generated charts by semantic \
similarity. Returns matching plot.py code examples. \
Use when the user asks for something "similar to" a past chart, or when you want reference code \
for a chart type you haven't written recently (e.g. "violin plot with significance bars", \
"heatmap with dendrograms"). k defaults to 3.

## CONFIG property editing (patch without rewriting the whole file)
- **patch_config_prop(key, value)** — Patch a single CHART CONFIG variable in chart/plot.py, \
then re-execute to produce a new SVG. Use this instead of write_file whenever the change \
is purely visual and maps to an existing @prop key. \
Examples of when to use patch_config_prop:
  - User asks to change title, axis labels, font sizes → `key="title"`, `value='"New Title"'`
  - User asks to resize the figure → `key="figsize"`, `value='(8.0, 5.0)'`
  - User asks to adjust transparency → `key="bar_alpha"`, `value='0.6'`
  - User asks to toggle grid → `key="grid"`, `value='True'`
  - User asks to set axis range → `key="xlim"`, `value='(0.0, 10.0)'`
  - User asks to change color palette → `key="palette"`, `value='["#1f77b4","#ff7f0e","#2ca02c"]'`
  Do NOT use patch_config_prop for: new chart type, new data series, adding/removing axes, \
  complex layout changes — those need write_file.

## Required workflow
0. **Recall context** (first turn only, or when starting a new task): call memory_read('task'), \
memory_read('experiment'), memory_read('project'), and memory_read('global') in order \
to load all persistent context — user preferences, journal requirements, past decisions. \
On subsequent turns in the same conversation, skip scopes you already read.
1. **Discover data**: call summarize_data("processed/data.csv") for a quick overview, \
or inspect_data for column details. If it doesn't exist, \
call summarize_data("raw/<filename>") to check available raw data.
2. **Prepare data**: if raw data needs cleaning or subsetting, use transform_data or query_data \
to create `processed/data.csv`. Skip if it's already clean.
3. **Do NOT invent or generate sample data.** If no data exists at all, ask the user to \
upload or paste it.
4. **Write both pipeline files** — data_prep.py first, then plot.py (see requirements below).
5. **Execute**: execute_python(<plot.py content>) — fix any errors, update both files, re-run.
6. **Self-check**: review validation warnings. Fix errors and re-run if needed.
7. **Persist to task memory** (when meaningful): if this turn produced a design decision, \
user preference, or important finding, call memory_write('task', ...) to record it in \
1-3 bullet points. Skip if the turn was purely exploratory or nothing noteworthy happened.

## Pipeline code requirements

### `chart/data_prep.py` — Stage 1: data
```python
import pandas as pd
# (numpy, scipy etc. as needed)

def get_data():
    df = pd.read_csv("../processed/data.csv")
    # filtering, renaming, type coercion, derived columns, aggregations…
    return df
```
- Expose exactly one public function: `get_data()` returning a ready-to-plot DataFrame.
- All data wrangling lives here — plot.py must NOT re-implement any of it.
- When the user asks to adjust axis range, add error bars, or change what's plotted, \
update `get_data()` first (or add a helper), then update the plot call in plot.py.

### `chart/plot.py` — Stage 2: chart

plot.py **must** start with a CHART CONFIG block, followed by the CONFIG variables, \
then imports and rendering logic. This block is machine-readable and drives the \
Properties panel in the UI — every property the user might want to adjust must be \
declared here.

**Optional feature convention:** Some chart elements are optional (legend, axis limits, \
suptitle, etc.). Always declare their `@prop` so the user can toggle them on/off from the \
Properties panel. Use an **empty string `""`** (for `str`/`enum` props) or **`None`** \
(for `tuple2f_opt` props) to indicate "currently inactive", and guard rendering with \
`if VAR:`. Examples:
- No legend yet → `LEGEND_LOC = ""` and `if LEGEND_LOC: leg = ax.legend(loc=LEGEND_LOC)`
- Axis limits auto → `XLIM = None` and `if XLIM: ax.set_xlim(XLIM)`
- No suptitle → `SUPTITLE = ""` and `if SUPTITLE: fig.suptitle(SUPTITLE, ...)`

This way the panel always shows these controls (toggled off), and the user can enable \
them without asking the agent.

```python
# ══════════════════════════════════════════════════════════════
# CHART CONFIG  (machine-readable — do not rename variables)
# @prop figsize       tuple2f
# @prop title         str
# @prop xlabel        str
# @prop ylabel        str
# @prop suptitle      str
# @prop title_size    float   6,32
# @prop label_size    float   6,24
# @prop tick_size     float   6,20
# @prop palette       list_color
# @prop bar_alpha     float   0,1
# @prop grid          bool
# @prop grid_alpha    float   0,1
# @prop xlim          tuple2f_opt
# @prop ylim          tuple2f_opt
# @prop legend_loc    enum    best|upper right|upper left|lower right|lower left
# ══════════════════════════════════════════════════════════════

FIGSIZE     = (6.0, 4.0)
TITLE       = "Chart Title"
XLABEL      = "X Label"
YLABEL      = "Y Label"
SUPTITLE    = ""          # empty = no suptitle; set to enable
TITLE_SIZE  = 14.0
LABEL_SIZE  = 11.0
TICK_SIZE   = 9.0
PALETTE     = ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7"]
BAR_ALPHA   = 0.85
GRID        = True
GRID_ALPHA  = 0.3
XLIM        = None        # None = auto; set to (lo, hi) to fix range
YLIM        = None
LEGEND_LOC  = ""          # empty = no legend; set to location string to enable

# ─────────────────────────────────────────────────────────────
import matplotlib.pyplot as plt
from data_prep import get_data

df = get_data()

fig, ax = plt.subplots(figsize=FIGSIZE)
# ... draw using PALETTE[0], PALETTE[1], … and CONFIG variables …

ax.set_title(TITLE, fontsize=TITLE_SIZE)
ax.set_xlabel(XLABEL, fontsize=LABEL_SIZE)
ax.set_ylabel(YLABEL, fontsize=LABEL_SIZE)
ax.tick_params(labelsize=TICK_SIZE)
if SUPTITLE: fig.suptitle(SUPTITLE, fontsize=TITLE_SIZE)
if XLIM: ax.set_xlim(XLIM)
if YLIM: ax.set_ylim(YLIM)
if GRID: ax.grid(True, alpha=GRID_ALPHA)
if LEGEND_LOC:
    leg = ax.legend(loc=LEGEND_LOC)
    leg.set_gid("legend")

# GID tags (required — see GID tagging rules below)
ax.title.set_gid("title")
ax.xaxis.label.set_gid("xlabel")
ax.yaxis.label.set_gid("ylabel")

fig.tight_layout()
fig.savefig("output.svg")
```

**CONFIG block rules (strictly required):**
- The block header line must contain the exact text `CHART CONFIG`
- Each `# @prop <key> <type> [<extra>]` declares one editable property
- `@prop` types: `float`, `int`, `bool`, `str`, `color`, `tuple2f`, `tuple2f_opt`, \
`list_color`, `enum`
- For `float`/`int`, `extra` is `min,max` (e.g. `0,1`)
- For `enum`, `extra` is `opt1|opt2|opt3`
- Each declared `@prop key` must have a Python variable `KEY.upper() = <value>` below
- Add chart-type-specific props as needed: `bar_width`, `line_width`, `marker_size`, \
`scatter_alpha`, `heatmap_cmap`, `violin_bw`, etc.

**Rendering rules:**
- **Always** `from data_prep import get_data` — never re-read the CSV here.
- **Must** call `fig.savefig("output.svg")`. MPLBACKEND="svg" is pre-configured.
- Use CONFIG variables throughout: `figsize=FIGSIZE`, `color=PALETTE[0]`, etc.
- Title/label calls must use `TITLE`/`XLABEL`/`YLABEL` variables (not f-strings).
- Follows all variable naming, PALETTE, and GID tagging rules below.

### Variable naming (strictly required)
- Figure: **always `fig`** — e.g. `fig, ax = plt.subplots()` or `fig = plt.figure()`
- Single axes: **`ax`**
- Multiple axes: unpack explicitly — `fig, (ax0, ax1) = plt.subplots(1, 2)`
  or `fig, axes = plt.subplots(2, 2)` then `ax0, ax1, ax2, ax3 = axes.flat`
- Never use anonymous axes (`plt.gca()`) or generic names (`f`, `a`, `axis`).

### Color palette (strictly required)
Declare `PALETTE` in the CONFIG block (`@prop palette list_color`) and define it as a \
Python variable:
```python
PALETTE = ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7"]
```
Use `PALETTE[0]`, `PALETTE[1]`, … when assigning colors — never hardcode hex values \
directly in chart calls (e.g. `ax.bar(..., color=PALETTE[0])` not `color="#E69F00"`). \
Default is Okabe-Ito (color-blind-safe). Use this unless the user specifies otherwise.

### Titles and labels: use **literal strings only**
- ✅ `ax.set_title("Treatment vs Control")` — patchable
- ✅ `fig.suptitle("Figure 1: Overview")` — patchable
- ❌ `ax.set_title(title_str)` — NOT patchable
- ❌ `ax.set_title(f"{group} results")` — NOT patchable

### GID tagging (strictly required for hover / click / drag in the preview)

**Single-axes figure:**
```python
ax.title.set_gid("title")
ax.xaxis.label.set_gid("xlabel")
ax.yaxis.label.set_gid("ylabel")
leg = ax.legend(...); leg.set_gid("legend")
for i, patch in enumerate(ax.patches):      patch.set_gid(f"bar_{i}")
for i, line  in enumerate(ax.lines):        line.set_gid(f"line_{i}")
for i, coll  in enumerate(ax.collections): coll.set_gid(f"scatter_{i}")
for i, txt   in enumerate(ax.texts):        txt.set_gid(f"annotation_{i}")
```

**Multi-axes (subplots) figure — index every element by axis position:**
```python
sup = fig.suptitle("Overall Title")
sup.set_gid("suptitle")

for i, ax in enumerate([ax0, ax1, ...]):   # list axes explicitly, do NOT use axes.flat
    ax.set_title("Subplot title as a literal string")
    ax.title.set_gid(f"title_{i}")
    ax.xaxis.label.set_gid(f"xlabel_{i}")
    ax.yaxis.label.set_gid(f"ylabel_{i}")
    leg = ax.get_legend()
    if leg: leg.set_gid(f"legend_{i}")
    for j, patch in enumerate(ax.patches):      patch.set_gid(f"bar_{i}_{j}")
    for j, line  in enumerate(ax.lines):        line.set_gid(f"line_{i}_{j}")
    for j, coll  in enumerate(ax.collections): coll.set_gid(f"scatter_{i}_{j}")
    for j, txt   in enumerate(ax.texts):        txt.set_gid(f"annotation_{i}_{j}")
```

- After success briefly describe what you made and any key design decisions.
"""


# ── WebSocket event helpers ────────────────────────────────────────────────

def _ws_event(type_: str, **kwargs) -> str:
    return json.dumps({"type": type_, **kwargs})


# ── Agent Loop ─────────────────────────────────────────────────────────────

class AgentLoop:
    def __init__(self, provider: LLMProvider, runner: SandboxRunner, task_dir: Path):
        self.provider = provider
        self.runner = runner
        self.task_dir = task_dir
        self.history: list[dict] = []
        self._commit_handle: asyncio.TimerHandle | None = None
        self._last_plot_hash: str | None = None
        self._visual_retries = 0  # reset each turn; limits multimodal validator calls
        self._load_history()

    # ── Persistence ────────────────────────────────────────────────────────

    def _load_history(self) -> None:
        ctx = self.task_dir / CONTEXT_FILE
        if ctx.exists():
            try:
                data = json.loads(ctx.read_text())
                self.history = data.get("messages", [])
                self._last_plot_hash = data.get("last_plot_hash")
            except Exception:
                self.history = []

    def _save_history(self) -> None:
        ctx = self.task_dir / CONTEXT_FILE
        ctx.parent.mkdir(parents=True, exist_ok=True)
        # Track plot.py hash for external change detection
        self._last_plot_hash = self._get_plot_hash()
        ctx.write_text(json.dumps({
            "messages": self.history,
            "last_plot_hash": self._last_plot_hash,
        }, indent=2))

    # ── File change detection ──────────────────────────────────────────────

    def _get_plot_hash(self) -> str | None:
        plot_py = self.task_dir / "chart" / "plot.py"
        if not plot_py.exists():
            return None
        return hashlib.md5(plot_py.read_bytes()).hexdigest()

    def _check_external_changes(self) -> str | None:
        """Check if plot.py was modified externally since last agent turn."""
        current_hash = self._get_plot_hash()
        if self._last_plot_hash is None or current_hash is None:
            return None
        if current_hash != self._last_plot_hash:
            # Read the current plot.py to show agent what changed
            plot_py = self.task_dir / "chart" / "plot.py"
            content = plot_py.read_text() if plot_py.exists() else "(deleted)"
            return (
                f"[SYSTEM NOTICE] chart/plot.py has been modified externally "
                f"(e.g. by user manual edit or git version restore). "
                f"The current content is:\n```python\n{content}\n```\n"
                f"Please take this into account for any further modifications."
            )
        return None

    # ── Pending GUI edits ──────────────────────────────────────────────────

    def _consume_pending_edits(self) -> str | None:
        """Read and clear pending GUI edits, return a notice string if any."""
        edits_file = self.task_dir / PENDING_EDITS_FILE
        if not edits_file.exists():
            return None
        try:
            edits = json.loads(edits_file.read_text())
        except Exception:
            return None
        if not edits:
            return None
        # Clear the file
        edits_file.write_text("[]")
        # Build a human-readable notice
        lines = ["[SYSTEM NOTICE] The user made the following manual edits via the GUI:"]
        for e in edits:
            lines.append(
                f"  - Element '{e['gid']}': {e['property']} changed "
                f"from '{e.get('old_value', '?')}' to '{e['new_value']}'"
            )
        lines.append(
            "These edits are currently applied to the SVG preview only (DOM). "
            "Please update chart/plot.py to make them permanent, then re-run to verify."
        )
        return "\n".join(lines)

    # ── Main turn ──────────────────────────────────────────────────────────

    async def run_turn(
        self,
        user_message: str,
        send: Callable[[str], Coroutine],
    ) -> None:
        """
        Execute one complete agent turn.
        `send` is an async callable that sends a JSON string over WebSocket.

        Cancellable: if asyncio.CancelledError is raised (e.g. the user hit
        the stop button), we roll back any user messages appended this turn
        so the in-memory history stays consistent.
        """
        # Remember the history length so we can roll back on cancellation
        history_cursor = len(self.history)

        # Inject context about external changes before the user message
        context_notices = []
        ext_change = self._check_external_changes()
        if ext_change:
            context_notices.append(ext_change)
        pending_edits = self._consume_pending_edits()
        if pending_edits:
            context_notices.append(pending_edits)

        if context_notices:
            notice_text = "\n\n".join(context_notices)
            # Notify frontend that context was injected
            await send(_ws_event("context_notice", content=notice_text))
            # Merge notice into the user message — a separate user-role message
            # would create two consecutive user turns, violating Anthropic's
            # alternating-role constraint and confusing Ollama models.
            self.history.append({"role": "user", "content": f"{notice_text}\n\n{user_message}"})
        else:
            self.history.append({"role": "user", "content": user_message})

        # Reset per-turn counters
        self._visual_retries = 0

        try:
            ok = await self._run_turn_inner(user_message, send)
        except asyncio.CancelledError:
            # Roll back any messages appended this turn so the in-memory
            # history stays consistent for the next request.
            del self.history[history_cursor:]
            raise
        except Exception:
            # Non-cancellation exception (e.g. LLM API error on consecutive user
            # messages). Roll back so the next turn starts from a clean state.
            del self.history[history_cursor:]
            raise

        if not ok:
            # Graceful failure (max_tool_rounds, stream ended early).
            # Roll back the failed turn so the next request doesn't inherit
            # a dangling user message that would create consecutive user turns.
            del self.history[history_cursor:]
            self._save_history()

    async def _run_turn_inner(
        self,
        user_message: str,
        send: Callable[[str], Coroutine],
    ) -> bool:
        """Returns True on success (Done received), False on graceful failure."""
        # ── Context compression ───────────────────────────────────────────
        task_md = self.task_dir / "TASK.md"
        self.history = await maybe_compress(
            self.history, self.provider, task_md_path=task_md
        )

        tools = get_schemas(self.provider.tool_format)
        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self.history

        from config import get_settings_dict
        max_tool_rounds = get_settings_dict().get("max_tool_rounds", 8)

        assistant_text = ""
        tool_rounds = 0

        while tool_rounds <= max_tool_rounds:
            pending_tool_calls: list[ToolCall] = []
            full_assistant_content: list[dict] | None = None  # Populated when extended thinking is on

            # Stream from LLM
            async for event in self.provider.chat(messages, tools):
                if isinstance(event, ThinkingDelta):
                    await send(_ws_event("think_delta", content=event.content))

                elif isinstance(event, TextDelta):
                    assistant_text += event.content
                    await send(_ws_event("text_delta", content=event.content))

                elif isinstance(event, ToolCall):
                    pending_tool_calls.append(event)
                    await send(_ws_event(
                        "tool_call",
                        call_id=event.call_id,
                        name=event.name,
                        input=event.input,
                    ))

                elif isinstance(event, Done):
                    full_assistant_content = event.full_content
                    # Exit only when there are no pending tool calls.
                    # Anthropic uses stop_reason="tool_use"; Ollama uses "tool_calls".
                    # Rather than matching strings, trust the actual pending list.
                    if not pending_tool_calls:
                        if full_assistant_content is not None:
                            # Round-trip thinking blocks with signatures (required by Anthropic)
                            self.history.append({
                                "role": "assistant",
                                "content": full_assistant_content,
                            })
                        elif assistant_text:
                            self.history.append({
                                "role": "assistant",
                                "content": assistant_text,
                            })
                        self._save_history()
                        self._schedule_commit(f"agent: turn – {user_message[:60]}")
                        await send(_ws_event("done"))
                        return True

            if not pending_tool_calls:
                # Stream ended without a Done event or tool calls — surface the issue
                await send(_ws_event("error", message="模型响应流异常结束（未收到完整响应），请重试。"))
                return False

            # Execute all pending tool calls, collecting results
            from agent.tools.base import missing_backend_dep_error
            from agent.tools.data._utils import BackendDepMissing

            results: list[tuple[ToolCall, dict, bool]] = []
            for tc in pending_tool_calls:
                tool = TOOL_REGISTRY.get(tc.name)
                if tool is None:
                    result = {"error": f"Unknown tool: {tc.name}"}
                    ok = False
                else:
                    try:
                        result = await tool.run(tc.input, self.runner)
                        ok = result.get("ok", True)
                    except BackendDepMissing as e:
                        # Surface a specific, actionable message so the model
                        # knows NOT to call install_package (which won't help).
                        result = missing_backend_dep_error(e.module)
                        ok = False
                    except Exception as e:
                        # Fallback: some tools may import pandas at module top
                        # level or via other helpers and raise plain ImportError.
                        msg = str(e)
                        if isinstance(e, ImportError) and "'" in msg:
                            mod = msg.split("'")[1]
                            result = missing_backend_dep_error(mod)
                        else:
                            result = {"error": msg}
                        ok = False
                results.append((tc, result, ok))
                await send(_ws_event(
                    "tool_result",
                    call_id=tc.call_id,
                    name=tc.name,
                    output=result,
                    ok=ok,
                ))

            # ── Auto-index successful charts into RAG ─────────────────────
            for tc, res, ok in results:
                if tc.name == "execute_python" and ok:
                    plot_py = self.task_dir / "chart" / "plot.py"
                    if plot_py.exists():
                        try:
                            from agent.rag.chart_rag import get_rag
                            get_rag().index_chart(
                                code=plot_py.read_text(),
                                metadata={"task_dir": str(self.task_dir)},
                            )
                        except Exception:
                            pass  # RAG failure must never break the agent loop

            # ── Auto-validate chart after execution ──────────────────────
            for tc, res, ok in results:
                if tc.name in ("execute_python", "render_chart") and ok:
                    chart_json_file = self.task_dir / "chart" / "chart.json"
                    svg_file = self.task_dir / "chart" / "output.svg"  # legacy fallback
                    data_file = self.task_dir / "processed" / "data.csv"
                    validate_target = svg_file if svg_file.exists() else None
                    if validate_target and validate_target.exists():
                        issues = validate_chart(
                            validate_target,
                            data_file if data_file.exists() else None,
                        )
                        # Optional: multimodal visual check
                        # Only run if (a) deterministic checks passed cleanly, and
                        # (b) we haven't already retried too many times this turn,
                        # to avoid runaway costs and infinite loops.
                        from config import get_settings_dict
                        settings = get_settings_dict()
                        visual_enabled = settings.get(
                            "visual_feedback", False
                        )
                        if (
                            visual_enabled
                            and not any(i.get("level") == "error" for i in issues)
                            and self._visual_retries < MAX_VISUAL_RETRIES_PER_TURN
                        ):
                            try:
                                visual_issues = await validate_chart_visual(
                                    svg_file,
                                    provider_name=settings.get("default_provider", "anthropic"),
                                )
                                if visual_issues:
                                    self._visual_retries += 1
                                issues += visual_issues
                            except Exception as e:
                                # Never let visual check break the turn
                                pass

                        notice = format_issues_for_agent(issues)
                        if notice:
                            await send(_ws_event(
                                "context_notice", content=notice
                            ))
                            # Inject into tool result so agent sees it
                            res["_validation"] = notice

            # Append tool call + results in the format the provider expects
            if self.provider.tool_format == "anthropic":
                if full_assistant_content is not None:
                    # full_content already has thinking blocks (with signatures), text, and tool_use
                    messages.append({"role": "assistant", "content": full_assistant_content})
                else:
                    content_blocks = []
                    if assistant_text:
                        content_blocks.append({"type": "text", "text": assistant_text})
                    for tc, _, _ in results:
                        content_blocks.append({
                            "type": "tool_use",
                            "id": tc.call_id,
                            "name": tc.name,
                            "input": tc.input,
                        })
                    messages.append({"role": "assistant", "content": content_blocks})
                messages.append({"role": "user", "content": [
                    {"type": "tool_result", "tool_use_id": tc.call_id,
                     "content": json.dumps(res)}
                    for tc, res, _ in results
                ]})
            else:  # openai / ollama
                messages.append({
                    "role": "assistant",
                    "content": assistant_text or None,
                    "tool_calls": [
                        {"id": tc.call_id, "type": "function",
                         "function": {"name": tc.name, "arguments": json.dumps(tc.input)}}
                        for tc, _, _ in results
                    ],
                })
                for tc, res, _ in results:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.call_id,
                        "content": json.dumps(res),
                    })

            assistant_text = ""

            tool_rounds += 1

        # Hit round limit — history rollback handled by run_turn
        await send(_ws_event("error", message=f"已达到最大工具调用轮次（{max_tool_rounds} 轮）。如需更多轮次，请在设置中调整 max_tool_rounds。"))
        return False

    # ── Git debounce ───────────────────────────────────────────────────────

    def _schedule_commit(self, message: str) -> None:
        from git_manager.manager import GitManager
        loop = asyncio.get_event_loop()
        if self._commit_handle:
            self._commit_handle.cancel()

        def _do_commit():
            gm = GitManager(self.runner.project_dir)
            asyncio.ensure_future(gm.auto_commit(message))

        self._commit_handle = loop.call_later(1.2, _do_commit)

