"""
Abstract LLM provider interface.
All providers yield AgentEvents so the agent loop stays provider-agnostic.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator


@dataclass
class TextDelta:
    content: str


@dataclass
class ToolCall:
    call_id: str
    name: str
    input: dict[str, Any]


@dataclass
class ToolResult:
    call_id: str
    name: str
    output: Any
    ok: bool


@dataclass
class ThinkingDelta:
    content: str


@dataclass
class Done:
    stop_reason: str = "end_turn"
    full_content: list[dict] | None = None  # Populated by Anthropic when extended thinking is on


AgentEvent = TextDelta | ThinkingDelta | ToolCall | ToolResult | Done


@dataclass
class ProviderConfig:
    model: str
    api_key: str = ""
    base_url: str = ""
    temperature: float = 0.3
    max_tokens: int = 8192
    extra: dict[str, Any] = field(default_factory=dict)


class LLMProvider(ABC):
    def __init__(self, config: ProviderConfig):
        self.config = config

    @abstractmethod
    async def chat(
        self,
        messages: list[dict],
        tools: list[dict],
    ) -> AsyncIterator[AgentEvent]: ...

    @property
    @abstractmethod
    def tool_format(self) -> str:
        """'anthropic' or 'openai' — determines schema format expected by this provider."""
        ...
