"""
Anthropic API provider (claude-sonnet-4-6 default).
Uses native Anthropic tool_use format with streaming.
"""
import json
from typing import AsyncIterator

import anthropic

from .base import AgentEvent, Done, LLMProvider, ProviderConfig, TextDelta, ToolCall


class AnthropicProvider(LLMProvider):
    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self._client = anthropic.AsyncAnthropic(api_key=config.api_key or None)

    @property
    def tool_format(self) -> str:
        return "anthropic"

    async def chat(
        self,
        messages: list[dict],
        tools: list[dict],
    ) -> AsyncIterator[AgentEvent]:
        # Separate system message if present
        system = ""
        filtered = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                filtered.append(m)

        kwargs = dict(
            model=self.config.model,
            max_tokens=self.config.max_tokens,
            temperature=self.config.temperature,
            messages=filtered,
            tools=tools or [],
        )
        if system:
            kwargs["system"] = system

        async with self._client.messages.stream(**kwargs) as stream:
            current_tool: dict | None = None
            input_buf = ""

            async for event in stream:
                etype = event.type

                if etype == "content_block_start":
                    block = event.content_block
                    if block.type == "tool_use":
                        current_tool = {"id": block.id, "name": block.name}
                        input_buf = ""

                elif etype == "content_block_delta":
                    delta = event.delta
                    if delta.type == "text_delta":
                        yield TextDelta(content=delta.text)
                    elif delta.type == "input_json_delta":
                        input_buf += delta.partial_json

                elif etype == "content_block_stop":
                    if current_tool is not None:
                        try:
                            parsed = json.loads(input_buf) if input_buf else {}
                        except json.JSONDecodeError:
                            parsed = {"raw": input_buf}
                        yield ToolCall(
                            call_id=current_tool["id"],
                            name=current_tool["name"],
                            input=parsed,
                        )
                        current_tool = None
                        input_buf = ""

                elif etype == "message_stop":
                    final = await stream.get_final_message()
                    yield Done(stop_reason=final.stop_reason or "end_turn")
