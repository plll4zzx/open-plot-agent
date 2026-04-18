"""
M1 tool set for OpenPlotAgent.
Each tool exposes:
  - name, description, input_schema (Anthropic format)
  - async run(args, runner) -> dict
Tools are registered in TOOL_REGISTRY and can be looked up by name.
"""
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sandbox.runner import SandboxRunner


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict  # Anthropic "input_schema" format

    async def run(self, args: dict[str, Any], runner: SandboxRunner) -> dict:
        raise NotImplementedError


# ── list_files ─────────────────────────────────────────────────────────────

class ListFilesTool(Tool):
    def __init__(self):
        super().__init__(
            name="list_files",
            description="List files and directories at the given path within the task workspace.",
            input_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path from the task directory. Default: '.'"}
                },
                "required": [],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        rel = args.get("path", ".")
        base = runner.task_dir / rel
        if not base.exists():
            return {"error": f"Path not found: {rel}"}
        entries = []
        for p in sorted(base.iterdir()):
            entries.append({
                "name": p.name,
                "type": "dir" if p.is_dir() else "file",
                "size": p.stat().st_size if p.is_file() else None,
            })
        return {"path": rel, "entries": entries}


# ── read_file ──────────────────────────────────────────────────────────────

class ReadFileTool(Tool):
    def __init__(self):
        super().__init__(
            name="read_file",
            description="Read the content of a file in the task workspace.",
            input_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path from task directory"},
                    "start_line": {"type": "integer", "description": "1-based start line (optional)"},
                    "end_line": {"type": "integer", "description": "1-based end line inclusive (optional)"},
                },
                "required": ["path"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        p = runner.task_dir / args["path"]
        if not p.exists():
            return {"error": f"File not found: {args['path']}"}
        lines = p.read_text().splitlines(keepends=True)
        start = args.get("start_line", 1) - 1
        end = args.get("end_line", len(lines))
        content = "".join(lines[start:end])
        return {"path": args["path"], "content": content, "total_lines": len(lines)}


# ── write_file ─────────────────────────────────────────────────────────────

class WriteFileTool(Tool):
    def __init__(self):
        super().__init__(
            name="write_file",
            description="Write or overwrite a file in the task workspace.",
            input_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path from task directory"},
                    "content": {"type": "string", "description": "Full file content"},
                },
                "required": ["path", "content"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        p = runner.task_dir / args["path"]
        p.parent.mkdir(parents=True, exist_ok=True)
        # Atomic write via temp file
        tmp = p.with_suffix(p.suffix + ".tmp")
        tmp.write_text(args["content"])
        tmp.replace(p)
        return {"ok": True, "path": args["path"], "bytes": len(args["content"])}


# ── execute_python ─────────────────────────────────────────────────────────

class ExecutePythonTool(Tool):
    def __init__(self):
        super().__init__(
            name="execute_python",
            description=(
                "Execute Python code in the project's uv venv sandbox. "
                "Returns stdout, stderr, and a list of any output files created (SVG, PDF, PNG). "
                "Working directory is chart/. Timeout is 30s."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Python code to execute"},
                },
                "required": ["code"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        result = await runner.execute(args["code"])
        return {
            "stdout": result.stdout[:4000],  # truncate for context window
            "stderr": result.stderr[:2000],
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
            "artifacts": result.artifacts,
            "ok": result.returncode == 0,
        }


# ── render_chart ───────────────────────────────────────────────────────────

class RenderChartTool(Tool):
    def __init__(self):
        super().__init__(
            name="render_chart",
            description="Re-run the current plot.py and return the resulting SVG content.",
            input_schema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        result = await runner.render_chart()
        if result.returncode != 0:
            return {"ok": False, "stderr": result.stderr}
        svg_files = [a for a in result.artifacts if a.endswith(".svg")]
        if not svg_files:
            return {"ok": False, "error": "No SVG produced. Check plot.py saves output.svg."}
        svg_path = svg_files[0]
        svg_content = Path(svg_path).read_text()
        return {"ok": True, "svg_path": svg_path, "svg_content": svg_content}


# ── install_package ────────────────────────────────────────────────────────

class InstallPackageTool(Tool):
    def __init__(self):
        super().__init__(
            name="install_package",
            description="Install a Python package into the project venv using uv pip.",
            input_schema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Package name (e.g. 'scikit-learn')"},
                    "version": {"type": "string", "description": "Optional version constraint (e.g. '>=1.3')"},
                },
                "required": ["name"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        spec = args["name"]
        if args.get("version"):
            spec += args["version"]
        result = await runner.install_packages([spec])
        # Append to requirements.txt
        req_file = runner.project_dir / "_shared" / "requirements.txt"
        req_file.parent.mkdir(parents=True, exist_ok=True)
        existing = req_file.read_text() if req_file.exists() else ""
        if spec not in existing:
            with req_file.open("a") as f:
                f.write(f"{spec}\n")
        return {
            "ok": result.returncode == 0,
            "stderr": result.stderr[:500] if result.returncode != 0 else "",
        }


# ── Registry ───────────────────────────────────────────────────────────────

TOOL_REGISTRY: dict[str, Tool] = {
    t.name: t for t in [
        ListFilesTool(),
        ReadFileTool(),
        WriteFileTool(),
        ExecutePythonTool(),
        RenderChartTool(),
        InstallPackageTool(),
    ]
}


def get_schemas(fmt: str) -> list[dict]:
    """Return tool schemas in 'anthropic' or 'openai' format."""
    schemas = []
    for tool in TOOL_REGISTRY.values():
        if fmt == "anthropic":
            schemas.append({
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            })
        else:  # openai / ollama
            schemas.append({
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema,
            })
    return schemas
