"""
SVG gid post-processor for OpenPlotAgent.

matplotlib's SVG output uses internal names (patch_3, text_13, ...).
This script infers semantic gids (bar_0, title, xlabel, ylabel, annotation_0,
legend, grid) from the SVG structure and adds them as id attributes so the
frontend can target elements directly.

Rules (derived from matplotlib SVG conventions):
  axes         → g[@id="axes"]  (model must set this; warn if missing)
  figure_bg    → patch_1  (figure background)
  axes_bg      → patch_2  (axes background, white fill)
  spines/frame → patch_N with fill:none
  bars/patches → patch_N with any other fill  → bar_0, bar_1, ...
  xlabel       → last text_N direct child of matplotlib.axis_1
  ylabel       → last text_N direct child of matplotlib.axis_2
  annotations  → text_N direct children of axes except the last one
  title        → last text_N direct child of axes
  legend       → g[@id="legend_1"] if present
  grid         → line2d_N inside ytick groups that extend full width
"""

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


@dataclass
class GidReport:
    already_present: list[str] = field(default_factory=list)
    added: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return len(self.warnings) == 0


# ── Helpers ────────────────────────────────────────────────────────────────

def _tag(el: ET.Element) -> str:
    return el.tag.split("}")[-1]


def _ns(local: str) -> str:
    return f"{{{SVG_NS}}}{local}"


def _fill(el: ET.Element) -> str | None:
    """Extract fill from style attribute or fill attribute."""
    style = el.get("style", "")
    for part in style.split(";"):
        part = part.strip()
        if part.startswith("fill:"):
            return part.split(":", 1)[1].strip()
    return el.get("fill")


def _is_data_patch(g: ET.Element) -> bool:
    """True if this patch group represents a data element (bar, etc.)."""
    for path in g.iter(_ns("path")):
        f = _fill(path)
        if f is None:
            # No fill attribute → inherits, likely a data bar
            return True
        if f in ("none", "#ffffff", "white"):
            return False
        # Any explicit non-white, non-none fill → data
        return True
    return False


def _set_id(el: ET.Element, new_id: str, report: GidReport) -> None:
    old = el.get("id", "")
    if old == new_id:
        report.already_present.append(new_id)
    else:
        el.set("id", new_id)
        report.added.append(f"{new_id} (was: {old!r})" if old else new_id)


# ── Chart-type detection ───────────────────────────────────────────────────

def _detect_chart_type(axes: ET.Element) -> str:
    """Guess chart type from data patches. Extend as needed."""
    patches = [
        c for c in axes
        if _tag(c) == "g" and re.match(r"patch_[3-9]|patch_[1-9]\d+", c.get("id", ""))
        and _is_data_patch(c)
    ]
    if patches:
        return "bar"
    # Lines / scatter: look for path groups without large closed rectangles
    return "unknown"


# ── Main fixer ─────────────────────────────────────────────────────────────

def fix_gids(svg_path: str | Path) -> tuple[str, GidReport]:
    """
    Parse svg_path, add missing semantic gids, return (modified_svg_str, report).
    The original file is NOT overwritten; caller decides what to do with the string.
    """
    svg_path = Path(svg_path)
    report = GidReport()

    # Parse preserving all namespaces (ET strips unknown ns declarations)
    raw = svg_path.read_text()
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # ── axes ─────────────────────────────────────────────────────────────
    axes = root.find(f".//{_ns('g')}[@id='axes']")
    if axes is None:
        report.warnings.append("'axes' gid missing — cannot infer other elements")
        return raw, report
    report.already_present.append("axes")

    # ── x-axis label ─────────────────────────────────────────────────────
    xaxis = axes.find(f"{_ns('g')}[@id='matplotlib.axis_1']")
    if xaxis is not None:
        # The xlabel text group is the last direct g child NOT inside an xtick group
        tick_ids = {c.get("id", "") for c in xaxis if re.match(r"xtick_", c.get("id", ""))}
        label_gs = [
            c for c in xaxis
            if _tag(c) == "g" and c.get("id", "").startswith("text_")
            and c.get("id", "") not in tick_ids
        ]
        # xtick groups contain text_ children; direct non-tick text_ = label
        direct_texts = [
            c for c in xaxis
            if _tag(c) == "g" and c.get("id", "").startswith("text_")
        ]
        # The label is the last direct text_N that is NOT a child of an xtick group
        xtick_text_ids: set[str] = set()
        for xtick in xaxis:
            if re.match(r"xtick_", xtick.get("id", "")):
                for sub in xtick:
                    if sub.get("id", "").startswith("text_"):
                        xtick_text_ids.add(sub.get("id", ""))

        xlabel_candidates = [
            c for c in xaxis
            if _tag(c) == "g" and c.get("id", "").startswith("text_")
            and c.get("id", "") not in xtick_text_ids
        ]
        if xlabel_candidates:
            _set_id(xlabel_candidates[-1], "xlabel", report)
        else:
            report.warnings.append("xlabel not found")

    # ── y-axis label ─────────────────────────────────────────────────────
    yaxis = axes.find(f"{_ns('g')}[@id='matplotlib.axis_2']")
    if yaxis is not None:
        ytick_text_ids: set[str] = set()
        for ytick in yaxis:
            if re.match(r"ytick_", ytick.get("id", "")):
                for sub in ytick:
                    if sub.get("id", "").startswith("text_"):
                        ytick_text_ids.add(sub.get("id", ""))

        ylabel_candidates = [
            c for c in yaxis
            if _tag(c) == "g" and c.get("id", "").startswith("text_")
            and c.get("id", "") not in ytick_text_ids
        ]
        if ylabel_candidates:
            _set_id(ylabel_candidates[-1], "ylabel", report)
        else:
            report.warnings.append("ylabel not found")

    # ── bars (data patches) ───────────────────────────────────────────────
    # Direct patch_N children of axes, excluding bg (patch_2) and spines (fill:none)
    data_patches = []
    for child in axes:
        if _tag(child) != "g":
            continue
        cid = child.get("id", "")
        if cid == "patch_2":
            continue  # axes background
        if not re.match(r"patch_\d+", cid):
            continue
        if _is_data_patch(child):
            data_patches.append(child)

    chart_type = "bar" if data_patches else "unknown"

    prefix = "bar" if chart_type == "bar" else "patch"
    for i, patch in enumerate(data_patches):
        _set_id(patch, f"{prefix}_{i}", report)

    if not data_patches:
        report.warnings.append("No data patches found (bars/lines)")

    # ── direct text children of axes ─────────────────────────────────────
    # These are: annotations (value labels) + title (last one)
    axis_group_ids = {"matplotlib.axis_1", "matplotlib.axis_2"}
    direct_texts = [
        c for c in axes
        if _tag(c) == "g"
        and c.get("id", "").startswith("text_")
        and c.get("id", "") not in axis_group_ids
    ]

    if direct_texts:
        # Last = title
        _set_id(direct_texts[-1], "title", report)
        # Others = annotations (value labels on bars, etc.)
        for i, t in enumerate(direct_texts[:-1]):
            _set_id(t, f"annotation_{i}", report)

    # ── legend ────────────────────────────────────────────────────────────
    legend = axes.find(f"{_ns('g')}[@id='legend_1']")
    if legend is not None:
        _set_id(legend, "legend", report)

    # ── serialize back ────────────────────────────────────────────────────
    # ET.tostring strips the XML declaration and may mangle namespaces.
    # Strategy: replace id="old" with id="new" in the raw text using the report.
    result = raw
    for entry in report.added:
        # entry format: "new_id (was: 'old_id')" or just "new_id"
        m = re.match(r"^(\S+)\s+\(was:\s+'(.+)'\)$", entry)
        if m:
            new_id, old_id = m.group(1), m.group(2)
            result = result.replace(f'id="{old_id}"', f'id="{new_id}"', 1)

    return result, report


def fix_and_save(svg_path: str | Path) -> GidReport:
    """Fix gids in-place. Returns the report."""
    svg_path = Path(svg_path)
    fixed_svg, report = fix_gids(svg_path)
    svg_path.write_text(fixed_svg)
    return report
