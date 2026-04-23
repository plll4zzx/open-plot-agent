"""
plot_code_validator.py — Static checks on plot.py source code.

Runs synchronously inside write_file() when the agent writes chart/plot.py,
before execution.  Gives the agent early, actionable feedback so it can fix
convention violations without a wasted execute_python round-trip.

Checks (in order):
  0. config_block   — CHART CONFIG block with @prop annotations required
  1. syntax         — ast.parse()
  1b. duplicate_kwarg — duplicate keyword args in any function call
  2. config_vars    — every @prop must have a matching Python variable
  3. naming_fig     — `fig` variable must be assigned
  4. naming_gca     — plt.gca() must not be used
  5. figsize_var    — plt.subplots() must use figsize=FIGSIZE, not hardcoded tuple
  6. palette        — PALETTE = [...] top-level list required
  7. palette_used   — chart calls must use PALETTE[n], not hardcoded hex colors
  8. literal_*      — set_title / xlabel / ylabel must use variable or literal string
  9. gid_*          — set_gid() calls required for title, xlabel, ylabel
  10. savefig       — fig.savefig("output.svg") required
"""

import ast
import re
from typing import TypedDict


class Issue(TypedDict):
    level: str   # "error" | "warning"
    check: str
    message: str


def validate_plot_code(code: str) -> list[Issue]:
    """
    Statically validate plot.py content.  Returns [] if all checks pass.
    CONFIG block checks run first; syntax error causes early return.
    """
    from agent.config_block import (
        config_block_present, get_declared_keys, VAR_LINE_RE,
    )

    issues: list[Issue] = []

    # ── 0. CHART CONFIG block ─────────────────────────────────────────────
    if not config_block_present(code):
        issues.append(_err(
            "config_block_missing",
            "plot.py must begin with a CHART CONFIG block containing @prop annotations. "
            "See the pipeline requirements in your instructions for the exact format. "
            "Example:\n"
            "  # ══════════════════════════════════\n"
            "  # CHART CONFIG  (machine-readable)\n"
            "  # @prop figsize    tuple2f\n"
            "  # @prop title      str\n"
            "  # @prop bar_alpha  float  0,1\n"
            "  # ══════════════════════════════════\n"
            "  FIGSIZE   = (6.0, 4.0)\n"
            "  TITLE     = \"My Chart\"\n"
            "  BAR_ALPHA = 0.85",
        ))

    # ── 1. Syntax ─────────────────────────────────────────────────────────
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return issues + [_err("syntax", f"SyntaxError on line {exc.lineno}: {exc.msg}")]

    # ── 1b. Duplicate keyword arguments ──────────────────────────────────
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        seen_kw: set[str] = set()
        for kw in node.keywords:
            if kw.arg is None:
                continue  # **kwargs unpack
            if kw.arg in seen_kw:
                try:
                    func_repr = ast.unparse(node.func)
                except Exception:
                    func_repr = '?'
                issues.append(_err(
                    "duplicate_kwarg",
                    f"Duplicate keyword argument `{kw.arg}` in `{func_repr}()` on line {node.lineno}. "
                    "This is a SyntaxError at runtime. "
                    "Do not pass both a CONFIG variable (e.g. fontsize=TITLE_SIZE) and a "
                    "hardcoded value (e.g. fontsize=17.0) — use only the CONFIG variable.",
                ))
            seen_kw.add(kw.arg)

    # ── 2. CONFIG variable binding ────────────────────────────────────────
    if config_block_present(code):
        defined_vars = {m.group('name') for m in VAR_LINE_RE.finditer(code)}
        for key in get_declared_keys(code):
            var_name = key.upper()
            if var_name not in defined_vars:
                issues.append(_err(
                    "config_var_unbound",
                    f"@prop '{key}' is declared but Python variable {var_name} is not defined. "
                    f"Add: {var_name} = <default_value> below the CONFIG header.",
                ))

    # ── 3. Variable naming: fig ───────────────────────────────────────────
    if not re.search(r'\bfig\s*[,=(]', code):
        issues.append(_warn(
            "naming_fig",
            "No `fig` variable found. Use `fig, ax = plt.subplots()` or "
            "`fig = plt.figure()`. The patcher and savefig call both rely on `fig`.",
        ))

    if re.search(r'\bplt\.gca\s*\(\)', code):
        issues.append(_warn(
            "naming_gca",
            "`plt.gca()` detected. Assign axes explicitly: "
            "`fig, ax = plt.subplots()` so the UI can patch `ax.legend()` calls.",
        ))

    # ── 4. figsize must use FIGSIZE variable ──────────────────────────────
    if re.search(r'plt\.subplots\s*\([^)]*figsize\s*=\s*\(', code):
        issues.append(_warn(
            "figsize_hardcoded",
            "plt.subplots() uses a hardcoded figsize tuple. "
            "Replace with `figsize=FIGSIZE` so the Properties panel can resize the figure.",
        ))

    # ── 5. PALETTE list ───────────────────────────────────────────────────
    if not re.search(r'\bPALETTE\s*=\s*\[', code, re.IGNORECASE):
        issues.append(_warn(
            "palette_missing",
            "No `PALETTE = [...]` list defined. Add one in the CONFIG variables section. "
            'Default: ["#E69F00","#56B4E9","#009E73","#F0E442","#0072B2","#D55E00","#CC79A7"]',
        ))

    # ── 6. Chart calls must use PALETTE[n], not hardcoded hex ────────────
    _CHART_CALLS = r'ax\.(bar|barh|plot|scatter|fill_between|stackplot)\s*\('
    if re.search(r'\bPALETTE\s*=\s*\[', code, re.IGNORECASE):
        if re.search(_CHART_CALLS + r'[^)]*\bcolor\s*=\s*[\'"]#[0-9A-Fa-f]{3,6}[\'"]', code):
            issues.append(_warn(
                "hardcoded_color_in_chart",
                "A chart call uses a hardcoded hex color instead of PALETTE[n]. "
                "Use PALETTE[0], PALETTE[1], … so the palette-swap and color Properties "
                "panel control work correctly.",
            ))

    # ── 7. Literal strings in text setters ───────────────────────────────
    CONFIG_VAR_NAMES = {'TITLE', 'XLABEL', 'YLABEL', 'SUPTITLE'}
    TEXT_SETTERS = {"set_title", "suptitle", "set_xlabel", "set_ylabel"}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func_name = (
            node.func.attr
            if isinstance(node.func, ast.Attribute)
            else (node.func.id if isinstance(node.func, ast.Name) else None)
        )
        if func_name not in TEXT_SETTERS or not node.args:
            continue
        first = node.args[0]
        is_literal = isinstance(first, ast.Constant) and isinstance(first.value, str)
        is_config_var = isinstance(first, ast.Name) and first.id in CONFIG_VAR_NAMES
        if not (is_literal or is_config_var):
            issues.append(_warn(
                "literal_title",
                f"`{func_name}()` on line {node.lineno} uses `{ast.unparse(first)}` "
                "as its first argument. Use a literal string or a CONFIG variable "
                "(TITLE / XLABEL / YLABEL) so the Properties panel and inline editor "
                "can update it without invoking the agent.",
            ))

    # ── 8. GID assignments ────────────────────────────────────────────────
    if "set_gid" not in code:
        issues.append(_err(
            "gid_missing",
            "No `set_gid()` calls found. Semantic GIDs are required for interactive "
            "editing in the preview. At minimum add:\n"
            "  ax.title.set_gid('title')\n"
            "  ax.xaxis.label.set_gid('xlabel')\n"
            "  ax.yaxis.label.set_gid('ylabel')\n"
            "  leg.set_gid('legend')",
        ))
    else:
        for gid in ("title", "xlabel", "ylabel"):
            pattern = rf"""set_gid\s*\(\s*['"]({gid}|{gid}_\d+)['"]\s*\)"""
            if not re.search(pattern, code):
                issues.append(_warn(
                    f"gid_{gid}",
                    f"No `set_gid('{gid}')` or `set_gid('{gid}_N')` found. "
                    "Without it the UI cannot highlight or inline-edit this element.",
                ))

    # ── 9. savefig ────────────────────────────────────────────────────────
    if "savefig" not in code:
        issues.append(_err(
            "savefig_missing",
            "No `savefig()` call found. Add `fig.savefig('output.svg')` at the end.",
        ))
    elif not re.search(r'\bfig\.savefig\s*\(', code):
        issues.append(_warn(
            "savefig_not_on_fig",
            "`savefig()` is not called on `fig`. Use `fig.savefig('output.svg')`.",
        ))

    return issues


# ── Formatting ─────────────────────────────────────────────────────────────────

def format_code_issues(issues: list[Issue]) -> str | None:
    """Return a compact notice string for the agent, or None if no issues."""
    if not issues:
        return None

    errors = [i for i in issues if i["level"] == "error"]
    warnings = [i for i in issues if i["level"] == "warning"]

    lines = ["[CODE VALIDATOR] plot.py convention check:"]
    if errors:
        lines.append(f"\n❌ Errors ({len(errors)}) — must fix before execution:")
        for e in errors:
            lines.append(f"  [{e['check']}] {e['message']}")
    if warnings:
        lines.append(f"\n⚠️  Warnings ({len(warnings)}) — fix for full UI interactivity:")
        for w in warnings:
            lines.append(f"  [{w['check']}] {w['message']}")
    lines.append("\nPlease fix and rewrite chart/plot.py.")
    return "\n".join(lines)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _err(check: str, message: str) -> Issue:
    return {"level": "error", "check": check, "message": message}

def _warn(check: str, message: str) -> Issue:
    return {"level": "warning", "check": check, "message": message}
