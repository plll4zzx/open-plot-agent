"""
Ollama provider via OpenAI-compatible endpoint.
Default model: qwen3:35b (streaming tool_use).

Handles Qwen3's <think>...</think> blocks:
- Streams thinking content as ThinkingDelta (displayed collapsed in frontend)
- Supports thinking_budget config to limit thinking tokens
- Appends /nothink to system prompt if thinking is disabled
"""
import json
from typing import AsyncIterator

from openai import AsyncOpenAI

from .base import AgentEvent, Done, LLMProvider, ProviderConfig, TextDelta, ToolCall

DEFAULT_BASE_URL = "http://localhost:11434/v1"

# Max thinking tokens before we stop relaying thinking content.
# The model still generates it but the frontend won't get overwhelmed.
DEFAULT_THINKING_BUDGET = 4096


class OllamaProvider(LLMProvider):
    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self._client = AsyncOpenAI(
            base_url=config.base_url or DEFAULT_BASE_URL,
            api_key="ollama",  # Ollama ignores the key but OpenAI SDK requires one
        )
        # Thinking configuration from extra config
        self._thinking_enabled = config.extra.get("thinking", True)
        self._thinking_budget = config.extra.get(
            "thinking_budget", DEFAULT_THINKING_BUDGET
        )

    @property
    def tool_format(self) -> str:
        return "openai"

    def _prepare_messages(self, messages: list[dict]) -> list[dict]:
        """Optionally inject /nothink into system prompt to disable Qwen3 thinking."""
        if self._thinking_enabled:
            return messages

        result = []
        for m in messages:
            if m["role"] == "system":
                content = m["content"]
                if "/nothink" not in content:
                    content = content + "\n\n/nothink"
                result.append({**m, "content": content})
            else:
                result.append(m)
        return result

    async def chat(
        self,
        messages: list[dict],
        tools: list[dict],
    ) -> AsyncIterator[AgentEvent]:
        prepared_messages = self._prepare_messages(messages)

        kwargs: dict = dict(
            model=self.config.model,
            messages=prepared_messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            stream=True,
        )
        if tools:
            kwargs["tools"] = [
                {"type": "function", "function": t} for t in tools
            ]
            kwargs["tool_choice"] = "auto"

        # Buffer for assembling streamed tool call arguments
        # key = tool_call index, value = {"id", "name", "args_buf"}
        pending_calls: dict[int, dict] = {}

        # Track thinking state for <think>...</think> tag handling
        _in_think = False
        _think_tokens = 0
        _text_buf = ""  # Buffer to detect <think> at stream start

        stream = await self._client.chat.completions.create(**kwargs)
        async for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            if choice is None:
                continue

            delta = choice.delta

            # Text content — handle <think> tags from Qwen3
            if delta.content:
                text = delta.content

                # Buffer the first few tokens to detect <think> at stream start
                if not _in_think and _think_tokens == 0 and len(_text_buf) < 20:
                    _text_buf += text
                    # Check if we have enough to decide
                    if _text_buf.startswith("<think>"):
                        _in_think = True
                        _think_tokens = 0
                        # Emit the <think> tag so frontend can parse it
                        yield TextDelta(content=_text_buf)
                        _text_buf = ""
                    elif len(_text_buf) >= 7 or not "<think>".startswith(_text_buf):
                        # Not a think block — flush buffer
                        yield TextDelta(content=_text_buf)
                        _text_buf = ""
                    continue

                if _in_think:
                    _think_tokens += len(text)
                    # Check for end of thinking
                    if "</think>" in text:
                        _in_think = False
                        yield TextDelta(content=text)
                    elif _think_tokens <= self._thinking_budget:
                        yield TextDelta(content=text)
                    # Beyond budget: silently drop thinking tokens
                    # (model still runs, but frontend won't get more thinking)
                else:
                    yield TextDelta(content=text)

            # Tool calls (may be streamed in pieces)
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in pending_calls:
                        pending_calls[idx] = {
                            "id": tc.id or f"call_{idx}",
                            "name": tc.function.name or "",
                            "args_buf": "",
                        }
                    else:
                        if tc.id:
                            pending_calls[idx]["id"] = tc.id
                        if tc.function.name:
                            pending_calls[idx]["name"] += tc.function.name
                    if tc.function.arguments:
                        pending_calls[idx]["args_buf"] += tc.function.arguments

            # Emit completed tool calls on finish
            if choice.finish_reason in ("tool_calls", "stop", "length"):
                # Flush any remaining buffer
                if _text_buf:
                    yield TextDelta(content=_text_buf)
                    _text_buf = ""
                # If we were in think and got cut off, close the tag
                if _in_think:
                    yield TextDelta(content="</think>")
                    _in_think = False

                for info in pending_calls.values():
                    try:
                        parsed = json.loads(info["args_buf"]) if info["args_buf"] else {}
                    except json.JSONDecodeError:
                        parsed = {"raw": info["args_buf"]}
                    yield ToolCall(
                        call_id=info["id"],
                        name=info["name"],
                        input=parsed,
                    )
                pending_calls.clear()

                # If stopped due to length, note it in the stop reason
                yield Done(stop_reason=choice.finish_reason)
