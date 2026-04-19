"""
Memory tools — read/write persistent notes across 4 scopes.

Scopes (from most specific to most general):
  task       — task-level notes (TASK.md)        [per task]
  experiment — experiment-level notes (EXPERIMENT.md)  [shared by tasks]
  project    — project-level notes (PROJECT.md)         [shared by experiments]
  global     — user-level preferences (~/open-plot-agent/GLOBAL.md)  [shared by all projects]

Use these to remember user preferences, reviewer feedback, journal requirements,
or anything the agent should recall across turns or sessions.
"""
from pathlib import Path

from agent.tools.base import Tool, register_tool
from sandbox.runner import SandboxRunner, PROJECTS_ROOT

GLOBAL_MD_PATH = PROJECTS_ROOT.parent / "GLOBAL.md"

SCOPE_PLACEHOLDERS = {
    "global": (
        "# Global Preferences\n\n"
        "跨项目的用户偏好。Agent 会在开始工作时读取这里。\n\n"
        "## Color Palette\n\n"
        "## Typography\n\n"
        "## General Style\n\n"
        "## Reviewer Feedback (recurring)\n"
    ),
    "project": (
        "# Project Memory\n\n"
        "项目级约束。例如：目标期刊、总体风格、合作者偏好。\n\n"
        "## Journal Requirements\n\n"
        "## Visual Conventions\n\n"
        "## Preferences\n"
    ),
    "experiment": (
        "# Experiment Memory\n\n"
        "## 实验背景\n\n"
        "## 数据说明\n\n"
        "## 共享样式\n"
    ),
    "task": (
        "# Task Memory\n\n"
        "## 用户偏好\n\n"
        "## 设计决策\n\n"
        "## Reviewer 意见\n"
    ),
}


def _resolve_memory_path(scope: str, runner: SandboxRunner) -> Path:
    """Return the file path for a given memory scope."""
    if scope == "global":
        return GLOBAL_MD_PATH
    if scope == "project":
        return runner.project_dir / "PROJECT.md"
    if scope == "experiment":
        return runner.experiment_dir / "EXPERIMENT.md"
    if scope == "task":
        return runner.task_dir / "TASK.md"
    raise ValueError(f"Unknown scope: {scope!r}. Use 'global'|'project'|'experiment'|'task'.")


@register_tool
class MemoryReadTool(Tool):
    def __init__(self):
        super().__init__(
            name="memory_read",
            category="memory",
            description=(
                "Read persistent memory notes for a given scope. "
                "Use this at the start of a session to recall user preferences, "
                "journal requirements, reviewer feedback, or prior design decisions. "
                "Scopes: 'global' (user-wide), 'project', 'experiment', 'task'. "
                "Returns empty content if the memory file doesn't exist yet."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "enum": ["global", "project", "experiment", "task"],
                        "description": "Which memory layer to read.",
                    },
                },
                "required": ["scope"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        scope = args.get("scope", "task")
        try:
            path = _resolve_memory_path(scope, runner)
        except ValueError as e:
            return {"error": str(e)}

        if not path.exists():
            return {
                "scope": scope,
                "path": str(path),
                "content": "",
                "exists": False,
                "hint": f"No {scope}-level memory recorded yet. Use memory_write to start one.",
            }

        try:
            content = path.read_text()
        except Exception as e:
            return {"error": f"Failed to read {path}: {e}"}

        return {
            "scope": scope,
            "path": str(path),
            "content": content,
            "exists": True,
            "length": len(content),
        }


@register_tool
class MemoryWriteTool(Tool):
    def __init__(self):
        super().__init__(
            name="memory_write",
            category="memory",
            description=(
                "Write or append to a persistent memory note. "
                "Use this to record user preferences the agent should remember across "
                "sessions (e.g. 'always use Okabe-Ito palette', 'Nature single-column = 89mm'). "
                "mode='append' adds to the end under a '## Updates' section. "
                "mode='replace' overwrites the whole file. "
                "Default is 'append' to preserve history. "
                "If scope file doesn't exist, a placeholder template is created first."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "enum": ["global", "project", "experiment", "task"],
                        "description": "Which memory layer to update.",
                    },
                    "content": {
                        "type": "string",
                        "description": "The text to write (Markdown format preferred).",
                    },
                    "mode": {
                        "type": "string",
                        "enum": ["append", "replace"],
                        "default": "append",
                        "description": "'append' to add under ## Updates, 'replace' to overwrite.",
                    },
                },
                "required": ["scope", "content"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        scope = args.get("scope", "task")
        content = args.get("content", "").strip()
        mode = args.get("mode", "append")

        if not content:
            return {"error": "Content is empty — nothing to write."}

        try:
            path = _resolve_memory_path(scope, runner)
        except ValueError as e:
            return {"error": str(e)}

        path.parent.mkdir(parents=True, exist_ok=True)

        if mode == "replace":
            new_text = content if content.endswith("\n") else content + "\n"
            path.write_text(new_text)
            action = "replaced"
        else:  # append
            existing = path.read_text() if path.exists() else SCOPE_PLACEHOLDERS.get(scope, "")
            if "## Updates" not in existing:
                # First append — add the Updates section
                joined = existing.rstrip() + "\n\n## Updates\n\n" + content + "\n"
            else:
                joined = existing.rstrip() + "\n\n" + content + "\n"
            path.write_text(joined)
            action = "appended"

        return {
            "ok": True,
            "scope": scope,
            "path": str(path),
            "mode": mode,
            "action": action,
            "bytes": path.stat().st_size,
        }
