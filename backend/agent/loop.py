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

from agent.providers.base import Done, LLMProvider, TextDelta, ToolCall
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
academic charts using matplotlib.

## Path conventions
Tool paths (list_files, read_file, write_file) are relative to the **task root**, NOT to chart/.
- `processed/data.csv`  — user's processed data (task-root-relative)
- `chart/plot.py`       — chart script (task-root-relative)
- `chart/output.svg`    — SVG output
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

## Required workflow
0. **Recall preferences** (first turn in a task only): quickly call memory_read('global') \
and memory_read('project') to pick up any standing style/journal/palette preferences. \
Skip if you've already read them earlier in this conversation.
1. **Discover data**: call summarize_data("processed/data.csv") for a quick overview, \
or inspect_data for detailed column info. If it doesn't exist, \
call summarize_data("raw/<filename>") to check what raw data is available. \
If the tool returns available_files, examine those files.
2. **Prepare data**: If raw data needs cleaning or subsetting, use transform_data or query_data \
to create a clean `processed/data.csv`. If the data is already in good shape in processed/, skip this step.
3. **Do NOT invent or generate sample data.** If no data files exist at all, ask the user to \
upload or paste their data.
4. **Write chart code**: write_file("chart/plot.py", <full script>). If the user is unsure \
what chart type fits, call recommend_charts(path) first.
5. **Execute**: execute_python(<same script>) — fix any errors, update plot.py, re-run
6. **Self-check**: After execution, review any validation warnings. Fix errors and re-run if needed.
7. **Persist preferences** (optional): if the user expressed a lasting preference during the \
conversation, record it with memory_write at the appropriate scope.

## Code requirements
- Read data: pd.read_csv("../processed/data.csv")
- Save output: fig.savefig("output.svg")
- Set MPLBACKEND="svg" is already configured — do not change it
- Assign semantic gids to every major element:
    title.set_gid("title")
    ax.xaxis.label.set_gid("xlabel")
    ax.yaxis.label.set_gid("ylabel")
    for i, patch in enumerate(ax.patches): patch.set_gid(f"bar_{i}")
    for i, line in enumerate(ax.lines): line.set_gid(f"line_{i}")
    for i, t in enumerate(ax.texts): t.set_gid(f"annotation_{i}")
- Default palette (Okabe-Ito): ["#E69F00","#56B4E9","#009E73","#F0E442","#0072B2","#D55E00","#CC79A7"]
- After success briefly describe what you made and any key design decisions
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
            self.history.append({"role": "user", "content": notice_text})
            # Notify frontend that context was injected
            await send(_ws_event("context_notice", content=notice_text))

        self.history.append({"role": "user", "content": user_message})

        # Reset per-turn counters
        self._visual_retries = 0

        try:
            await self._run_turn_inner(user_message, send)
        except asyncio.CancelledError:
            # Roll back any messages appended this turn so the in-memory
            # history stays consistent for the next request.
            del self.history[history_cursor:]
            raise

    async def _run_turn_inner(
        self,
        user_message: str,
        send: Callable[[str], Coroutine],
    ) -> None:
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

            # Stream from LLM
            async for event in self.provider.chat(messages, tools):
                if isinstance(event, TextDelta):
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
                    # Exit only when there are no pending tool calls.
                    # Anthropic uses stop_reason="tool_use"; Ollama uses "tool_calls".
                    # Rather than matching strings, trust the actual pending list.
                    if not pending_tool_calls:
                        if assistant_text:
                            self.history.append({
                                "role": "assistant",
                                "content": assistant_text,
                            })
                        self._save_history()
                        self._schedule_commit(f"agent: turn – {user_message[:60]}")
                        await send(_ws_event("done"))
                        return

            if not pending_tool_calls:
                # No tool calls and no Done — shouldn't happen, but exit safely
                break

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

            # ── Auto-validate chart after execution ──────────────────────
            for tc, res, ok in results:
                if tc.name in ("execute_python", "render_chart") and ok:
                    svg_file = self.task_dir / "chart" / "output.svg"
                    data_file = self.task_dir / "processed" / "data.csv"
                    if svg_file.exists():
                        issues = validate_chart(
                            svg_file,
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

        # Hit round limit
        await send(_ws_event("error", message=f"Exceeded max tool rounds ({max_tool_rounds}). Increase in Settings if needed."))
        self._save_history()

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
