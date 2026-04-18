"""
OpenPlotAgent FastAPI backend.
Run: uvicorn main:app --reload --port 8000
"""
import json
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from agent.loop import AgentLoop
from config import build_provider
from git_manager.manager import GitManager
from sandbox.runner import PROJECTS_ROOT, SandboxRunner
from workspace_init import create_project_dirs, create_task_dirs

app = FastAPI(title="OpenPlotAgent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory agent loop registry (one per active task) ───────────────────
_loops: dict[str, AgentLoop] = {}


def _loop_key(project_id: str, task_id: str) -> str:
    return f"{project_id}/{task_id}"


def _get_or_create_loop(
    project_id: str, task_id: str, provider_name: str | None = None
) -> AgentLoop:
    key = _loop_key(project_id, task_id)
    if key not in _loops:
        provider = build_provider(provider_name)
        runner = SandboxRunner(project_id, task_id)
        task_dir = PROJECTS_ROOT / project_id / "tasks" / task_id
        _loops[key] = AgentLoop(provider, runner, task_dir)
    return _loops[key]


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


# ── Task endpoints ─────────────────────────────────────────────────────────

class CreateTaskRequest(BaseModel):
    name: str
    template_task_id: str = ""


@app.post("/api/projects/{project_id}/tasks")
async def create_task(project_id: str, req: CreateTaskRequest):
    task_id = req.name.lower().replace(" ", "-")
    task_dir = create_task_dirs(project_id, task_id)
    gm = GitManager(PROJECTS_ROOT / project_id)
    await gm.auto_commit(f"init: create task {req.name}")
    return {"task_id": task_id, "path": str(task_dir)}


@app.get("/api/projects/{project_id}/tasks")
async def list_tasks(project_id: str):
    tasks_root = PROJECTS_ROOT / project_id / "tasks"
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

@app.get("/api/projects/{project_id}/tasks/{task_id}/files/{file_path:path}")
async def read_task_file(project_id: str, task_id: str, file_path: str):
    p = PROJECTS_ROOT / project_id / "tasks" / task_id / file_path
    if not p.exists():
        raise HTTPException(404, f"File not found: {file_path}")
    return {"content": p.read_text(), "path": file_path}


@app.post("/api/projects/{project_id}/tasks/{task_id}/data")
async def upload_data(project_id: str, task_id: str, file: UploadFile = File(...)):
    raw_dir = PROJECTS_ROOT / project_id / "tasks" / task_id / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    dest = raw_dir / file.filename
    dest.write_bytes(await file.read())
    gm = GitManager(PROJECTS_ROOT / project_id)
    await gm.auto_commit(f"raw: add {file.filename}")
    return {"ok": True, "path": str(dest), "size": dest.stat().st_size}


# ── Render endpoint ────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/tasks/{task_id}/render")
async def render_chart(project_id: str, task_id: str):
    runner = SandboxRunner(project_id, task_id)
    result = await runner.render_chart()
    if result.returncode != 0:
        raise HTTPException(500, f"Render failed: {result.stderr}")
    svg_files = [a for a in result.artifacts if a.endswith(".svg")]
    if not svg_files:
        raise HTTPException(500, "No SVG produced")
    return {"svg_content": Path(svg_files[0]).read_text(), "svg_path": svg_files[0]}


# ── Git endpoints ──────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/git/log")
async def git_log(project_id: str, n: int = 20):
    gm = GitManager(PROJECTS_ROOT / project_id)
    return {"commits": await gm.git_log(n)}


# ── Env setup endpoint ─────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/tasks/{task_id}/setup-env")
async def setup_env(project_id: str, task_id: str):
    runner = SandboxRunner(project_id, task_id)
    await runner.ensure_venv()
    return {"ok": True, "venv": str(runner.venv_dir)}


# ── WebSocket chat ─────────────────────────────────────────────────────────

@app.websocket("/ws/{project_id}/{task_id}")
async def chat_ws(
    websocket: WebSocket,
    project_id: str,
    task_id: str,
    provider: Annotated[str | None, Query()] = None,
):
    await websocket.accept()
    loop = _get_or_create_loop(project_id, task_id, provider)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                user_message = msg.get("message", "")
            except json.JSONDecodeError:
                user_message = data

            if not user_message.strip():
                continue

            async def send(payload: str):
                await websocket.send_text(payload)

            await loop.run_turn(user_message, send)

    except WebSocketDisconnect:
        pass


# ── Health ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
