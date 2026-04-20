"""
Anthropic API provider (claude-sonnet-4-6 default).
Uses native Anthropic tool_use format with streaming.
"""
import json
from typing import AsyncIterator

import anthropic

from .base import AgentEvent, Done, LLMProvider, ProviderConfig, TextDelta, ThinkingDelta, ToolCall


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

        thinking_enabled = self.config.extra.get("thinking", False)
        thinking_budget = int(self.config.extra.get("thinking_budget", 5000))

        kwargs: dict = dict(
            model=self.config.model,
            max_tokens=self.config.max_tokens,
            messages=filtered,
            tools=tools or [],
        )
        if system:
            kwargs["system"] = system

        if thinking_enabled:
            kwargs["thinking"] = {"type": "enabled", "budget_tokens": thinking_budget}
            kwargs["temperature"] = 1  # Required when extended thinking is enabled
            # Ensure max_tokens > budget_tokens so the model has room to respond
            kwargs["max_tokens"] = max(self.config.max_tokens, thinking_budget + 4096)
        else:
            kwargs["temperature"] = self.config.temperature

        async with self._client.messages.stream(**kwargs) as stream:
            current_tool: dict | None = None
            current_block_type: str = "text"
            input_buf = ""

            async for event in stream:
                etype = event.type

                if etype == "content_block_start":
                    block = event.content_block
                    if block.type == "thinking":
                        current_block_type = "thinking"
                    elif block.type == "tool_use":
                        current_block_type = "tool_use"
                        current_tool = {"id": block.id, "name": block.name}
                        input_buf = ""
                    else:
                        current_block_type = "text"

                elif etype == "content_block_delta":
                    delta = event.delta
                    if delta.type == "thinking_delta":
                        yield ThinkingDelta(content=delta.thinking)
                    elif delta.type == "text_delta":
                        yield TextDelta(content=delta.text)
                    elif delta.type == "input_json_delta":
                        input_buf += delta.partial_json

                elif etype == "content_block_stop":
                    if current_block_type == "tool_use" and current_tool is not None:
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
                    current_block_type = "text"

                elif etype == "message_stop":
                    final = await stream.get_final_message()
                    # Build full_content so the loop can round-trip thinking blocks
                    # (Anthropic requires thinking blocks be passed back in subsequent turns)
                    full_content: list[dict] | None = None
                    if thinking_enabled:
                        full_content = []
                        for block in final.content:
                            if block.type == "thinking":
                                full_content.append({
                                    "type": "thinking",
                                    "thinking": block.thinking,
                                    "signature": block.signature,
                                })
                            elif block.type == "text":
                                full_content.append({"type": "text", "text": block.text})
                            elif block.type == "tool_use":
                                full_content.append({
                                    "type": "tool_use",
                                    "id": block.id,
                                    "name": block.name,
                                    "input": block.input,
                                })
                    yield Done(stop_reason=final.stop_reason or "end_turn", full_content=full_content)
