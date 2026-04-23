"""
config_block.py — Parse and patch the CHART CONFIG block in plot.py.

Every plot.py starts with a machine-readable CONFIG block:

    # ══════════════════════════════════════════════════════════════
    # CHART CONFIG  (machine-readable — do not rename variables)
    # @prop figsize        tuple2f
    # @prop title          str
    # @prop bar_alpha      float    0,1
    # @prop legend_loc     enum     best|upper right|upper left
    # ══════════════════════════════════════════════════════════════

    FIGSIZE     = (6.0, 4.0)
    TITLE       = "My Title"
    BAR_ALPHA   = 0.85
    LEGEND_LOC  = "best"

Rules:
- Each `# @prop <key> <type> [<extra>]` maps to Python variable `KEY.upper()`
- Values are read from the Python variable definitions, not from @prop lines
- @prop lines carry only type metadata (drives frontend widget selection)
- `extra` field: float/int → "min,max"; enum → "opt1|opt2|opt3"
"""

import ast
import re
from dataclasses import dataclass
from typing import Any

# ── Regexes ────────────────────────────────────────────────────────────────

BLOCK_HEADER_RE = re.compile(
    r'#[^\n]*CHART\s+CONFIG',
    re.IGNORECASE | re.MULTILINE,
)

PROP_LINE_RE = re.compile(
    r'^#[ \t]*@prop[ \t]+(?P<key>\w+)[ \t]+(?P<type>[\w_]+)(?:[ \t]+(?P<extra>[^\n\r]+?))?[ \t]*$',
    re.MULTILINE,
)

# Matches UPPERCASE variable assignments (CONFIG variables only)
VAR_LINE_RE = re.compile(
    r'^(?P<name>[A-Z][A-Z0-9_]*)\s*=\s*(?P<val>[^\n]+)',
    re.MULTILINE,
)

VALID_TYPES = frozenset({
    'float', 'int', 'bool', 'str', 'color',
    'tuple2f', 'tuple2f_opt', 'list_color', 'enum',
})


# ── Data model ─────────────────────────────────────────────────────────────

@dataclass
class ConfigProp:
    key: str       # lowercase: 'figsize', 'bar_alpha'
    type: str      # one of VALID_TYPES
    extra: str     # range "0,1" or options "best|upper right"
    var_name: str  # Python variable: 'FIGSIZE', 'BAR_ALPHA'
    value: Any     # parsed Python value from variable definition
    raw_val: str   # raw string from variable line (e.g. "(6.0, 4.0)")


# ── Public API ─────────────────────────────────────────────────────────────

def config_block_present(code: str) -> bool:
    """Return True if plot.py contains a CHART CONFIG header."""
    return bool(BLOCK_HEADER_RE.search(code))


def parse_props(code: str) -> list[ConfigProp]:
    """
    Parse all @prop annotations and their corresponding Python variable values.
    Silently skips @prop lines whose variable is not defined or whose type is unknown.
    """
    # Build map of UPPERCASE var name → (parsed_value, raw_string)
    var_values: dict[str, tuple[Any, str]] = {}
    for m in VAR_LINE_RE.finditer(code):
        name = m.group('name')
        raw = m.group('val').strip()
        try:
            parsed = ast.literal_eval(raw)
        except (ValueError, SyntaxError):
            parsed = raw
        var_values[name] = (parsed, raw)

    props: list[ConfigProp] = []
    for m in PROP_LINE_RE.finditer(code):
        key = m.group('key')
        prop_type = m.group('type')
        extra = (m.group('extra') or '').strip()

        if prop_type not in VALID_TYPES:
            continue

        var_name = key.upper()
        info = var_values.get(var_name)
        if info is None:
            continue

        value, raw_val = info
        props.append(ConfigProp(
            key=key,
            type=prop_type,
            extra=extra,
            var_name=var_name,
            value=value,
            raw_val=raw_val,
        ))

    return props


def get_declared_keys(code: str) -> set[str]:
    """Return all keys declared via @prop (whether or not their var is defined)."""
    return {m.group('key') for m in PROP_LINE_RE.finditer(code)}


def patch_prop(code: str, key: str, new_raw_value: str) -> tuple[bool, str, str]:
    """
    Patch a single CONFIG property in plot.py source code.

    Updates only the Python variable definition (e.g. `FIGSIZE = ...`).
    The @prop annotation is left unchanged — it carries type metadata, not values.

    Args:
        code:          full plot.py source
        key:           property key, lowercase (e.g. 'figsize', 'bar_alpha')
        new_raw_value: Python-literal string (e.g. '(7.0, 5.0)', '0.85', '"New Title"')

    Returns:
        (success, patched_code, message)
    """
    # Validate the incoming value is a legal Python literal
    try:
        ast.literal_eval(new_raw_value)
    except (ValueError, SyntaxError) as exc:
        return False, code, f"Invalid Python literal for {key!r}: {new_raw_value!r} — {exc}"

    var_name = key.upper()
    pattern = re.compile(rf'^({re.escape(var_name)}\s*=\s*).*$', re.MULTILINE)
    replacement = f'{var_name} = {new_raw_value}'
    patched, n = pattern.subn(replacement, code, count=1)

    if n == 0:
        return False, code, f"Variable {var_name} not found in plot.py"

    return True, patched, f"Patched {var_name} = {new_raw_value}"


def props_to_api_dict(props: list[ConfigProp]) -> dict:
    """Serialize props list to a JSON-safe dict for API responses."""
    result = {}
    for p in props:
        entry: dict[str, Any] = {
            'type': p.type,
            'var_name': p.var_name,
            'value': p.value,
            'raw_val': p.raw_val,
        }
        if p.extra:
            entry['extra'] = p.extra
        result[p.key] = entry
    return result
