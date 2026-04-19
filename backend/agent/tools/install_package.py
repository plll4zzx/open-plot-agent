from agent.tools.base import Tool
from sandbox.runner import SandboxRunner


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
