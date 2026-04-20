"""
plot_code_validator.py — Static checks on plot.py source code.

Runs synchronously inside write_file() when the agent writes chart/plot.py,
before execution.  Gives the agent early, actionable feedback so it can fix
convention violations without a wasted execute_python round-trip.

Checks (in order):
  1. syntax      — ast.parse()
  2. naming_fig  — `fig` variable must be assigned
  3. naming_gca  — plt.gca() must not be used
  4. palette     — PALETTE = [...] top-level list required
  5. literal_*   — set_title / suptitle / xlabel / ylabel must take string literals
  6. gid_*       — set_gid() calls required for title, xlabel, ylabel
  7. savefig     — fig.savefig("output.svg") required
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
    On syntax error returns immediately (further checks are meaningless).
    """
    # ── 1. Syntax ─────────────────────────────────────────────────────────
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return [_err("syntax", f"SyntaxError on line {exc.lineno}: {exc.msg}")]

    issues: list[Issue] = []

    # ── 2. Variable naming ────────────────────────────────────────────────
    # fig must be explicitly assigned so patches (legend position, savefig) work.
    if not re.search(r'\bfig\s*[,=(]', code):
        issues.append(_warn(
            "naming_fig",
            "No `fig` variable found. Use `fig, ax = plt.subplots()` or "
            "`fig = plt.figure()`. The patcher and savefig call both rely on `fig`.",
        ))

    # plt.gca() yields an anonymous axes — patches cannot target it reliably.
    if re.search(r'\bplt\.gca\s*\(\)', code):
        issues.append(_warn(
            "naming_gca",
            "`plt.gca()` detected. Assign axes explicitly: "
            "`fig, ax = plt.subplots()` so the UI can patch `ax.legend()` calls.",
        ))

    # ── 3. PALETTE list ───────────────────────────────────────────────────
    if not re.search(r'\bPALETTE\s*=\s*\[', code, re.IGNORECASE):
        issues.append(_warn(
            "palette_missing",
            "No `PALETTE = [...]` list defined. "
            "Add one at the top level so the palette-swap feature can hot-replace colors "
            "without invoking the LLM.  Default: "
            '["#E69F00","#56B4E9","#009E73","#F0E442","#0072B2","#D55E00","#CC79A7"]',
        ))

    # ── 4. Literal strings in text setters ────────────────────────────────
    TEXT_SETTERS = {"set_title", "suptitle", "set_xlabel", "set_ylabel"}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func_name = (
            node.func.attr
            if isinstance(node.func, ast.Attribute)
            else (node.func.id if isinstance(node.func, ast.Name) else None)
        )
        if func_name not in TEXT_SETTERS:
            continue
        if not node.args:
            continue
        first = node.args[0]
        if not isinstance(first, ast.Constant) or not isinstance(first.value, str):
            issues.append(_warn(
                "literal_title",
                f"`{func_name}()` on line {node.lineno} uses a non-literal first argument "
                f"({ast.unparse(first)!r}). "
                "In-browser text editing matches the literal string in source — "
                "use a plain string, e.g. `ax.set_title(\"My Title\")`.",
            ))

    # ── 5. GID assignments ────────────────────────────────────────────────
    if "set_gid" not in code:
        issues.append(_err(
            "gid_missing",
            "No `set_gid()` calls found. Semantic gids are required for hover / click / "
            "drag in the preview.  At minimum: "
            "`ax.title.set_gid('title')`, `ax.xaxis.label.set_gid('xlabel')`, "
            "`ax.yaxis.label.set_gid('ylabel')`, `leg.set_gid('legend')`.",
        ))
    else:
        for gid in ("title", "xlabel", "ylabel"):
            # Accept both plain ("title") and indexed ("title_0") forms.
            pattern = rf"""set_gid\s*\(\s*['"]({gid}|{gid}_\d+)['"]\s*\)"""
            if not re.search(pattern, code):
                issues.append(_warn(
                    f"gid_{gid}",
                    f"No `set_gid('{gid}')` or `set_gid('{gid}_N')` found. "
                    f"Without it the UI cannot highlight or inline-edit this element.",
                ))

    # ── 6. savefig ────────────────────────────────────────────────────────
    if "savefig" not in code:
        issues.append(_err(
            "savefig_missing",
            "No `savefig()` call found. Add `fig.savefig('output.svg')` at the end.",
        ))
    elif not re.search(r'\bfig\.savefig\s*\(', code):
        issues.append(_warn(
            "savefig_not_on_fig",
            "`savefig()` is not called on `fig`. Use `fig.savefig('output.svg')` "
            "so the render pipeline picks up the correct figure.",
        ))

    return issues


# ── Formatting ─────────────────────────────────────────────────────────────

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


# ── Helpers ────────────────────────────────────────────────────────────────

def _err(check: str, message: str) -> Issue:
    return {"level": "error", "check": check, "message": message}

def _warn(check: str, message: str) -> Issue:
    return {"level": "warning", "check": check, "message": message}
