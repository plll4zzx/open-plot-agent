"""
Base Tool class and shared utilities for all agent tools.

Adding a new tool:
    1. Pick the right category sub-package (file/, data/, chart/, env/, git/, memory/)
       — or create a new one.
    2. Drop a module in it that defines a class subclassing ``Tool`` with
       ``category="<your-category>"``.
    3. Decorate the class with ``@register_tool``. That's it — auto-discovery in
       ``agent.tools.__init__`` will pick it up the next time the registry is
       built.

Why this shape:
    * Categories are first-class so the UI / docs can group tools.
    * Decorator-based registration means no central list to keep in sync.
    * The Tool dataclass remains small and provider-agnostic; transports
      (Anthropic vs OpenAI) translate it via ``get_schemas()``.
"""
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, ClassVar

from sandbox.runner import SandboxRunner


# Known categories. New tools may use any string, but staying within these
# keeps the UI grouping coherent.
KNOWN_CATEGORIES = {
    "file",        # 文件工具 — list/read/write workspace files
    "data",        # 表格工具 — pandas-backed inspect/query/transform/recommend
    "chart",       # 图片工具 — render plots, future image ops
    "env",         # 环境工具 — execute python, install packages
    "git",         # Git 工具 — log/diff/restore on the task repo
    "memory",      # 记忆工具 — read/write GLOBAL/PROJECT/EXPERIMENT/TASK md
}


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict           # Anthropic "input_schema" format
    category: str = "misc"       # one of KNOWN_CATEGORIES, or custom

    async def run(self, args: dict[str, Any], runner: SandboxRunner) -> dict:
        raise NotImplementedError


# Registry that ``@register_tool`` writes into. Resolved into a name-keyed
# dict by ``agent.tools.__init__`` after auto-discovery walks the package.
_REGISTERED: list[type[Tool]] = []


def register_tool(cls: type[Tool]) -> type[Tool]:
    """Class decorator that marks a Tool subclass for auto-registration.

    Use it at class definition time:

        @register_tool
        class ListFilesTool(Tool):
            def __init__(self):
                super().__init__(
                    name="list_files",
                    category="file",
                    ...
                )
    """
    if not isinstance(cls, type) or not issubclass(cls, Tool):
        raise TypeError(f"@register_tool only applies to Tool subclasses, got {cls!r}")
    _REGISTERED.append(cls)
    return cls


def registered_tool_classes() -> list[type[Tool]]:
    """Return the list of Tool classes registered via @register_tool."""
    return list(_REGISTERED)


def safe_json(val: Any) -> Any:
    """Convert numpy/pandas types to JSON-safe Python types."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    # Handle numpy types via duck-typing (avoids top-level numpy import)
    t = type(val).__name__
    if t in ("int64", "int32", "int16", "int8", "uint64", "uint32", "uint16", "uint8"):
        return int(val)
    if t in ("float64", "float32", "float16"):
        return round(float(val), 6)
    return val


def missing_backend_dep_error(module_name: str) -> dict:
    """
    Build an agent-facing error dict for a missing backend-side dependency.
    Crucially tells the agent NOT to call install_package — that tool only
    touches the per-task sandbox venv, not the backend's venv.
    """
    return {
        "error": (
            f"No module named '{module_name}' in the backend Python environment. "
            f"This is a backend setup issue — install_package will NOT fix it because "
            f"install_package installs into the per-task sandbox venv, not the backend. "
            f"The user must run `uv pip install {module_name}` (or `pip install {module_name}`) "
            f"inside backend/.venv and restart uvicorn."
        ),
        "hint": "backend_dependency_missing",
        "module": module_name,
    }
