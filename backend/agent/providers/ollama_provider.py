"""
Ollama provider via OpenAI-compatible endpoint.
Default model: qwen3:35b (streaming tool_use).
"""
import json
from typing import AsyncIterator

from openai import AsyncOpenAI

from .base import AgentEvent, Done, LLMProvider, ProviderConfig, TextDelta, ToolCall

DEFAULT_BASE_URL = "http://localhost:11434/v1"


class OllamaProvider(LLMProvider):
    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self._client = AsyncOpenAI(
            base_url=config.base_url or DEFAULT_BASE_URL,
            api_key="ollama",  # Ollama ignores the key but OpenAI SDK requires one
        )

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

        stream = await self._client.chat.completions.create(**kwargs)
        async for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            if choice is None:
                continue

            delta = choice.delta

            # Text content
            if delta.content:
                yield TextDelta(content=delta.content)

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
            if choice.finish_reason in ("tool_calls", "stop"):
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
                yield Done(stop_reason=choice.finish_reason)
