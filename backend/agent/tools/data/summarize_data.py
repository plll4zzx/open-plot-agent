"""
summarize_data tool — LIDA-inspired natural language data summary.

Instead of returning structured JSON (like inspect_data), this produces
a concise English paragraph describing the dataset. This is more token-efficient
and easier for the LLM to incorporate into its reasoning.
"""
import math
from typing import Any

from agent.tools.base import Tool, register_tool, safe_json
from agent.tools.data._utils import list_available_files, read_dataframe, resolve_data_path
from sandbox.runner import SandboxRunner


def _fmt(val: Any) -> str:
    """Format a numeric value for display."""
    if val is None:
        return "N/A"
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return "N/A"
        if abs(val) >= 1000:
            return f"{val:,.0f}"
        if abs(val) >= 1:
            return f"{val:.2f}"
        return f"{val:.4f}"
    return str(val)


@register_tool
class SummarizeDataTool(Tool):
    def __init__(self):
        super().__init__(
            name="summarize_data",
            category="data",
            description=(
                "Generate a concise natural language summary of a data file. "
                "Returns a paragraph describing the dataset's structure, key columns, "
                "value ranges, and notable patterns. More token-efficient than inspect_data "
                "for initial data exploration. Use inspect_data when you need precise "
                "column-level details."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": (
                            "File path relative to task dir (e.g. 'processed/data.csv') "
                            "or experiment raw dir (e.g. 'raw/experiment.csv')"
                        ),
                    },
                },
                "required": ["path"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        import pandas as pd

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
        parts = []

        # ── Shape ──
        parts.append(
            f"This dataset contains {rows:,} rows and {cols} columns."
        )

        # ── Classify columns ──
        numeric_cols = []
        categorical_cols = []
        datetime_cols = []
        text_cols = []

        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                numeric_cols.append(col)
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                datetime_cols.append(col)
            else:
                nunique = df[col].nunique()
                if nunique <= 30:
                    categorical_cols.append(col)
                else:
                    text_cols.append(col)

        # ── Categorical columns summary ──
        if categorical_cols:
            cat_descriptions = []
            for col in categorical_cols[:6]:  # limit
                nunique = df[col].nunique()
                vals = df[col].dropna().unique()
                if len(vals) <= 5:
                    val_str = ", ".join(str(v) for v in vals)
                    cat_descriptions.append(f"'{col}' ({nunique} values: {val_str})")
                else:
                    sample = ", ".join(str(v) for v in vals[:3])
                    cat_descriptions.append(f"'{col}' ({nunique} unique values, e.g. {sample})")
            parts.append(
                f"Categorical columns: {'; '.join(cat_descriptions)}."
            )

        # ── Numeric columns summary ──
        if numeric_cols:
            num_descriptions = []
            for col in numeric_cols[:8]:  # limit
                desc = df[col].describe()
                mean = safe_json(desc.get("mean"))
                std = safe_json(desc.get("std"))
                mn = safe_json(desc.get("min"))
                mx = safe_json(desc.get("max"))
                num_descriptions.append(
                    f"'{col}' (mean={_fmt(mean)}, std={_fmt(std)}, range=[{_fmt(mn)}, {_fmt(mx)}])"
                )
            parts.append(
                f"Numeric columns: {'; '.join(num_descriptions)}."
            )

        # ── Datetime columns ──
        if datetime_cols:
            dt_descriptions = []
            for col in datetime_cols[:3]:
                mn = df[col].min()
                mx = df[col].max()
                dt_descriptions.append(f"'{col}' (from {mn} to {mx})")
            parts.append(f"Datetime columns: {'; '.join(dt_descriptions)}.")

        # ── Text columns ──
        if text_cols:
            parts.append(
                f"Text/high-cardinality columns: {', '.join(repr(c) for c in text_cols[:4])}."
            )

        # ── Missing data ──
        total_missing = int(df.isna().sum().sum())
        if total_missing > 0:
            pct = total_missing / (rows * cols) * 100
            missing_cols = [
                f"'{col}' ({int(df[col].isna().sum())})"
                for col in df.columns if df[col].isna().sum() > 0
            ]
            parts.append(
                f"Missing values: {total_missing:,} total ({pct:.1f}% of all cells). "
                f"Columns with nulls: {', '.join(missing_cols[:5])}."
            )
        else:
            parts.append("No missing values detected.")

        # ── Balance check for key categoricals ──
        if categorical_cols:
            main_cat = categorical_cols[0]
            vc = df[main_cat].value_counts()
            if len(vc) <= 10:
                balance = ", ".join(f"{k}: {v}" for k, v in vc.items())
                parts.append(
                    f"Distribution of '{main_cat}': {balance}."
                )

        # ── Potential grouping suggestion ──
        if categorical_cols and numeric_cols:
            parts.append(
                f"This data appears suitable for grouped analysis: "
                f"group by {categorical_cols[0]!r} and compare {numeric_cols[0]!r}."
            )

        summary = " ".join(parts)

        return {
            "path": args["path"],
            "summary": summary,
            "column_names": list(df.columns),
        }
