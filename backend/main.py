"""
OpenPlotAgent FastAPI backend.
Run: uvicorn main:app --reload --port 8000
"""
import asyncio
import csv
import io
import json
import shutil
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from agent.code_patcher import apply_patch
from agent.loop import AgentLoop
from config import build_provider, get_settings_dict, write_settings
from git_manager.manager import GitManager
from sandbox.runner import PROJECTS_ROOT, SandboxRunner
from workspace_init import create_experiment_dirs, create_project_dirs, create_task_dirs

app = FastAPI(title="OpenPlotAgent", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request models ──────────────────────────────────────────────────────────

class SaveFileRequest(BaseModel):
    content: str

# ── In-memory agent loop registry (one per active task) ───────────────────
_loops: dict[str, AgentLoop] = {}


def _loop_key(project_id: str, experiment_id: str, task_id: str, provider: str = "") -> str:
    return f"{project_id}/{experiment_id}/{task_id}/{provider}"


def _get_or_create_loop(
    project_id: str, experiment_id: str, task_id: str,
    provider_name: str | None = None,
) -> AgentLoop:
    key = _loop_key(project_id, experiment_id, task_id, provider_name or "")
    if key not in _loops:
        provider = build_provider(provider_name)
        runner = SandboxRunner(project_id, experiment_id, task_id)
        task_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / task_id
        _loops[key] = AgentLoop(provider, runner, task_dir)
    return _loops[key]


# ── Migration helper ───────────────────────────────────────────────────────

def _migrate_legacy_project(project_base: Path) -> None:
    """Move projects/{pid}/tasks/{tid}/ → projects/{pid}/experiments/default/tasks/{tid}/"""
    legacy_tasks = project_base / "tasks"
    default_exp = project_base / "experiments" / "default"
    (default_exp / "tasks").mkdir(parents=True, exist_ok=True)
    (default_exp / "raw").mkdir(exist_ok=True)

    exp_md = default_exp / "EXPERIMENT.md"
    if not exp_md.exists():
        exp_md.write_text(
            "# Experiment: default\n\n"
            "(Auto-migrated from legacy task structure)\n\n"
            "## Data Source\n\n## Collection Notes\n"
        )

    for task_dir in sorted(legacy_tasks.iterdir()):
        if not task_dir.is_dir():
            continue
        # Move raw/ files up to experiment level
        old_raw = task_dir / "raw"
        if old_raw.exists():
            for f in old_raw.iterdir():
                dest = default_exp / "raw" / f.name
                if not dest.exists():
                    shutil.move(str(f), str(dest))
            try:
                old_raw.rmdir()
            except OSError:
                pass  # not empty (conflict), leave in place

        new_task_dir = default_exp / "tasks" / task_dir.name
        if not new_task_dir.exists():
            shutil.move(str(task_dir), str(new_task_dir))

    try:
        legacy_tasks.rmdir()
    except OSError:
        pass


# ── Project endpoints ──────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""


@app.post("/api/projects")
async def create_project(req: CreateProjectRequest):
    project_id = req.name.lower().replace(" ", "-")
    base = create_project_dirs(project_id)
    gm = GitManager(base)
    await gm.ensure_repo()
    proj_md = base / "PROJECT.md"
    if not proj_md.exists():
        proj_md.write_text(
            f"# Project: {req.name}\n\n{req.description}\n\n"
            "## Journal Requirements\n\n## Visual Conventions\n\n## Preferences\n"
        )
        await gm.auto_commit(f"init: create project {req.name}")
    return {"project_id": project_id, "path": str(base)}


@app.get("/api/projects")
async def list_projects():
    if not PROJECTS_ROOT.exists():
        return {"projects": []}
    projects = []
    for p in sorted(PROJECTS_ROOT.iterdir()):
        if p.is_dir():
            md = p / "PROJECT.md"
            projects.append({
                "project_id": p.name,
                "path": str(p),
                "has_project_md": md.exists(),
            })
    return {"projects": projects}


# ── Experiment endpoints ───────────────────────────────────────────────────

class CreateExperimentRequest(BaseModel):
    name: str
    description: str = ""
    copy_from: str | None = None  # experiment_id to copy raw/ files from


@app.post("/api/projects/{project_id}/experiments")
async def create_experiment(project_id: str, req: CreateExperimentRequest):
    experiment_id = req.name.lower().replace(" ", "-")
    base = create_experiment_dirs(project_id, experiment_id)
    if req.copy_from:
        src_raw = PROJECTS_ROOT / project_id / "experiments" / req.copy_from / "raw"
        if src_raw.exists():
            shutil.copytree(src_raw, base / "raw", dirs_exist_ok=True)
    gm = GitManager(PROJECTS_ROOT / project_id)
    await gm.auto_commit(f"init: create experiment {req.name}")
    return {"experiment_id": experiment_id, "path": str(base)}


@app.get("/api/projects/{project_id}/experiments")
async def list_experiments(project_id: str):
    project_base = PROJECTS_ROOT / project_id
    legacy_tasks = project_base / "tasks"
    experiments_dir = project_base / "experiments"

    # Lazy migration from old 2-level structure
    if legacy_tasks.exists() and not experiments_dir.exists():
        _migrate_legacy_project(project_base)

    if not experiments_dir.exists():
        return {"experiments": []}

    experiments = []
    for e in sorted(experiments_dir.iterdir()):
        if e.is_dir():
            tasks_dir = e / "tasks"
            task_count = sum(1 for t in tasks_dir.iterdir() if t.is_dir()) if tasks_dir.exists() else 0
            experiments.append({
                "experiment_id": e.name,
                "path": str(e),
                "has_experiment_md": (e / "EXPERIMENT.md").exists(),
                "task_count": task_count,
            })
    return {"experiments": experiments}


# ── Task endpoints ─────────────────────────────────────────────────────────

class CreateTaskRequest(BaseModel):
    name: str
    copy_from: str | None = None  # task_id to copy processed/ and chart/ from


@app.post("/api/projects/{project_id}/experiments/{experiment_id}/tasks")
async def create_task(project_id: str, experiment_id: str, req: CreateTaskRequest):
    task_id = req.name.lower().replace(" ", "-")
    task_dir = create_task_dirs(project_id, experiment_id, task_id)
    if req.copy_from:
        src_task = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / req.copy_from
        for sub in ("processed", "chart"):
            src = src_task / sub
            if src.exists():
                shutil.copytree(src, task_dir / sub, dirs_exist_ok=True)
    gm = GitManager(PROJECTS_ROOT / project_id)
    await gm.auto_commit(f"init: create task {req.name}")
    return {"task_id": task_id, "path": str(task_dir)}


@app.get("/api/projects/{project_id}/experiments/{experiment_id}/tasks")
async def list_tasks(project_id: str, experiment_id: str):
    tasks_root = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks"
    if not tasks_root.exists():
        return {"tasks": []}
    tasks = []
    for t in sorted(tasks_root.iterdir()):
        if t.is_dir():
            chart_dir = t / "chart"
            svg = next(chart_dir.glob("*.svg"), None) if chart_dir.exists() else None
            tasks.append({
                "task_id": t.name,
                "has_plot": (t / "chart" / "plot.py").exists(),
                "svg_path": str(svg) if svg else None,
            })
    return {"tasks": tasks}


# ── File endpoints ─────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/files/{file_path:path}")
async def read_task_file(project_id: str, experiment_id: str, task_id: str, file_path: str):
    p = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / task_id / file_path
    if not p.exists():
        raise HTTPException(404, f"File not found: {file_path}")
    return {"content": p.read_text(), "path": file_path}


# ── Experiment-level file endpoints ──────────────────────────────────────────

@app.get("/api/projects/{project_id}/experiments/{experiment_id}/files/{file_path:path}")
async def read_experiment_file(project_id: str, experiment_id: str, file_path: str):
    p = PROJECTS_ROOT / project_id / "experiments" / experiment_id / file_path
    if not p.exists():
        raise HTTPException(404, f"File not found: {file_path}")
    return {"content": p.read_text(), "path": file_path}


@app.put("/api/projects/{project_id}/experiments/{experiment_id}/files/{file_path:path}")
async def save_experiment_file(project_id: str, experiment_id: str, file_path: str, body: SaveFileRequest):
    p = PROJECTS_ROOT / project_id / "experiments" / experiment_id / file_path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body.content)
    gm = GitManager(PROJECTS_ROOT / project_id)
    await gm.auto_commit(f"manual: edit {file_path}")
    return {"ok": True, "path": file_path, "bytes": len(body.content)}


# ── Experiment raw data endpoints ──────────────────────────────────────────

@app.post("/api/projects/{project_id}/experiments/{experiment_id}/data")
async def upload_experiment_data(project_id: str, experiment_id: str, file: UploadFile = File(...)):
    raw_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    dest = raw_dir / file.filename
    dest.write_bytes(await file.read())
    gm = GitManager(PROJECTS_ROOT / project_id)
    await gm.auto_commit(f"raw: add {file.filename} to {experiment_id}")
    return {"ok": True, "path": str(dest), "size": dest.stat().st_size}


@app.get("/api/projects/{project_id}/experiments/{experiment_id}/raw")
async def list_experiment_raw_files(project_id: str, experiment_id: str):
    raw_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "raw"
    if not raw_dir.exists():
        return {"files": []}
    files = []
    for p in sorted(raw_dir.iterdir()):
        if p.is_file():
            files.append({
                "name": p.name,
                "size": p.stat().st_size,
                "suffix": p.suffix,
                "modified": p.stat().st_mtime,
            })
    return {"files": files}


@app.get("/api/projects/{project_id}/experiments/{experiment_id}/raw/{filename}/preview")
async def preview_raw_file(
    project_id: str,
    experiment_id: str,
    filename: str,
    n: int = Query(default=200, le=1000),
):
    """Return up to n rows of a CSV/TSV/JSON file for table preview."""
    import pandas as pd

    raw_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "raw"
    p = raw_dir / filename
    if not p.exists():
        raise HTTPException(404, f"File not found: {filename}")

    suffix = p.suffix.lower()
    try:
        if suffix in (".csv", ".tsv"):
            sep = "\t" if suffix == ".tsv" else ","
            # Detect multi-level headers: first row has empty cells (merged-header CSVs)
            with open(p, newline="") as _f:
                first_cells = next(__import__("csv").reader(_f, delimiter=sep))
            has_multi_header = any(c == "" for c in first_cells[1:])
            if has_multi_header:
                df = pd.read_csv(p, sep=sep, header=[0, 1], nrows=n)
                # Flatten MultiIndex: "Temperature (°C) / Jan", drop leading empty group
                df.columns = [
                    f"{g} / {s}" if g and not g.startswith("Unnamed") else s
                    for g, s in df.columns
                ]
            else:
                df = pd.read_csv(p, sep=sep, nrows=n)
        elif suffix == ".json":
            df = pd.read_json(p)
            df = df.head(n)
        elif suffix == ".jsonl":
            df = pd.read_json(p, lines=True, nrows=n)
        else:
            return {"headers": [], "rows": [], "total_rows": 0, "error": "unsupported format"}
    except Exception as exc:
        raise HTTPException(400, f"Could not parse file: {exc}")

    headers = list(df.columns.astype(str))
    rows = df.fillna("").astype(str).values.tolist()
    total_rows = len(df)
    return {"headers": headers, "rows": rows, "total_rows": total_rows}


# ── Processed data endpoints ────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/processed")
async def list_processed_files(project_id: str, experiment_id: str, task_id: str):
    proc_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / task_id / "processed"
    if not proc_dir.exists():
        return {"files": []}
    files = []
    for p in sorted(proc_dir.iterdir()):
        if p.is_file() and p.suffix in (".csv", ".tsv", ".json"):
            files.append({"name": p.name, "size": p.stat().st_size})
    return {"files": files}


@app.post("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/processed/{filename}")
async def save_processed(project_id: str, experiment_id: str, task_id: str, filename: str, body: dict):
    """Save pasted table data as a CSV in processed/."""
    import traceback
    try:
        proc_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / task_id / "processed"
        proc_dir.mkdir(parents=True, exist_ok=True)
        rows = body.get("rows", [])
        if not rows:
            raise HTTPException(400, "rows is empty")

        # Coerce every cell to str so csv.writer can never blow up on numbers / None / dicts
        safe_rows = [
            ["" if c is None else str(c) for c in row]
            for row in rows
        ]

        dest = proc_dir / filename
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerows(safe_rows)
        # Force UTF-8 — Path.write_text otherwise uses locale.getpreferredencoding()
        # which on some shells (no LANG / launchd) defaults to ASCII and would
        # crash on Chinese/UTF-8 cells, killing the connection mid-response.
        dest.write_text(buf.getvalue(), encoding="utf-8")

        try:
            gm = GitManager(PROJECTS_ROOT / project_id)
            commit_hash = await gm.auto_commit(
                f"processed: save {filename} ({len(safe_rows) - 1} rows)"
            )
        except Exception as git_exc:
            # Don't fail the save just because the commit didn't go through
            # (e.g. missing git user.name/email config).
            print(f"[save_processed] git auto_commit failed: {git_exc!r}")
            commit_hash = None

        return {
            "ok": True,
            "path": str(dest),
            "rows": len(safe_rows),
            "commit": commit_hash,
        }
    except HTTPException:
        raise
    except Exception as exc:
        # Log full traceback to server stdout so we can see what blew up
        print(f"[save_processed] FAILED: {type(exc).__name__}: {exc}")
        traceback.print_exc()
        raise HTTPException(500, f"{type(exc).__name__}: {exc}")


# ── Export from experiment ──────────────────────────────────────────────────

class ExportRequest(BaseModel):
    source_filename: str
    columns: list[str] | None = None
    filter_expr: str | None = None
    dest_filename: str = "data.csv"


@app.post("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/export-from-experiment")
async def export_from_experiment(
    project_id: str, experiment_id: str, task_id: str, req: ExportRequest
):
    import pandas as pd

    raw_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "raw"
    src = raw_dir / req.source_filename
    if not src.exists():
        raise HTTPException(404, f"Source file not found: {req.source_filename}")

    suffix = src.suffix.lower()
    try:
        if suffix in (".csv", ".tsv"):
            df = pd.read_csv(src, sep="\t" if suffix == ".tsv" else ",")
        elif suffix == ".json":
            df = pd.read_json(src)
        elif suffix == ".jsonl":
            df = pd.read_json(src, lines=True)
        else:
            raise HTTPException(400, f"Unsupported format: {suffix}")
    except Exception as exc:
        raise HTTPException(400, f"Could not read source: {exc}")

    if req.columns:
        missing = [c for c in req.columns if c not in df.columns]
        if missing:
            raise HTTPException(400, f"Columns not found: {missing}")
        df = df[req.columns]

    if req.filter_expr:
        try:
            df = df.query(req.filter_expr)
        except Exception as exc:
            raise HTTPException(400, f"Invalid filter expression: {exc}")

    proc_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / task_id / "processed"
    proc_dir.mkdir(parents=True, exist_ok=True)
    dest = proc_dir / req.dest_filename
    df.to_csv(dest, index=False)

    gm = GitManager(PROJECTS_ROOT / project_id)
    await gm.auto_commit(
        f"export: {req.source_filename} ({len(df)} rows) → {task_id}/processed/{req.dest_filename}"
    )
    return {"ok": True, "rows_exported": len(df), "dest_path": str(dest)}


# ── Pending edits (GUI → Agent bridge) ────────────────────────────────────

class PendingEdit(BaseModel):
    gid: str
    property: str        # "fill", "text", "stroke", "font-size", etc.
    old_value: str = ""
    new_value: str


@app.post("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/pending-edits")
async def add_pending_edit(project_id: str, experiment_id: str, task_id: str, edit: PendingEdit):
    """Record a GUI edit so the agent can pick it up on next turn."""
    task_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / task_id
    edits_file = task_dir / ".plotsmith" / "pending_edits.json"
    edits_file.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if edits_file.exists():
        try:
            existing = json.loads(edits_file.read_text())
        except Exception:
            existing = []
    existing.append(edit.model_dump())
    edits_file.write_text(json.dumps(existing, indent=2))
    return {"ok": True, "pending_count": len(existing)}


@app.delete("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/pending-edits")
async def clear_pending_edits(project_id: str, experiment_id: str, task_id: str):
    """Clear pending edits after agent has consumed them."""
    task_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / task_id
    edits_file = task_dir / ".plotsmith" / "pending_edits.json"
    if edits_file.exists():
        edits_file.write_text("[]")
    return {"ok": True}


@app.get("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/pending-edits")
async def get_pending_edits(project_id: str, experiment_id: str, task_id: str):
    task_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / task_id
    edits_file = task_dir / ".plotsmith" / "pending_edits.json"
    if not edits_file.exists():
        return {"edits": []}
    try:
        edits = json.loads(edits_file.read_text())
    except Exception:
        edits = []
    return {"edits": edits}


# ── Save task file (for Script editor) ────────────────────────────────────


@app.put("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/files/{file_path:path}")
async def save_task_file(project_id: str, experiment_id: str, task_id: str, file_path: str, body: SaveFileRequest):
    """Save a file in the task directory (e.g. chart/plot.py edited by user)."""
    p = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / task_id / file_path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body.content)
    gm = GitManager(PROJECTS_ROOT / project_id)
    await gm.auto_commit(f"manual: edit {file_path}")
    return {"ok": True, "path": file_path, "bytes": len(body.content)}


# ── Git restore endpoint ─────────────────────────────────────────────────

class GitRestoreRequest(BaseModel):
    hash: str
    path: str | None = None  # None = restore entire working tree for the task


@app.post("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/git/restore")
async def restore_git_version(project_id: str, experiment_id: str, task_id: str, req: GitRestoreRequest):
    """Restore files from a specific git commit."""
    project_base = PROJECTS_ROOT / project_id
    gm = GitManager(project_base)

    # Scope restore to the task's directory
    task_rel = f"experiments/{experiment_id}/tasks/{task_id}"
    restore_path = f"{task_rel}/{req.path}" if req.path else task_rel

    await gm.git_restore(req.hash, restore_path)
    await gm.auto_commit(f"restore: revert to {req.hash[:7]} ({restore_path})")

    # Return updated SVG if available
    svg_path = project_base / task_rel / "chart" / "output.svg"
    svg_content = svg_path.read_text() if svg_path.exists() else None

    return {
        "ok": True,
        "restored_hash": req.hash,
        "restored_path": restore_path,
        "svg_content": svg_content,
    }


# ── Fork task from a commit (Data Threads-style branching) ─────────────────

class ForkFromCommitRequest(BaseModel):
    hash: str
    new_task_name: str
    source_task_id: str  # the task whose snapshot we're forking from


@app.post("/api/projects/{project_id}/experiments/{experiment_id}/tasks/fork-from-commit")
async def fork_task_from_commit(
    project_id: str, experiment_id: str, req: ForkFromCommitRequest
):
    """
    Create a new task whose processed/ and chart/ folders are seeded from
    the state of the source task at the given commit hash. Lets the user
    branch an exploration from any past version without disturbing the
    current working copy.
    """
    import subprocess

    project_base = PROJECTS_ROOT / project_id
    source_task_rel = f"experiments/{experiment_id}/tasks/{req.source_task_id}"

    new_task_id = req.new_task_name.lower().replace(" ", "-")
    new_task_dir = create_task_dirs(project_id, experiment_id, new_task_id)

    # Use `git show` to extract each file at the given commit into the new task.
    # Approach: list files in the source task at that commit via git ls-tree, then
    # copy each one.
    try:
        ls = subprocess.run(
            ["git", "-C", str(project_base), "ls-tree", "-r", "--name-only",
             req.hash, "--", source_task_rel],
            capture_output=True, text=True, check=True,
        )
    except subprocess.CalledProcessError as exc:
        raise HTTPException(400, f"git ls-tree failed: {exc.stderr or exc}")

    files_at_commit = [f for f in ls.stdout.strip().splitlines() if f]
    if not files_at_commit:
        raise HTTPException(
            404,
            f"No files found in {source_task_rel} at commit {req.hash[:7]}",
        )

    copied = 0
    for rel_path in files_at_commit:
        # rel_path is like experiments/<eid>/tasks/<sid>/chart/plot.py
        if not rel_path.startswith(source_task_rel + "/"):
            continue
        sub = rel_path[len(source_task_rel) + 1:]  # e.g. "chart/plot.py"
        # Skip internal state so the new task starts with a clean history
        if sub.startswith(".plotsmith/"):
            continue
        dest = new_task_dir / sub
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            show = subprocess.run(
                ["git", "-C", str(project_base), "show", f"{req.hash}:{rel_path}"],
                capture_output=True, check=True,
            )
            dest.write_bytes(show.stdout)
            copied += 1
        except subprocess.CalledProcessError:
            continue

    gm = GitManager(project_base)
    await gm.auto_commit(
        f"fork: new task '{new_task_id}' from {req.source_task_id}@{req.hash[:7]} "
        f"({copied} files)"
    )

    return {
        "ok": True,
        "task_id": new_task_id,
        "path": str(new_task_dir),
        "forked_from": {
            "task_id": req.source_task_id,
            "hash": req.hash,
            "files_copied": copied,
        },
    }


# ── SVG read endpoint (returns existing output.svg without re-running) ──────

@app.get("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/chart/svg")
async def get_chart_svg(project_id: str, experiment_id: str, task_id: str):
    runner = SandboxRunner(project_id, experiment_id, task_id)
    svg_path = runner.task_dir / "chart" / "output.svg"
    if not svg_path.exists():
        raise HTTPException(404, "No SVG found; ask the agent to generate a chart first")
    return {"svg_content": svg_path.read_text(), "svg_path": str(svg_path)}


# ── Direct palette / style apply (no LLM) ─────────────────────────────────

class PaletteApplyRequest(BaseModel):
    # old_colors[i] gets remapped to new_colors[i]. Any hex is matched
    # case-insensitively in plot.py source.
    old_colors: list[str]
    new_colors: list[str]
    rerun: bool = True


@app.post("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/palette")
async def apply_palette(project_id: str, experiment_id: str, task_id: str, req: PaletteApplyRequest):
    """Rewrite hex color literals in plot.py without invoking the LLM, then re-render."""
    if len(req.old_colors) != len(req.new_colors):
        raise HTTPException(400, "old_colors and new_colors length mismatch")

    runner = SandboxRunner(project_id, experiment_id, task_id)
    plot_py = runner.task_dir / "chart" / "plot.py"
    if not plot_py.exists():
        raise HTTPException(404, "plot.py not found")

    import re as _re
    src = plot_py.read_text()
    replacements = 0
    # Build (placeholder, target) pairs so a new color that equals a later
    # old color doesn't get re-rewritten.
    placeholders = []
    for i, old in enumerate(req.old_colors):
        new = req.new_colors[i]
        if not old or not new:
            continue
        placeholder = f"\x00PLT_{i}\x00"
        pattern = _re.compile(_re.escape(old), _re.IGNORECASE)
        src, n = pattern.subn(placeholder, src)
        replacements += n
        placeholders.append((placeholder, new))
    for placeholder, new in placeholders:
        src = src.replace(placeholder, new)

    if replacements == 0:
        raise HTTPException(
            409,
            "No color literals in plot.py matched. The chart may use a named "
            "palette or computed colors — ask the agent instead.",
        )

    plot_py.write_text(src)

    svg_content = None
    render_ok = True
    render_err = None
    if req.rerun:
        result = await runner.render_chart()
        render_ok = result.returncode == 0
        if render_ok:
            svg_files = [a for a in result.artifacts if a.endswith(".svg")]
            if svg_files:
                svg_content = Path(svg_files[0]).read_text()
        else:
            render_err = result.stderr

    gm = GitManager(PROJECTS_ROOT / project_id)
    await gm.auto_commit(f"palette: direct apply ({replacements} color{'s' if replacements != 1 else ''})")

    return {
        "ok": render_ok,
        "replacements": replacements,
        "svg_content": svg_content,
        "error": render_err,
    }


# ── Render endpoint ────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/render")
async def render_chart(project_id: str, experiment_id: str, task_id: str):
    runner = SandboxRunner(project_id, experiment_id, task_id)
    result = await runner.render_chart()
    if result.returncode != 0:
        raise HTTPException(500, f"Render failed: {result.stderr}")
    svg_files = [a for a in result.artifacts if a.endswith(".svg")]
    if not svg_files:
        raise HTTPException(500, "No SVG produced")
    return {"svg_content": Path(svg_files[0]).read_text(), "svg_path": svg_files[0]}


# ── Pipeline run ───────────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/pipeline/run")
async def run_pipeline(project_id: str, experiment_id: str, task_id: str):
    runner = SandboxRunner(project_id, experiment_id, task_id)
    pipeline_py = runner.task_dir / "chart" / "pipeline.py"
    if not pipeline_py.exists():
        raise HTTPException(404, "pipeline.py not found")
    result = await runner.execute(pipeline_py.read_text(), cwd=runner.task_dir / "chart")
    return {
        "ok": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "duration_ms": result.duration_ms,
    }


# ── Git endpoints ──────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/git/log")
async def git_log(project_id: str, n: int = 20):
    gm = GitManager(PROJECTS_ROOT / project_id)
    return {"commits": await gm.git_log(n)}


# ── Env setup endpoint ─────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/setup-env")
async def setup_env(project_id: str, experiment_id: str, task_id: str):
    runner = SandboxRunner(project_id, experiment_id, task_id)
    await runner.ensure_venv()
    return {"ok": True, "venv": str(runner.venv_dir)}


# ── WebSocket chat ─────────────────────────────────────────────────────────

@app.websocket("/ws/{project_id}/{experiment_id}/{task_id}")
async def chat_ws(
    websocket: WebSocket,
    project_id: str,
    experiment_id: str,
    task_id: str,
    provider: Annotated[str | None, Query()] = None,
):
    """
    Chat WebSocket with mid-turn cancellation support.

    Protocol:
      → client sends {"message": "..."}  to start a turn
      → client sends {"type": "stop"}    at any time to cancel current turn
      ← server streams normal events during turn
      ← server sends {"type": "stopped"} after cancellation
      ← server sends {"type": "error", ...} on exception
    """
    await websocket.accept()
    loop = _get_or_create_loop(project_id, experiment_id, task_id, provider)

    def _parse(data: str) -> dict:
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return {"message": data}

    async def send(payload: str):
        await websocket.send_text(payload)

    try:
        while True:
            # Wait for a real turn request (ignore stray stop messages with no turn active)
            while True:
                data = await websocket.receive_text()
                msg = _parse(data)
                if msg.get("type") == "stop":
                    # No turn running; nothing to cancel
                    continue
                user_message = msg.get("message", "")
                if user_message.strip():
                    break

            # Start the turn as a task so we can cancel it
            print(f"[ws] ▶ turn start: {user_message[:60]!r}")
            turn_task = asyncio.create_task(loop.run_turn(user_message, send))

            try:
                # While the turn runs, also listen for stop / interrupt messages
                while not turn_task.done():
                    recv_task = asyncio.create_task(websocket.receive_text())
                    done, _pending = await asyncio.wait(
                        {turn_task, recv_task},
                        return_when=asyncio.FIRST_COMPLETED,
                    )

                    if recv_task in done:
                        # A client message arrived during generation
                        try:
                            stop_data = recv_task.result()
                            stop_msg = _parse(stop_data)
                        except WebSocketDisconnect:
                            print("[ws] ✕ client disconnected during turn → cancel")
                            turn_task.cancel()
                            raise
                        except Exception as e:
                            print(f"[ws] ? recv error during turn: {e!r}")
                            stop_msg = {}

                        print(f"[ws] ← got mid-turn message: {stop_msg}")
                        if stop_msg.get("type") == "stop":
                            print("[ws] ■ STOP received → cancelling turn task")
                            turn_task.cancel()
                            try:
                                await turn_task
                            except asyncio.CancelledError:
                                print("[ws] ✓ turn task cancelled cleanly")
                            except Exception as e:
                                print(f"[ws] ⚠ turn task raised on cancel: {e!r}")
                            await websocket.send_text(json.dumps({"type": "stopped"}))
                            break
                        # Any other message while a turn is running: ignore
                        # (could queue it in the future)
                    else:
                        # Turn finished first; cancel the pending recv
                        recv_task.cancel()
                        try:
                            await recv_task
                        except (asyncio.CancelledError, Exception):
                            pass

                # Surface any non-cancellation exception from the turn
                if turn_task.done() and not turn_task.cancelled():
                    exc = turn_task.exception()
                    if exc is not None:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": f"{type(exc).__name__}: {exc}",
                        }))
            except WebSocketDisconnect:
                turn_task.cancel()
                try:
                    await turn_task
                except (asyncio.CancelledError, Exception):
                    pass
                raise

    except WebSocketDisconnect:
        pass


# ── CodePatcher: deterministic code edits without LLM ─────────────────────

class PatchCodeRequest(BaseModel):
    gid: str
    property: str        # "fill", "text", "font-size", "stroke-width"
    value: str
    original_value: str | None = None  # used to disambiguate when multiple elements share a gid


@app.post("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/patch-code")
async def patch_code(project_id: str, experiment_id: str, task_id: str, req: PatchCodeRequest):
    """
    Apply a deterministic regex patch to plot.py and re-render.
    Returns new SVG content on success. No LLM involved.
    """
    task_dir = PROJECTS_ROOT / project_id / "experiments" / experiment_id / "tasks" / task_id
    plot_py = task_dir / "chart" / "plot.py"
    if not plot_py.exists():
        raise HTTPException(404, "plot.py not found")

    code = plot_py.read_text()
    result = apply_patch(code, req.gid, req.property, req.value, original_value=req.original_value)

    if not result.success:
        return {"ok": False, "error": result.message}

    # Write patched code
    plot_py.write_text(result.patched_code)

    # Re-execute to get new SVG
    runner = SandboxRunner(project_id, experiment_id, task_id)
    exec_result = await runner.render_chart()

    if exec_result.returncode != 0:
        # Roll back on execution failure
        plot_py.write_text(result.original_code)
        return {
            "ok": False,
            "error": f"Code patch applied but execution failed: {exec_result.stderr[:300]}",
            "rolled_back": True,
        }

    # Read new SVG
    svg_path = task_dir / "chart" / "output.svg"
    svg_content = svg_path.read_text() if svg_path.exists() else None

    # Git commit
    gm = GitManager(PROJECTS_ROOT / project_id)
    await gm.auto_commit(f"patch: {req.gid}.{req.property} = {req.value}")

    return {
        "ok": True,
        "message": result.message,
        "patched_lines": result.patched_lines,
        "svg_content": svg_content,
    }


# ── PDF export ─────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/experiments/{experiment_id}/tasks/{task_id}/chart/export-pdf")
async def export_chart_pdf(project_id: str, experiment_id: str, task_id: str):
    import re

    runner = SandboxRunner(project_id, experiment_id, task_id)
    plot_py = runner.task_dir / "chart" / "plot.py"
    if not plot_py.exists():
        raise HTTPException(404, "plot.py not found")

    code = plot_py.read_text()
    # Patch SVG output → PDF output
    patched = re.sub(r'output\.svg', 'output.pdf', code)
    patched = re.sub(r"""format\s*=\s*['"]svg['"]""", "format='pdf'", patched)
    # If no savefig was patched, append an explicit PDF save
    if "output.pdf" not in patched:
        patched += '\nfig.savefig("output.pdf", format="pdf", bbox_inches="tight")\n'

    result = await runner.execute(patched, cwd=runner.task_dir / "chart")
    pdf_path = runner.task_dir / "chart" / "output.pdf"
    if not pdf_path.exists():
        raise HTTPException(500, f"PDF generation failed: {result.stderr[:400]}")

    return FileResponse(str(pdf_path), media_type="application/pdf", filename="output.pdf")


# ── Settings ───────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    default_provider: str | None = None
    anthropic_model: str | None = None
    anthropic_api_key: str | None = None
    ollama_model: str | None = None
    ollama_base_url: str | None = None
    visual_feedback: bool | None = None
    max_tool_rounds: int | None = None


@app.get("/api/settings")
async def get_settings():
    return get_settings_dict()


@app.post("/api/settings")
async def save_settings(req: SettingsUpdate):
    write_settings(req.model_dump(exclude_none=True))
    return {"ok": True}


# ── Toy example ─────────────────────────────────────────────────────────────

RAW_CLIMATE_CSV = """\
City,Temperature (°C),,,,,Precipitation (mm),,,,
,Jan,Apr,Jul,Oct,Annual_avg,Jan,Apr,Jul,Oct,Annual_total
Beijing,-3.1,13.2,26.8,13.5,12.6,3.0,23.1,175.6,23.2,538.8
Shanghai,4.5,15.1,28.2,17.8,16.7,56.3,95.2,136.8,55.4,1167.2
Guangzhou,13.8,22.5,29.1,24.0,22.3,41.5,174.3,213.4,72.3,1694.1
Chengdu,5.2,16.3,25.2,16.8,16.4,11.2,44.8,226.8,55.2,918.9
Xi_an,-0.9,14.1,27.3,12.1,13.2,8.3,38.4,98.2,44.1,556.7
Harbin,-18.1,6.2,22.8,4.5,3.4,5.2,20.1,162.4,22.8,526.9
Kunming,8.1,17.5,19.8,13.6,14.8,20.3,46.2,196.5,68.3,1011.2
"""

PROCESSED_CLIMATE_CSV = """\
City,Temp_Jul,Precip_Jul,Annual_Temp,Annual_Precip
Beijing,26.8,175.6,12.6,538.8
Shanghai,28.2,136.8,16.7,1167.2
Guangzhou,29.1,213.4,22.3,1694.1
Chengdu,25.2,226.8,16.4,918.9
Xi_an,27.3,98.2,13.2,556.7
Harbin,22.8,162.4,3.4,526.9
Kunming,19.8,196.5,14.8,1011.2
"""

DEMO_PLOT_PY = '''\
"""
Demo: Chinese city climate scatter plot.
July temperature vs July precipitation, point size ∝ annual precipitation.
"""
import matplotlib.pyplot as plt
import pandas as pd

# Okabe-Ito colour palette
PALETTE = ["#E69F00", "#56B4E9", "#009E73", "#F0E442",
           "#0072B2", "#D55E00", "#CC79A7"]

df = pd.read_csv("../processed/data.csv")

fig, ax = plt.subplots(figsize=(6, 4.5))

sizes = (df["Annual_Precip"] / df["Annual_Precip"].max()) * 320 + 60
colors = [PALETTE[i % len(PALETTE)] for i in range(len(df))]

ax.scatter(df["Temp_Jul"], df["Precip_Jul"],
           s=sizes, c=colors, alpha=0.88,
           edgecolors="white", linewidths=0.8, zorder=3)

for _, row in df.iterrows():
    ax.annotate(row["City"],
                xy=(row["Temp_Jul"], row["Precip_Jul"]),
                xytext=(5, 4), textcoords="offset points",
                fontsize=8.5, color="#333333")

ax.set_xlabel("July Temperature (°C)", fontsize=10)
ax.set_ylabel("July Precipitation (mm)", fontsize=10)
ax.set_title("Chinese Cities: Summer Temperature vs Precipitation\\n"
             "(point size = annual precipitation)", fontsize=10.5,
             fontweight="bold", pad=10)
ax.grid(True, alpha=0.25, linewidth=0.5)
ax.spines[["top", "right"]].set_visible(False)

fig.tight_layout()
fig.savefig("output.svg", format="svg", bbox_inches="tight")
plt.close()
print("Saved output.svg")
'''


@app.post("/api/toy-example")
async def create_toy_example():
    """Bootstrap a complete demo project (idempotent — always refreshes data)."""
    project_id = "demo-climate"
    experiment_id = "city-survey-2023"
    task_id = "fig1-temp-scatter"

    project_base = create_project_dirs(project_id)

    # Remove legacy 2-level tasks/ dir to prevent migration creating a 'default' experiment
    legacy_tasks = project_base / "tasks"
    if legacy_tasks.exists():
        shutil.rmtree(legacy_tasks)

    gm = GitManager(project_base)
    await gm.ensure_repo()

    project_base.joinpath("PROJECT.md").write_text(
        "# Project: Demo Climate\n\n"
        "Demo project: Chinese city climate data from 2023 survey.\n\n"
        "## Journal Requirements\n\n## Visual Conventions\n\n## Preferences\n"
    )

    exp_base = create_experiment_dirs(project_id, experiment_id)
    (exp_base / "raw" / "climate_survey.csv").write_text(RAW_CLIMATE_CSV)

    task_base = create_task_dirs(project_id, experiment_id, task_id)
    (task_base / "processed" / "data.csv").write_text(PROCESSED_CLIMATE_CSV)
    (task_base / "chart" / "plot.py").write_text(DEMO_PLOT_PY)

    await gm.auto_commit("demo: add climate toy example")

    return {
        "project_id": project_id,
        "experiment_id": experiment_id,
        "task_id": task_id,
    }


# ── Health ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.2.0"}
