"""
Agent tool registry.

Tools live under category sub-packages:

    file/      — 文件工具   (list/read/write workspace files)
    data/      — 表格工具   (inspect/query/transform/summarize/recommend)
    chart/     — 图片工具   (render_chart)
    env/       — 环境工具   (execute_python, install_package)
    git_ops/   — Git 工具   (git_log/git_diff/git_restore)
    memory/    — 记忆工具   (memory_read/memory_write)

Each tool class is decorated with ``@register_tool`` (see ``base.py``) so that
importing its module is enough to register it. This module walks every
sub-package once at import time, then freezes ``TOOL_REGISTRY``.

To add a new tool:
    1. Create a module under the appropriate category sub-folder.
    2. Define ``class YourTool(Tool)`` with ``category="<cat>"`` in ``__init__``.
    3. Decorate the class with ``@register_tool``.
    4. (Optional) re-export from that sub-package's ``__init__.py``.

No change needed here — auto-discovery will pick it up.
"""
from __future__ import annotations

import importlib
import logging
import pkgutil
from typing import Iterable

from agent.tools.base import (
    KNOWN_CATEGORIES,
    Tool,
    register_tool,
    registered_tool_classes,
)

logger = logging.getLogger(__name__)


def _discover_tool_modules() -> None:
    """Import every submodule under ``agent.tools.*`` so that any class
    decorated with ``@register_tool`` is registered.

    We walk the package tree rather than maintaining a manual import list,
    but we skip private modules (``_utils`` etc.) and ``base``/this module.
    """
    import agent.tools as pkg  # self-reference is fine

    for mod_info in pkgutil.walk_packages(pkg.__path__, prefix=f"{pkg.__name__}."):
        name = mod_info.name
        tail = name.rsplit(".", 1)[-1]
        if tail.startswith("_") or tail == "base":
            continue
        # Skip the top-level "agent.tools" itself (already imported).
        if name == pkg.__name__:
            continue
        try:
            importlib.import_module(name)
        except Exception as e:
            # Surface the failure but don't blow up the whole registry.
            logger.warning("Tool discovery failed for %s: %s", name, e)


def _build_registry() -> dict[str, Tool]:
    _discover_tool_modules()
    registry: dict[str, Tool] = {}
    for cls in registered_tool_classes():
        try:
            tool = cls()
        except Exception as e:
            logger.warning("Failed to instantiate %s: %s", cls.__name__, e)
            continue
        if tool.name in registry:
            logger.warning(
                "Duplicate tool name %r — %s overriding existing registration.",
                tool.name, cls.__name__,
            )
        registry[tool.name] = tool
    return registry


TOOL_REGISTRY: dict[str, Tool] = _build_registry()


def get_schemas(fmt: str) -> list[dict]:
    """Return tool schemas in 'anthropic' or 'openai' format."""
    schemas = []
    for tool in TOOL_REGISTRY.values():
        if fmt == "anthropic":
            schemas.append({
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            })
        else:  # openai / ollama
            schemas.append({
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema,
            })
    return schemas


def tools_by_category() -> dict[str, list[Tool]]:
    """Group the registered tools by category (useful for UI rendering)."""
    out: dict[str, list[Tool]] = {}
    for tool in TOOL_REGISTRY.values():
        out.setdefault(tool.category, []).append(tool)
    return out


__all__ = [
    "TOOL_REGISTRY",
    "Tool",
    "get_schemas",
    "register_tool",
    "registered_tool_classes",
    "tools_by_category",
    "KNOWN_CATEGORIES",
]
