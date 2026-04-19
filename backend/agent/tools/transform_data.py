import json

from agent.tools.base import Tool
from agent.tools.data_utils import read_dataframe, resolve_data_path
from sandbox.runner import SandboxRunner


def _apply_operation(df, op: str, params: dict):
    """Apply a single transform operation to a DataFrame."""
    import pandas as pd

    if op == "forward_fill":
        cols = params.get("columns")
        if cols:
            df[cols] = df[cols].ffill()
        else:
            df = df.ffill()

    elif op == "transpose":
        df = df.set_index(df.columns[0]).T.reset_index()
        df.columns.name = None

    elif op == "pivot":
        df = df.pivot(
            index=params["index"],
            columns=params["columns"],
            values=params["values"],
        ).reset_index()
        df.columns.name = None

    elif op == "melt":
        df = pd.melt(
            df,
            id_vars=params.get("id_vars"),
            value_vars=params.get("value_vars"),
            var_name=params.get("var_name", "variable"),
            value_name=params.get("value_name", "value"),
        )

    elif op == "rename_columns":
        df = df.rename(columns=params["mapping"])

    elif op == "drop_columns":
        df = df.drop(columns=params["columns"], errors="ignore")

    elif op == "drop_rows":
        df = df.drop(index=params["indices"], errors="ignore").reset_index(drop=True)

    elif op == "set_header_row":
        row_idx = params["row"]
        new_header = df.iloc[row_idx].astype(str).tolist()
        df = df.iloc[row_idx + 1:].reset_index(drop=True)
        df.columns = new_header

    elif op == "flatten_multi_header":
        n_rows = params.get("rows", 2)
        sep = params.get("separator", " / ")
        header_rows = [df.iloc[i].astype(str).tolist() for i in range(n_rows)]
        new_cols = []
        for col_idx in range(len(df.columns)):
            parts = []
            for row in header_rows:
                val = row[col_idx] if col_idx < len(row) else ""
                if val and not val.startswith("Unnamed") and val != "nan":
                    parts.append(val)
            new_cols.append(sep.join(parts) if parts else df.columns[col_idx])
        df = df.iloc[n_rows:].reset_index(drop=True)
        df.columns = new_cols

    elif op == "to_numeric":
        for col in params["columns"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    elif op == "fillna":
        cols = params.get("columns")
        val = params.get("value", "")
        if cols:
            df[cols] = df[cols].fillna(val)
        else:
            df = df.fillna(val)

    else:
        raise ValueError(f"Unknown operation: {op}")

    return df


class TransformDataTool(Tool):
    def __init__(self):
        super().__init__(
            name="transform_data",
            description=(
                "Apply structural transformations to a data file and save the result. "
                "Useful for cleaning messy data: expanding merged cells (forward-fill), "
                "transposing, pivoting, melting, renaming columns, dropping columns, "
                "and type conversions. The result is saved to the specified output path."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "input_path": {
                        "type": "string",
                        "description": "Source file path (e.g. 'raw/data.csv' or 'processed/data.csv')",
                    },
                    "output_path": {
                        "type": "string",
                        "description": "Destination path relative to task dir (e.g. 'processed/data.csv')",
                    },
                    "operations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "op": {
                                    "type": "string",
                                    "enum": [
                                        "forward_fill", "transpose", "pivot",
                                        "melt", "rename_columns", "drop_columns",
                                        "drop_rows", "set_header_row", "flatten_multi_header",
                                        "to_numeric", "fillna",
                                    ],
                                    "description": "Operation type",
                                },
                                "params": {
                                    "type": "object",
                                    "description": "Operation-specific parameters",
                                },
                            },
                            "required": ["op"],
                        },
                        "description": (
                            "List of operations to apply in order. Available ops:\n"
                            "- forward_fill: Fill empty cells with the value above. params: {columns: [col_names]} (optional, default all)\n"
                            "- transpose: Swap rows and columns\n"
                            "- pivot: params: {index: str, columns: str, values: str}\n"
                            "- melt: params: {id_vars: [str], value_vars: [str], var_name: str, value_name: str}\n"
                            "- rename_columns: params: {mapping: {old: new, ...}}\n"
                            "- drop_columns: params: {columns: [str]}\n"
                            "- drop_rows: params: {indices: [int]} — drop rows by 0-based index\n"
                            "- set_header_row: params: {row: int} — use row N as column headers, drop rows above\n"
                            "- flatten_multi_header: params: {rows: int, separator: str} — merge first N rows into one header row\n"
                            "- to_numeric: params: {columns: [str]} — convert columns to numeric\n"
                            "- fillna: params: {value: any, columns: [str]} — fill NaN with a value"
                        ),
                    },
                },
                "required": ["input_path", "output_path", "operations"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        path = resolve_data_path(runner, args["input_path"])
        if path is None:
            return {"error": f"File not found: {args['input_path']}"}

        try:
            df = read_dataframe(path)
        except Exception as e:
            return {"error": f"Failed to read file: {e}"}

        original_shape = df.shape

        for op_spec in args["operations"]:
            op = op_spec["op"]
            params = op_spec.get("params", {})
            try:
                df = _apply_operation(df, op, params)
            except Exception as e:
                return {"error": f"Operation '{op}' failed: {e}"}

        out_path = runner.task_dir / args["output_path"]
        out_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(out_path, index=False)

        preview = json.loads(
            df.head(5).fillna("").to_json(orient="records", default_handler=str)
        )

        return {
            "ok": True,
            "input_shape": {"rows": original_shape[0], "columns": original_shape[1]},
            "output_shape": {"rows": len(df), "columns": len(df.columns)},
            "output_path": args["output_path"],
            "columns": list(df.columns),
            "preview": preview,
        }
