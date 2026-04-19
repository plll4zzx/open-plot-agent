from agent.tools.base import Tool, register_tool
from sandbox.runner import SandboxRunner


@register_tool
class WriteFileTool(Tool):
    def __init__(self):
        super().__init__(
            name="write_file",
            category="file",
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
        tmp = p.with_suffix(p.suffix + ".tmp")
        tmp.write_text(args["content"])
        tmp.replace(p)
        return {"ok": True, "path": args["path"], "bytes": len(args["content"])}
