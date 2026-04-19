from pathlib import Path

from agent.tools.base import Tool
from sandbox.runner import SandboxRunner


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
