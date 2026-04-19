import json
from typing import Any

from agent.tools.base import Tool, safe_json
from agent.tools.data_utils import list_available_files, read_dataframe, resolve_data_path
from sandbox.runner import SandboxRunner


class InspectDataTool(Tool):
    def __init__(self):
        super().__init__(
            name="inspect_data",
            description=(
                "Inspect a data file and return its metadata: shape, column names, "
                "data types, basic statistics, and a preview of the first rows. "
                "Works with CSV, TSV, JSON, JSONL, and Excel files. "
                "Use this FIRST to understand data structure before writing plot code. "
                "Supports files in both processed/ (task level) and raw/ (experiment level)."
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
                    "preview_rows": {
                        "type": "integer",
                        "description": "Number of preview rows to return (default: 5, max: 20)",
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

        n_preview = min(args.get("preview_rows", 5), 20)

        columns = []
        for col in df.columns:
            col_info: dict[str, Any] = {
                "name": str(col),
                "dtype": str(df[col].dtype),
                "null_count": int(df[col].isna().sum()),
            }
            if pd.api.types.is_numeric_dtype(df[col]):
                desc = df[col].describe()
                col_info.update({
                    "min": safe_json(desc.get("min")),
                    "max": safe_json(desc.get("max")),
                    "mean": safe_json(desc.get("mean")),
                    "std": safe_json(desc.get("std")),
                })
            else:
                unique = df[col].nunique()
                col_info["unique_count"] = int(unique)
                if unique <= 15:
                    col_info["unique_values"] = df[col].dropna().unique().tolist()[:15]
                else:
                    col_info["sample_values"] = df[col].dropna().head(5).tolist()
            columns.append(col_info)

        preview = json.loads(
            df.head(n_preview).fillna("").to_json(orient="records", default_handler=str)
        )

        return {
            "path": args["path"],
            "shape": {"rows": len(df), "columns": len(df.columns)},
            "columns": columns,
            "preview": preview,
        }
