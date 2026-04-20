"""
LiteLLM provider — supports 100+ models via a unified interface.

Model strings follow LiteLLM format:
  "openai/gpt-4o"
  "gemini/gemini-2.0-flash"
  "groq/llama-3.3-70b-versatile"
  "anthropic/claude-opus-4-7"   (without extended thinking)
  "ollama/qwen3.6:35b"          (falls back to OllamaProvider for think-tag support)

Set api_key via ProviderConfig.api_key or the model's native env var
(OPENAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, etc.).
"""
import json
from typing import AsyncIterator

import litellm

from .base import AgentEvent, Done, LLMProvider, ProviderConfig, TextDelta, ThinkingDelta, ToolCall

# Suppress LiteLLM's verbose logging
litellm.suppress_debug_info = True


class LiteLLMProvider(LLMProvider):
    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        # Optional custom base URL (e.g. Azure, local proxy)
        self._base_url = config.base_url or None
        self._api_key = config.api_key or None

    @property
    def tool_format(self) -> str:
        return "openai"

    async def chat(
        self,
        messages: list[dict],
        tools: list[dict],
    ) -> AsyncIterator[AgentEvent]:
        kwargs: dict = dict(
            model=self.config.model,
            messages=messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            stream=True,
        )
        if self._api_key:
            kwargs["api_key"] = self._api_key
        if self._base_url:
            kwargs["api_base"] = self._base_url
        if tools:
            # LiteLLM expects OpenAI-format tool definitions
            kwargs["tools"] = [{"type": "function", "function": t} for t in tools]
            kwargs["tool_choice"] = "auto"

        # Accumulate streamed tool call arguments by index
        pending_calls: dict[int, dict] = {}

        response = await litellm.acompletion(**kwargs)
        async for chunk in response:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            # Thinking content (Anthropic extended thinking via LiteLLM)
            thinking = getattr(delta, "thinking", None)
            if thinking:
                yield ThinkingDelta(content=thinking)

            # Regular text
            if delta.content:
                yield TextDelta(content=delta.content)

            # Streaming tool calls
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in pending_calls:
                        pending_calls[idx] = {
                            "id": tc.id or f"call_{idx}",
                            "name": tc.function.name or "",
                            "args": "",
                        }
                    else:
                        if tc.id:
                            pending_calls[idx]["id"] = tc.id
                        if tc.function.name:
                            pending_calls[idx]["name"] += tc.function.name
                    if tc.function.arguments:
                        pending_calls[idx]["args"] += tc.function.arguments

            if choice.finish_reason:
                for info in pending_calls.values():
                    try:
                        parsed = json.loads(info["args"]) if info["args"] else {}
                    except json.JSONDecodeError:
                        parsed = {"raw": info["args"]}
                    yield ToolCall(
                        call_id=info["id"],
                        name=info["name"],
                        input=parsed,
                    )
                pending_calls.clear()
                yield Done(stop_reason=choice.finish_reason)
