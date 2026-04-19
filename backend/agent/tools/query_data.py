import json

from agent.tools.base import Tool
from agent.tools.data_utils import read_dataframe, resolve_data_path
from sandbox.runner import SandboxRunner


class QueryDataTool(Tool):
    def __init__(self):
        super().__init__(
            name="query_data",
            description=(
                "Query a subset of a data file. Select specific columns, filter rows, "
                "and limit the number of rows returned. Returns data as JSON records. "
                "Use this when you need specific portions of a large dataset."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File path (same as inspect_data)",
                    },
                    "columns": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of column names to select. Omit for all columns.",
                    },
                    "filter": {
                        "type": "string",
                        "description": (
                            "Pandas query expression to filter rows, e.g. "
                            "'Temperature > 20' or 'City == \"Beijing\"'"
                        ),
                    },
                    "sort_by": {
                        "type": "string",
                        "description": "Column name to sort by",
                    },
                    "ascending": {
                        "type": "boolean",
                        "description": "Sort order (default: true)",
                    },
                    "head": {
                        "type": "integer",
                        "description": "Return first N rows (default: 50, max: 200)",
                    },
                    "tail": {
                        "type": "integer",
                        "description": "Return last N rows",
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Skip first N rows before applying head/tail",
                    },
                },
                "required": ["path"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        path = resolve_data_path(runner, args["path"])
        if path is None:
            return {"error": f"File not found: {args['path']}"}

        try:
            df = read_dataframe(path)
        except Exception as e:
            return {"error": f"Failed to read file: {e}"}

        total_rows = len(df)

        if "columns" in args and args["columns"]:
            missing = [c for c in args["columns"] if c not in df.columns]
            if missing:
                return {
                    "error": f"Columns not found: {missing}",
                    "available_columns": list(df.columns),
                }
            df = df[args["columns"]]

        if args.get("filter"):
            try:
                df = df.query(args["filter"])
            except Exception as e:
                return {"error": f"Invalid filter expression: {e}"}

        if args.get("sort_by"):
            if args["sort_by"] not in df.columns:
                return {"error": f"Sort column not found: {args['sort_by']}"}
            df = df.sort_values(args["sort_by"], ascending=args.get("ascending", True))

        if args.get("offset"):
            df = df.iloc[args["offset"]:]

        if args.get("tail"):
            df = df.tail(min(args["tail"], 200))
        else:
            limit = min(args.get("head", 50), 200)
            df = df.head(limit)

        records = json.loads(
            df.fillna("").to_json(orient="records", default_handler=str)
        )

        return {
            "path": args["path"],
            "total_rows_in_file": total_rows,
            "rows_returned": len(records),
            "columns": list(df.columns),
            "data": records,
        }
