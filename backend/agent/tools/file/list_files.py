from agent.tools.base import Tool, register_tool
from sandbox.runner import SandboxRunner


@register_tool
class ListFilesTool(Tool):
    def __init__(self):
        super().__init__(
            name="list_files",
            category="file",
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
