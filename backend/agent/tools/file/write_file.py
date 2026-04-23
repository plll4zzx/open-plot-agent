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
        path: str = args["path"]
        content: str = args["content"]

        p = runner.task_dir / path
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(p.suffix + ".tmp")
        tmp.write_text(content)
        tmp.replace(p)

        result: dict = {"ok": True, "path": path, "bytes": len(content)}

        # Static validation for chart/plot.py — gives the agent early feedback
        # on convention violations before it wastes a round-trip on execute_python.
        if path in ("chart/plot.py", "chart/plot.py".lstrip("/")):
            from agent.plot_code_validator import validate_plot_code, format_code_issues
            issues = validate_plot_code(content)
            if issues:
                notice = format_code_issues(issues)
                result["validation"] = issues
                result["validation_notice"] = notice
                # Only set ok=False for syntax errors — the file is broken and
                # execute_python will fail immediately.  Convention warnings keep
                # ok=True so the agent can still proceed but is expected to fix them.
                HARD_ERRORS = {"syntax", "duplicate_kwarg"}
                if any(i["check"] in HARD_ERRORS for i in issues):
                    result["ok"] = False
                    result["error"] = notice

        return result
