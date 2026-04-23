"""
CodePatcher: deterministic regex-based modifications to plot.py
without invoking the LLM agent.

Supports:
- fill/facecolor changes for bars, patches, scatter
- line/stroke color changes
- text content changes (title, xlabel, ylabel, annotations)
- font-size changes
- stroke-width / linewidth changes
- alpha / opacity changes

The patcher reads plot.py, applies regex replacements, writes it back,
and re-executes to produce a new SVG.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class PatchResult:
    success: bool
    message: str
    patched_lines: list[int] = field(default_factory=list)
    original_code: str = ""
    patched_code: str = ""


# ── GID → code-location mapping heuristics ─────────────────────────────

def _find_title_call(code: str) -> list[tuple[int, str]]:
    """Find ax.set_title(...) calls."""
    results = []
    for i, line in enumerate(code.splitlines()):
        if re.search(r'\bset_title\s*\(', line):
            results.append((i, line))
    return results


def _find_suptitle_call(code: str) -> list[tuple[int, str]]:
    """Find fig.suptitle(...) / plt.suptitle(...) calls."""
    results = []
    for i, line in enumerate(code.splitlines()):
        if re.search(r'\bsuptitle\s*\(', line):
            results.append((i, line))
    return results


def _find_xlabel_call(code: str) -> list[tuple[int, str]]:
    results = []
    for i, line in enumerate(code.splitlines()):
        if re.search(r'\bset_xlabel\s*\(', line):
            results.append((i, line))
    return results


def _find_ylabel_call(code: str) -> list[tuple[int, str]]:
    results = []
    for i, line in enumerate(code.splitlines()):
        if re.search(r'\bset_ylabel\s*\(', line):
            results.append((i, line))
    return results


def _find_color_in_palette(code: str, index: int) -> tuple[int, int, int] | None:
    """Find the Nth color in a PALETTE = [...] list.
    Returns (line_no, start_col, end_col) of the color string."""
    palette_match = re.search(
        r'(?:PALETTE|palette|colors|COLORS)\s*=\s*\[([^\]]+)\]',
        code, re.IGNORECASE | re.DOTALL
    )
    if not palette_match:
        return None

    colors_str = palette_match.group(1)
    color_pattern = re.compile(r'''['"]([^'"]+)['"]''')
    matches = list(color_pattern.finditer(colors_str))

    if index >= len(matches):
        return None

    target = matches[index]
    # Calculate absolute position
    abs_start = palette_match.start(1) + target.start(1)
    abs_end = palette_match.start(1) + target.end(1)

    # Convert to line/col
    before = code[:abs_start]
    line_no = before.count('\n')
    return (line_no, abs_start, abs_end)


# ── Patchers ────────────────────────────────────────────────────────────

def patch_text(code: str, gid: str, new_text: str, original_value: str | None = None) -> PatchResult:
    """Patch text content for title/suptitle/xlabel/ylabel (and numbered variants)."""
    lines = code.splitlines()
    patched_lines = []

    # Map numbered/variant gids to their canonical form.
    canonical = gid
    if gid.startswith('title_'):
        canonical = 'title'
    elif gid.startswith('xlabel_'):
        canonical = 'xlabel'
    elif gid.startswith('ylabel_'):
        canonical = 'ylabel'

    if canonical == 'suptitle':
        targets = _find_suptitle_call(code)
        setter_re = r'''(suptitle\s*\()(['"])(.*?)\2'''
    elif canonical == 'title':
        targets = _find_title_call(code)
        setter_re = r'''(set_title\s*\()(['"])(.*?)\2'''
    elif canonical == 'xlabel':
        targets = _find_xlabel_call(code)
        setter_re = r'''(set_xlabel\s*\()(['"])(.*?)\2'''
    elif canonical == 'ylabel':
        targets = _find_ylabel_call(code)
        setter_re = r'''(set_ylabel\s*\()(['"])(.*?)\2'''
    else:
        return PatchResult(False, f"Text patching not supported for gid: {gid}")

    if not targets:
        return PatchResult(False, f"Could not find {canonical} setter in code")

    for line_no, line in targets:
        # When original_value is provided, only patch the line whose current
        # string argument matches — prevents changing all subplot titles at once.
        if original_value is not None:
            if f'"{original_value}"' not in line and f"'{original_value}'" not in line:
                continue
        new_line = re.sub(
            setter_re,
            lambda m: f'{m.group(1)}"{new_text}"',
            line, count=1
        )
        if new_line != line:
            lines[line_no] = new_line
            patched_lines.append(line_no)

    if not patched_lines:
        return PatchResult(False, f"Could not patch text for {gid}")

    patched = '\n'.join(lines)
    return PatchResult(True, f"Patched text for {gid}", patched_lines, code, patched)


def patch_fill_color(code: str, gid: str, new_color: str) -> PatchResult:
    """Patch fill color for bar/scatter/patch elements."""
    lines = code.splitlines()
    patched_lines = []

    # Extract index from gid like bar_0, scatter_2, etc.
    idx_match = re.match(r'(?:bar|scatter|patch|line)_(\d+)', gid)
    idx = int(idx_match.group(1)) if idx_match else None

    # Strategy 1: Try palette array replacement
    if idx is not None:
        loc = _find_color_in_palette(code, idx)
        if loc:
            line_no, abs_start, abs_end = loc
            patched_code = code[:abs_start] + new_color + code[abs_end:]
            return PatchResult(True, f"Patched palette color index {idx}",
                               [line_no], code, patched_code)

    # Strategy 2: Find color= or c= or facecolor= kwargs
    # Look for bar/scatter/plot calls and replace color arguments
    color_kwarg_pattern = re.compile(
        r'''((?:color|c|facecolor)\s*=\s*)(['"])(#[0-9A-Fa-f]{6})\2'''
    )

    for i, line in enumerate(lines):
        matches = list(color_kwarg_pattern.finditer(line))
        if matches:
            # If we have an index, try to find the Nth occurrence globally
            # Otherwise, replace the first one found
            new_line = color_kwarg_pattern.sub(
                lambda m: f'{m.group(1)}"{new_color}"',
                line, count=1
            )
            if new_line != line:
                lines[i] = new_line
                patched_lines.append(i)
                break  # Only patch first occurrence for now

    if not patched_lines:
        # Strategy 3: Look for inline color strings like '#E69F00'
        hex_pattern = re.compile(r'''['"]#[0-9A-Fa-f]{6}['"]''')
        all_hex = []
        for i, line in enumerate(lines):
            for m in hex_pattern.finditer(line):
                all_hex.append((i, m))

        if idx is not None and idx < len(all_hex):
            target_line, target_match = all_hex[idx]
            old = target_match.group()
            quote = old[0]
            lines[target_line] = (
                lines[target_line][:target_match.start()] +
                f'{quote}{new_color}{quote}' +
                lines[target_line][target_match.end():]
            )
            patched_lines.append(target_line)

    if not patched_lines:
        return PatchResult(False, f"Could not find color to patch for {gid}")

    patched = '\n'.join(lines)
    return PatchResult(True, f"Patched fill color for {gid}", patched_lines, code, patched)


def patch_font_size(code: str, gid: str, new_size: float) -> PatchResult:
    """Patch font size for text elements."""
    lines = code.splitlines()
    patched_lines = []

    canonical = gid
    if gid.startswith('title_'):
        canonical = 'title'
    elif gid.startswith('xlabel_'):
        canonical = 'xlabel'
    elif gid.startswith('ylabel_'):
        canonical = 'ylabel'

    if canonical in ('title', 'suptitle'):
        targets = _find_title_call(code) + _find_suptitle_call(code)
    elif canonical == 'xlabel':
        targets = _find_xlabel_call(code)
    elif canonical == 'ylabel':
        targets = _find_ylabel_call(code)
    else:
        return PatchResult(False, f"Font size patching not supported for gid: {gid}")

    if not targets:
        return PatchResult(False, f"Could not find {gid} setter in code")

    for line_no, line in targets:
        # Strategy 1: Replace existing numeric fontsize= / font_size=
        new_line = re.sub(
            r'(font_?size\s*=\s*)([\d.]+)',
            lambda m: f'{m.group(1)}{new_size}',
            line, count=1
        )
        if new_line != line:
            lines[line_no] = new_line
            patched_lines.append(line_no)
            continue

        # Strategy 2: fontsize= references a CONFIG variable (e.g. fontsize=TITLE_SIZE).
        # Patch the variable definition in the CONFIG block rather than injecting a
        # duplicate kwarg (which would be a SyntaxError).
        var_match = re.search(r'\bfont_?size\s*=\s*([A-Z_][A-Z0-9_]*)', line)
        if var_match:
            var_name = var_match.group(1)
            var_def_re = re.compile(
                rf'^({re.escape(var_name)}\s*=\s*).*$', re.MULTILINE
            )
            joined = '\n'.join(lines)
            patched_joined, n = var_def_re.subn(
                rf'\g<1>{new_size}', joined, count=1
            )
            if n > 0:
                lines = patched_joined.splitlines()
                patched_lines.append(line_no)
            continue

        # Strategy 3: No fontsize= at all — inject one before the closing paren
        new_line = re.sub(
            r'(\))\s*$',
            f', fontsize={new_size})',
            line, count=1
        )
        if new_line != line:
            lines[line_no] = new_line
            patched_lines.append(line_no)

    if not patched_lines:
        return PatchResult(False, f"Could not patch font size for {gid}")

    patched = '\n'.join(lines)
    return PatchResult(True, f"Patched font size for {gid}", patched_lines, code, patched)


def patch_linewidth(code: str, gid: str, new_width: float) -> PatchResult:
    """Patch stroke-width / linewidth for line elements."""
    lines = code.splitlines()
    patched_lines = []

    # Find plot() or ax.plot() calls
    plot_pattern = re.compile(r'\b(?:ax\.)?plot\s*\(')

    for i, line in enumerate(lines):
        if plot_pattern.search(line):
            new_line = re.sub(
                r'(linewidth|lw)\s*=\s*[\d.]+',
                f'linewidth={new_width}',
                line, count=1
            )
            if new_line != line:
                lines[i] = new_line
                patched_lines.append(i)
            else:
                # Inject linewidth
                new_line = re.sub(
                    r'(\))\s*$',
                    f', linewidth={new_width})',
                    line, count=1
                )
                if new_line != line:
                    lines[i] = new_line
                    patched_lines.append(i)

    if not patched_lines:
        return PatchResult(False, f"Could not patch linewidth for {gid}")

    patched = '\n'.join(lines)
    return PatchResult(True, f"Patched linewidth for {gid}", patched_lines, code, patched)


# ── Legend position ────────────────────────────────────────────────────

_LEGEND_CALL_RE = re.compile(r'\b(?:ax|fig|plt)\.legend\s*\(')


def patch_legend_position(code: str, x_frac: float, y_frac: float) -> PatchResult:
    """
    Update an existing ax.legend(...) / fig.legend(...) / plt.legend(...) call
    so the legend is anchored at figure-fraction coordinates (x_frac, y_frac).

    We use bbox_transform=fig.transFigure (or plt.gcf().transFigure) so the
    coordinates are independent of the axes box — much easier to compute from
    a pixel drag in the rendered SVG.

    If no legend() call exists, append `ax.legend(loc='lower left',
    bbox_to_anchor=(x, y), bbox_transform=fig.transFigure)` before savefig.
    """
    lines = code.splitlines()

    # Round to 3 decimals to keep diffs clean
    x = round(float(x_frac), 3)
    y = round(float(y_frac), 3)

    new_loc = "'lower left'"
    new_anchor = f"({x}, {y})"

    # Try to patch an existing legend(...) call
    target_idx = -1
    target_line = ""
    for i, line in enumerate(lines):
        if _LEGEND_CALL_RE.search(line):
            target_idx = i
            target_line = line
            break

    if target_idx >= 0:
        new_line = target_line

        # Replace or insert loc=
        if re.search(r'\bloc\s*=', new_line):
            new_line = re.sub(
                r"\bloc\s*=\s*([\"'][^\"']+[\"']|\d+|\([^\)]+\))",
                f"loc={new_loc}",
                new_line, count=1
            )
        else:
            new_line = re.sub(
                r'(\.legend\s*\()',
                rf'\1loc={new_loc}, ',
                new_line, count=1
            )

        # Replace or insert bbox_to_anchor=
        if re.search(r'\bbbox_to_anchor\s*=', new_line):
            new_line = re.sub(
                r'\bbbox_to_anchor\s*=\s*\([^\)]*\)',
                f'bbox_to_anchor={new_anchor}',
                new_line, count=1
            )
        else:
            new_line = re.sub(
                r'(\.legend\s*\()',
                rf'\1bbox_to_anchor={new_anchor}, ',
                new_line, count=1
            )

        # Replace or insert bbox_transform=
        if re.search(r'\bbbox_transform\s*=', new_line):
            new_line = re.sub(
                r'\bbbox_transform\s*=\s*[\w.()]+',
                'bbox_transform=plt.gcf().transFigure',
                new_line, count=1
            )
        else:
            new_line = re.sub(
                r'(\.legend\s*\()',
                r'\1bbox_transform=plt.gcf().transFigure, ',
                new_line, count=1
            )

        if new_line == target_line:
            return PatchResult(False, "Legend call found but nothing changed", [], code, code)

        lines[target_idx] = new_line
        patched = '\n'.join(lines)
        return PatchResult(
            True,
            f"Moved legend to figure fraction ({x}, {y})",
            [target_idx], code, patched,
        )

    # No legend() call — inject one before savefig. Pick the line containing savefig.
    insert_at = -1
    for i, line in enumerate(lines):
        if 'savefig' in line:
            insert_at = i
            break

    new_legend_line = (
        f"ax.legend(loc={new_loc}, bbox_to_anchor={new_anchor}, "
        f"bbox_transform=plt.gcf().transFigure)"
    )

    if insert_at == -1:
        return PatchResult(
            False,
            "No existing legend() call and no savefig() to anchor injection",
        )

    lines.insert(insert_at, new_legend_line)
    patched = '\n'.join(lines)
    return PatchResult(
        True,
        f"Inserted legend at figure fraction ({x}, {y})",
        [insert_at], code, patched,
    )


# ── Axis range ─────────────────────────────────────────────────────────

def patch_axis_range(code: str, axis: str, lo: float, hi: float) -> PatchResult:
    """
    Set ax.set_xlim(lo, hi) or ax.set_ylim(lo, hi). Replaces existing call
    or inserts a new one before savefig.
    """
    if axis not in ('x', 'y'):
        return PatchResult(False, f"axis must be 'x' or 'y', got {axis!r}")

    setter = f"set_{axis}lim"
    new_call = f"ax.{setter}({lo}, {hi})"

    lines = code.splitlines()
    setter_re = re.compile(rf'\b(ax|plt)\.{setter}\s*\(')

    for i, line in enumerate(lines):
        if setter_re.search(line):
            indent = re.match(r'\s*', line).group(0)
            lines[i] = indent + new_call
            patched = '\n'.join(lines)
            return PatchResult(
                True, f"Updated {setter} to ({lo}, {hi})",
                [i], code, patched,
            )

    # Inject before savefig
    for i, line in enumerate(lines):
        if 'savefig' in line:
            indent = re.match(r'\s*', line).group(0)
            lines.insert(i, indent + new_call)
            patched = '\n'.join(lines)
            return PatchResult(
                True, f"Inserted {setter}({lo}, {hi})",
                [i], code, patched,
            )

    return PatchResult(False, f"No savefig() found to anchor {setter} injection")


# ── Main dispatch ──────────────────────────────────────────────────────

def apply_patch(code: str, gid: str, prop: str, value: str, original_value: str | None = None) -> PatchResult:
    """
    Apply a deterministic patch to plot.py code.

    Args:
        code: current plot.py source
        gid: semantic element id (e.g. 'title', 'bar_0', 'legend', 'xaxis')
        prop: property to change
        value: new value as string. Format depends on prop:
          - 'fill', 'color', 'facecolor': hex color "#RRGGBB"
          - 'text': plain string
          - 'font-size', 'stroke-width': numeric string
          - 'legend-position': "x,y" in figure fraction (e.g. "0.65,0.85")
          - 'xlim', 'ylim': "lo,hi" (e.g. "-1,5")
    """
    if prop == 'fill' or prop == 'color' or prop == 'facecolor':
        return patch_fill_color(code, gid, value)
    elif prop == 'text':
        return patch_text(code, gid, value, original_value=original_value)
    elif prop in ('font-size', 'fontsize', 'font_size'):
        return patch_font_size(code, gid, float(value))
    elif prop in ('stroke-width', 'linewidth', 'lw'):
        return patch_linewidth(code, gid, float(value))
    elif prop == 'legend-position':
        try:
            x_str, y_str = value.split(',')
            return patch_legend_position(code, float(x_str), float(y_str))
        except (ValueError, AttributeError):
            return PatchResult(
                False,
                f"legend-position value must be 'x,y', got {value!r}"
            )
    elif prop in ('xlim', 'ylim'):
        try:
            lo_str, hi_str = value.split(',')
            return patch_axis_range(code, prop[0], float(lo_str), float(hi_str))
        except (ValueError, AttributeError):
            return PatchResult(
                False,
                f"{prop} value must be 'lo,hi', got {value!r}"
            )
    else:
        return PatchResult(False, f"Unsupported property: {prop}")
