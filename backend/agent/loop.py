"""
Agent turn loop.
One AgentLoop instance per active task. Maintains conversation history
and drives the tool-use cycle until the model returns stop_reason=end_turn
or the tool round limit is reached.
"""
import asyncio
import json
from pathlib import Path
from typing import Callable, Coroutine

from agent.providers.base import Done, LLMProvider, TextDelta, ToolCall
from agent.tools import TOOL_REGISTRY, get_schemas
from sandbox.runner import SandboxRunner

MAX_TOOL_ROUNDS = 8
CONTEXT_FILE = ".plotsmith/context.json"

SYSTEM_PROMPT = """\
You are OpenPlotAgent, an AI assistant specialized in generating publication-quality \
academic charts using matplotlib with PGF backend.

Guidelines:
- Always save output as 'output.svg' (and optionally 'output.pdf') in the working directory
- Set gid on all matplotlib elements: ax.set_gid('axes'), title.set_gid('title'), etc.
- Use Okabe-Ito palette by default unless the user specifies otherwise
- Write clean, well-structured plot.py files
- When you execute code that fails, analyze the error and fix it before giving up
- After generating a chart, briefly describe what you made and any key decisions
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
        self._load_history()

    # ── Persistence ────────────────────────────────────────────────────────

    def _load_history(self) -> None:
        ctx = self.task_dir / CONTEXT_FILE
        if ctx.exists():
            try:
                self.history = json.loads(ctx.read_text()).get("messages", [])
            except Exception:
                self.history = []

    def _save_history(self) -> None:
        ctx = self.task_dir / CONTEXT_FILE
        ctx.parent.mkdir(parents=True, exist_ok=True)
        ctx.write_text(json.dumps({"messages": self.history}, indent=2))

    # ── Main turn ──────────────────────────────────────────────────────────

    async def run_turn(
        self,
        user_message: str,
        send: Callable[[str], Coroutine],
    ) -> None:
        """
        Execute one complete agent turn.
        `send` is an async callable that sends a JSON string over WebSocket.
        """
        self.history.append({"role": "user", "content": user_message})
        tools = get_schemas(self.provider.tool_format)
        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self.history

        assistant_text = ""
        tool_rounds = 0

        while tool_rounds <= MAX_TOOL_ROUNDS:
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
                    except Exception as e:
                        result = {"error": str(e)}
                        ok = False
                results.append((tc, result, ok))
                await send(_ws_event(
                    "tool_result",
                    call_id=tc.call_id,
                    name=tc.name,
                    output=result,
                    ok=ok,
                ))

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
        await send(_ws_event("error", message=f"Exceeded max tool rounds ({MAX_TOOL_ROUNDS})"))
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
