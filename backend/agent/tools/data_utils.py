"""
Shared utilities for data tools (inspect_data, query_data, transform_data, write_data).
Imports pandas lazily to avoid import-time failures when pandas isn't installed.
"""
from pathlib import Path

from sandbox.runner import SandboxRunner


def resolve_data_path(runner: SandboxRunner, path: str) -> Path | None:
    """
    Resolve a data file path relative to task or experiment directory.
    Supports:
      - "processed/data.csv"          → task_dir/processed/data.csv
      - "raw/experiment_data.csv"     → experiment_dir/raw/experiment_data.csv
      - "../../raw/something.jsonl"   → experiment_dir/raw/something.jsonl
    """
    candidate = runner.task_dir / path
    if candidate.exists():
        return candidate
    if path.startswith("raw/") or path.startswith("../../raw/"):
        filename = path.split("raw/", 1)[-1]
        candidate = runner.experiment_dir / "raw" / filename
        if candidate.exists():
            return candidate
    return None


def read_dataframe(path: Path, **kwargs):
    """Read a data file into a pandas DataFrame, auto-detecting format."""
    import pandas as pd

    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path, **kwargs)
    elif suffix == ".tsv":
        return pd.read_csv(path, sep="\t", **kwargs)
    elif suffix == ".json":
        return pd.read_json(path, **kwargs)
    elif suffix == ".jsonl":
        return pd.read_json(path, lines=True, **kwargs)
    elif suffix in (".xls", ".xlsx"):
        return pd.read_excel(path, **kwargs)
    else:
        return pd.read_csv(path, **kwargs)


def list_available_files(runner: SandboxRunner) -> list[str]:
    """List data files available in processed/ and raw/ directories."""
    available = []
    proc = runner.task_dir / "processed"
    if proc.exists():
        available += [f"processed/{f.name}" for f in proc.iterdir() if f.is_file()]
    raw = runner.experiment_dir / "raw"
    if raw.exists():
        available += [f"raw/{f.name}" for f in raw.iterdir() if f.is_file()]
    return available
