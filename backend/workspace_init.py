"""
Creates the standard directory tree for a new project or task.
"""
from pathlib import Path

from sandbox.runner import PROJECTS_ROOT


def create_project_dirs(project_id: str) -> Path:
    base = PROJECTS_ROOT / project_id
    (base / "_shared").mkdir(parents=True, exist_ok=True)
    (base / "tasks").mkdir(exist_ok=True)
    req = base / "_shared" / "requirements.txt"
    if not req.exists():
        req.write_text("matplotlib\npandas\nnumpy\nscipy\nseaborn\n")
    return base


def create_task_dirs(project_id: str, task_id: str) -> Path:
    base = PROJECTS_ROOT / project_id / "tasks" / task_id
    for sub in ["raw", "processed", "chart", "conversations", ".plotsmith/archive"]:
        (base / sub).mkdir(parents=True, exist_ok=True)
    task_md = base / "TASK.md"
    if not task_md.exists():
        task_md.write_text(f"# Task: {task_id}\n\n## Data Background\n\n## Chart Focus\n\n## Decisions\n")
    return base
