"""
recommend_charts tool — Smart Data Profiling + chart-type recommendation.

Inspired by LIDA's Goal Explorer. Given a dataset, classifies columns
(categorical / numeric / datetime), then suggests 2-4 appropriate chart
types with reasoning. Each suggestion maps to a TemplatePanel template id
so the front-end can offer one-click execution.
"""
from agent.tools.base import Tool, register_tool
from agent.tools.data._utils import list_available_files, read_dataframe, resolve_data_path
from sandbox.runner import SandboxRunner


# Each rule produces a recommendation if its `match` predicate returns True.
# Ordered by typical desirability — first rules are tried first.
def _classify(df) -> dict:
    import pandas as pd

    numeric, categorical, datetime, text = [], [], [], []
    for col in df.columns:
        s = df[col]
        if pd.api.types.is_datetime64_any_dtype(s):
            datetime.append(col)
        elif pd.api.types.is_numeric_dtype(s):
            numeric.append(col)
        else:
            nunique = s.nunique(dropna=True)
            if nunique <= 30:
                categorical.append(col)
            else:
                text.append(col)
    return {
        "numeric": numeric,
        "categorical": categorical,
        "datetime": datetime,
        "text": text,
    }


def _recommend(stats: dict, n_rows: int) -> list[dict]:
    """Build a ranked list of chart recommendations from column stats."""
    n_num = len(stats["numeric"])
    n_cat = len(stats["categorical"])
    n_dt = len(stats["datetime"])
    recs: list[dict] = []

    # ── Time-series → line plot ──────────────────────────────────────────
    if n_dt >= 1 and n_num >= 1:
        recs.append({
            "template_id": "line_plot",
            "name": "Line plot",
            "name_zh": "折线图",
            "rationale": (
                f"Detected {n_dt} datetime column ('{stats['datetime'][0]}') and "
                f"{n_num} numeric column(s). Line plot best shows trends over time."
            ),
            "score": 95,
        })

    # ── Single categorical + single numeric → simple bar (or grouped if 2 cats) ──
    if n_cat >= 1 and n_num >= 1:
        if n_cat >= 2:
            recs.append({
                "template_id": "grouped_bar",
                "name": "Grouped bar chart",
                "name_zh": "分组柱状图",
                "rationale": (
                    f"You have {n_cat} categorical and {n_num} numeric columns. "
                    f"Grouped bars compare '{stats['numeric'][0]}' across "
                    f"'{stats['categorical'][0]}' grouped by '{stats['categorical'][1]}'."
                ),
                "score": 90,
            })
        else:
            recs.append({
                "template_id": "grouped_bar",
                "name": "Bar chart",
                "name_zh": "柱状图",
                "rationale": (
                    f"One categorical column ('{stats['categorical'][0]}') × one "
                    f"numeric column ('{stats['numeric'][0]}') is a classic bar chart."
                ),
                "score": 85,
            })

    # ── Categorical + multiple numeric → box / violin ─────────────────────
    if n_cat >= 1 and n_num >= 1 and n_rows >= 10:
        recs.append({
            "template_id": "box_plot",
            "name": "Box plot",
            "name_zh": "箱线图",
            "rationale": (
                f"With {n_rows} rows grouped by '{stats['categorical'][0]}', "
                f"a box plot reveals distribution, median, and outliers per group."
            ),
            "score": 80,
        })
        if n_rows >= 30:
            recs.append({
                "template_id": "violin",
                "name": "Violin plot",
                "name_zh": "小提琴图",
                "rationale": (
                    f"{n_rows} rows is enough to estimate density — violin plot "
                    f"shows full distribution shape, not just quartiles."
                ),
                "score": 70,
            })

    # ── Two numeric columns → scatter ────────────────────────────────────
    if n_num >= 2:
        recs.append({
            "template_id": "scatter",
            "name": "Scatter plot",
            "name_zh": "散点图",
            "rationale": (
                f"Two numeric columns ('{stats['numeric'][0]}' vs "
                f"'{stats['numeric'][1]}') — scatter shows their relationship."
            ),
            "score": 75,
        })

    # ── Many numeric columns → heatmap (correlation) ─────────────────────
    if n_num >= 4:
        recs.append({
            "template_id": "heatmap",
            "name": "Correlation heatmap",
            "name_zh": "相关性热力图",
            "rationale": (
                f"{n_num} numeric columns — heatmap visualizes pairwise correlations."
            ),
            "score": 65,
        })

    # ── Single categorical + numeric (small set) → donut ─────────────────
    if n_cat == 1 and n_num >= 1 and 2 <= n_rows <= 8:
        recs.append({
            "template_id": "pie_donut",
            "name": "Donut chart",
            "name_zh": "环形图",
            "rationale": (
                f"Small dataset ({n_rows} rows) with one category — donut shows "
                f"composition / share of total."
            ),
            "score": 50,
        })

    # ── Stacked bar for categorical + numeric breakdown ──────────────────
    if n_cat >= 2 and n_num >= 1 and "category" not in [r["template_id"] for r in recs[:1]]:
        recs.append({
            "template_id": "stacked_bar",
            "name": "Stacked bar chart",
            "name_zh": "堆叠柱状图",
            "rationale": (
                f"Two categorical columns + numeric — stacked bars show how "
                f"'{stats['categorical'][1]}' contributes to each "
                f"'{stats['categorical'][0]}'."
            ),
            "score": 60,
        })

    # Sort by score descending and dedupe by template_id
    recs.sort(key=lambda r: -r["score"])
    seen = set()
    deduped = []
    for r in recs:
        if r["template_id"] in seen:
            continue
        seen.add(r["template_id"])
        deduped.append(r)
    return deduped[:4]


@register_tool
class RecommendChartsTool(Tool):
    def __init__(self):
        super().__init__(
            name="recommend_charts",
            category="data",
            description=(
                "Analyze a data file and recommend 2-4 appropriate chart types "
                "based on column structure (categorical / numeric / datetime). "
                "Returns each recommendation with a rationale and a template_id "
                "the user can pick to trigger generation. Best used after "
                "summarize_data when the user is unsure what chart to make."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": (
                            "File path relative to task dir (e.g. 'processed/data.csv') "
                            "or experiment raw dir (e.g. 'raw/experiment.csv')."
                        ),
                    },
                },
                "required": ["path"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        path = resolve_data_path(runner, args["path"])
        if path is None:
            return {
                "error": f"File not found: {args['path']}",
                "available_files": list_available_files(runner),
            }

        try:
            df = read_dataframe(path)
        except Exception as e:
            return {"error": f"Failed to read file: {e}"}

        rows, cols = df.shape
        stats = _classify(df)
        recs = _recommend(stats, rows)

        if not recs:
            return {
                "path": args["path"],
                "shape": {"rows": rows, "cols": cols},
                "column_classification": stats,
                "recommendations": [],
                "summary": (
                    "Could not infer a clear chart recommendation from this data. "
                    "Consider transforming the data first (e.g. pivot, melt) or "
                    "ask the user what aspect they want to visualize."
                ),
            }

        # Compose a short natural summary
        top = recs[0]
        summary_parts = [
            f"Dataset has {rows:,} rows × {cols} columns "
            f"({len(stats['numeric'])} numeric, {len(stats['categorical'])} categorical, "
            f"{len(stats['datetime'])} datetime).",
            f"Top recommendation: {top['name']} ({top['name_zh']}).",
        ]
        if len(recs) > 1:
            alt_names = ", ".join(r["name"] for r in recs[1:])
            summary_parts.append(f"Alternatives: {alt_names}.")
        summary = " ".join(summary_parts)

        return {
            "path": args["path"],
            "shape": {"rows": rows, "cols": cols},
            "column_classification": stats,
            "recommendations": recs,
            "summary": summary,
        }
