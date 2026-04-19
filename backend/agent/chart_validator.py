"""
Chart validator — automatic post-generation quality checks.

Inspired by MatPlotAgent (visual feedback) and PlotGen (3-way feedback).
Runs deterministic checks (numeric + lexical) after each chart generation,
and optionally a multimodal visual check via Anthropic's vision-capable models.

The validator returns a list of issues. If issues are found, the agent loop
can inject them as a system notice so the agent self-corrects.
"""
import base64
import logging
import os
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def validate_chart(svg_path: str | Path, data_path: str | Path | None = None) -> list[dict]:
    """
    Run deterministic checks on a generated SVG chart.

    Returns a list of issue dicts: {"level": "warning"|"error", "check": str, "message": str}
    Empty list = all checks passed.
    """
    svg_path = Path(svg_path)
    issues: list[dict] = []

    if not svg_path.exists():
        return [{"level": "error", "check": "file", "message": "SVG file does not exist"}]

    try:
        content = svg_path.read_text()
        root = ET.fromstring(content)
    except Exception as e:
        return [{"level": "error", "check": "parse", "message": f"Failed to parse SVG: {e}"}]

    ns = {"svg": "http://www.w3.org/2000/svg"}

    # ── 1. Lexical checks ─────────────────────────────────────────────────

    # Check that key elements exist with semantic gids
    gids_found = set()
    for elem in root.iter():
        gid = elem.get("id") or elem.get("gid")
        if gid:
            gids_found.add(gid)

    expected_gids = ["title", "xlabel", "ylabel"]
    for gid in expected_gids:
        if gid not in gids_found:
            issues.append({
                "level": "warning",
                "check": "lexical_gid",
                "message": f"Missing semantic gid '{gid}'. "
                           f"Set it with: element.set_gid('{gid}')",
            })

    # Check for empty text elements (common mistake)
    text_elements = root.findall(".//svg:text", ns) + root.findall(".//text")
    empty_texts = 0
    for text_el in text_elements:
        # Get all text content including tspans
        full_text = "".join(text_el.itertext()).strip()
        if not full_text:
            empty_texts += 1
    if empty_texts > 0:
        issues.append({
            "level": "warning",
            "check": "lexical_empty",
            "message": f"{empty_texts} empty text element(s) found in SVG. "
                       f"Check that title, labels, and annotations are set.",
        })

    # ── 2. Structural checks ──────────────────────────────────────────────

    # Check SVG has reasonable dimensions
    width = root.get("width", "")
    height = root.get("height", "")
    if not width or not height:
        viewbox = root.get("viewBox", "")
        if not viewbox:
            issues.append({
                "level": "warning",
                "check": "structure_size",
                "message": "SVG has no width/height or viewBox set.",
            })

    # Check for at least some visual content (paths, rects, lines, circles)
    visual_tags = ["path", "rect", "line", "circle", "polygon", "polyline"]
    visual_count = 0
    for tag in visual_tags:
        visual_count += len(root.findall(f".//svg:{tag}", ns))
        visual_count += len(root.findall(f".//{tag}"))
    if visual_count == 0:
        issues.append({
            "level": "error",
            "check": "structure_empty",
            "message": "SVG contains no visual elements (paths, rects, lines). "
                       "The chart may not have been rendered correctly.",
        })

    # Check for data elements (bars, lines, etc.) via gid pattern
    data_gids = [g for g in gids_found if any(
        g.startswith(prefix) for prefix in ("bar_", "line_", "scatter_", "patch_")
    )]
    if not data_gids:
        issues.append({
            "level": "warning",
            "check": "structure_no_data_gids",
            "message": "No data element gids found (bar_*, line_*, scatter_*). "
                       "Make sure to assign gids to data elements for interactivity.",
        })

    # ── 3. Numeric spot-check (if data available) ─────────────────────────

    if data_path:
        data_path = Path(data_path)
        if data_path.exists():
            try:
                issues += _numeric_spot_check(root, data_path, ns)
            except Exception as e:
                logger.warning("Numeric spot check failed: %s", e)

    return issues


def _numeric_spot_check(
    root: ET.Element,
    data_path: Path,
    ns: dict,
) -> list[dict]:
    """
    Compare number of data elements in SVG against data dimensions.
    This is a lightweight check — we can't verify exact values from SVG
    without knowing the chart type, but we can catch obvious mismatches.
    """
    import pandas as pd

    issues = []

    try:
        df = pd.read_csv(data_path)
    except Exception:
        return issues

    rows, cols = df.shape

    # Count bar elements
    bar_gids = set()
    for elem in root.iter():
        gid = elem.get("id") or elem.get("gid") or ""
        if gid.startswith("bar_"):
            bar_gids.add(gid)

    if bar_gids:
        n_bars = len(bar_gids)
        # For a simple bar chart, expect bars ≈ rows or rows × groups
        numeric_cols = len([c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])])
        max_expected = rows * max(numeric_cols, 1)
        if n_bars > max_expected * 2:
            issues.append({
                "level": "warning",
                "check": "numeric_bar_count",
                "message": (
                    f"Found {n_bars} bars but data has {rows} rows × "
                    f"{numeric_cols} numeric columns. Possible duplicate rendering."
                ),
            })

    return issues


# ── Multimodal visual feedback ───────────────────────────────────────────

VISUAL_PROMPT = """\
You are a chart-quality reviewer for academic publications. Look at this chart and \
identify any visual issues that would concern a journal reviewer or co-author.

Check for:
1. **Overlapping or clipped text** — labels, tick marks, legend, or title cut off or overlapping.
2. **Poor color contrast** — bars/lines that are hard to distinguish; colorblind-unfriendly choices.
3. **Missing / unclear labels** — axis labels, units, legend entries that are empty or vague.
4. **Data plausibility** — values that look obviously wrong (e.g. negative counts, \
extreme outliers that distort the plot).
5. **Layout / aesthetics** — awkward aspect ratio, huge white space, cramped elements.

Respond in this exact format:
OK  (if no significant issues)
or
ISSUES:
- <one issue per line, be specific>

Do not include any other commentary. If there are minor issues but the chart is publication-ready, \
still respond OK.
"""


def _rasterize_svg(svg_path: Path, max_size: int = 1200) -> bytes | None:
    """
    Convert SVG to PNG bytes. Tries cairosvg first, then Pillow fallback.
    Returns None if rasterization is not available — caller should skip visual check.
    """
    try:
        import cairosvg
        return cairosvg.svg2png(
            url=str(svg_path),
            output_width=max_size,
        )
    except ImportError:
        pass
    except Exception as e:
        logger.warning("cairosvg rasterize failed: %s", e)

    # Fallback: try matplotlib to render via PIL
    try:
        from PIL import Image
        import io
        # This path is only for when someone already has a PNG version
        png_path = svg_path.with_suffix(".png")
        if png_path.exists():
            return png_path.read_bytes()
    except ImportError:
        pass

    return None


async def validate_chart_visual(
    svg_path: str | Path,
    provider_name: str = "anthropic",
) -> list[dict]:
    """
    Use a multimodal LLM to inspect the rendered chart for visual issues.
    Only supported for Anthropic provider (Claude native vision) right now.

    Returns a list of issue dicts in the same format as validate_chart().
    Returns empty list if provider is unavailable or check passes.
    """
    svg_path = Path(svg_path)
    if not svg_path.exists():
        return []

    if provider_name != "anthropic":
        # Ollama multimodal (llava/qwen-vl) support is possible but optional.
        # For now, skip silently for non-Anthropic providers.
        return []

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    try:
        # Check config too
        from config import get_provider_config
        _, cfg = get_provider_config("anthropic")
        api_key = cfg.api_key or api_key
    except Exception:
        pass

    if not api_key:
        logger.debug("No Anthropic API key — skipping visual check")
        return []

    png_bytes = _rasterize_svg(svg_path)
    if png_bytes is None:
        logger.debug(
            "Could not rasterize SVG (cairosvg not installed?) — skipping visual check"
        )
        return []

    try:
        import anthropic
    except ImportError:
        return []

    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        b64 = base64.standard_b64encode(png_bytes).decode("utf-8")

        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": VISUAL_PROMPT},
                ],
            }],
        )
        text = "".join(
            block.text for block in msg.content if hasattr(block, "text")
        ).strip()
    except Exception as e:
        logger.warning("Visual validation call failed: %s", e)
        return []

    issues: list[dict] = []
    if text.upper().startswith("OK"):
        return issues

    # Parse ISSUES: list
    for line in text.splitlines():
        line = line.strip().lstrip("-•* ").strip()
        if not line or line.upper().startswith("ISSUES"):
            continue
        issues.append({
            "level": "warning",
            "check": "visual",
            "message": line,
        })

    return issues


# ── Formatting ────────────────────────────────────────────────────────────

def format_issues_for_agent(issues: list[dict]) -> str | None:
    """
    Format validation issues as a notice string for the agent.
    Returns None if no issues.
    """
    if not issues:
        return None

    errors = [i for i in issues if i["level"] == "error"]
    warnings = [i for i in issues if i["level"] == "warning"]

    lines = ["[CHART VALIDATION] Automatic quality checks found issues:"]
    if errors:
        lines.append(f"\n❌ Errors ({len(errors)}):")
        for e in errors:
            lines.append(f"  - [{e['check']}] {e['message']}")
    if warnings:
        lines.append(f"\n⚠️ Warnings ({len(warnings)}):")
        for w in warnings:
            lines.append(f"  - [{w['check']}] {w['message']}")
    lines.append(
        "\nPlease fix the errors above and re-run. "
        "Warnings can be addressed if relevant."
    )
    return "\n".join(lines)
