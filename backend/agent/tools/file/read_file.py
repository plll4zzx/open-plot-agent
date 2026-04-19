from agent.tools.base import Tool, register_tool
from sandbox.runner import SandboxRunner


@register_tool
class ReadFileTool(Tool):
    def __init__(self):
        super().__init__(
            name="read_file",
            category="file",
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
