import csv
import io

from agent.tools.base import Tool
from sandbox.runner import SandboxRunner


class WriteDataTool(Tool):
    def __init__(self):
        super().__init__(
            name="write_data",
            description=(
                "Write tabular data to a CSV file in the task directory (typically processed/data.csv). "
                "Accepts data as a list of rows (first row = headers) or as a list of records (dicts). "
                "Use this to save processed data that plot.py will read."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Destination path relative to task dir (e.g. 'processed/data.csv')",
                    },
                    "rows": {
                        "type": "array",
                        "items": {"type": "array"},
                        "description": "Data as array of arrays. First row is headers.",
                    },
                    "records": {
                        "type": "array",
                        "items": {"type": "object"},
                        "description": "Data as array of {column: value} objects. Alternative to rows.",
                    },
                },
                "required": ["path"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        out_path = runner.task_dir / args["path"]
        out_path.parent.mkdir(parents=True, exist_ok=True)

        if args.get("records"):
            import pandas as pd
            df = pd.DataFrame(args["records"])
            df.to_csv(out_path, index=False)
            return {
                "ok": True,
                "path": args["path"],
                "rows": len(df),
                "columns": list(df.columns),
            }
        elif args.get("rows"):
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerows(args["rows"])
            out_path.write_text(buf.getvalue())
            return {
                "ok": True,
                "path": args["path"],
                "rows": len(args["rows"]) - 1,
                "columns": args["rows"][0] if args["rows"] else [],
            }
        else:
            return {"error": "Provide either 'rows' (array of arrays) or 'records' (array of dicts)"}
