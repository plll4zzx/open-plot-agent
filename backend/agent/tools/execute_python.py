from agent.tools.base import Tool
from sandbox.runner import SandboxRunner


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
            "stdout": result.stdout[:4000],
            "stderr": result.stderr[:2000],
            "returncode": result.returncode,
            "duration_ms": result.duration_ms,
            "artifacts": result.artifacts,
            "ok": result.returncode == 0,
        }
