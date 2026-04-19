"""
Base Tool class and shared utilities for all agent tools.
"""
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sandbox.runner import SandboxRunner


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict  # Anthropic "input_schema" format

    async def run(self, args: dict[str, Any], runner: SandboxRunner) -> dict:
        raise NotImplementedError


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
