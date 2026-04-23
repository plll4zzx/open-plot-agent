from agent.tools.base import Tool, register_tool
from sandbox.runner import SandboxRunner


@register_tool
class PatchConfigPropTool(Tool):
    def __init__(self):
        super().__init__(
            name="patch_config_prop",
            category="chart",
            description=(
                "Patch a single CHART CONFIG property in chart/plot.py, then re-execute "
                "to produce a new SVG. Use this for any visual change that maps to a CONFIG "
                "variable (figsize, title, xlabel, ylabel, title_size, label_size, tick_size, "
                "palette, bar_alpha, bar_width, grid, grid_alpha, xlim, ylim, legend_loc, "
                "or any custom @prop the chart defines). "
                "Faster and safer than write_file: only the one variable changes, no risk of "
                "accidentally breaking the rest of the code. "
                "Do NOT use for structural changes (new chart type, new data series, adding "
                "annotations) — those require write_file."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": (
                            "The @prop key to update, lowercase. "
                            "E.g. 'figsize', 'title', 'bar_alpha', 'palette', 'xlim'."
                        ),
                    },
                    "value": {
                        "type": "string",
                        "description": (
                            "New value as a Python literal string. Examples:\n"
                            "  figsize  → '(7.0, 5.0)'\n"
                            "  title    → '\"New Title\"'\n"
                            "  bar_alpha→ '0.7'\n"
                            "  grid     → 'True'\n"
                            "  xlim     → '(0.0, 10.0)' or 'None'\n"
                            "  palette  → '[\"#1f77b4\",\"#ff7f0e\",\"#2ca02c\"]'\n"
                            "  legend_loc → '\"upper right\"'"
                        ),
                    },
                },
                "required": ["key", "value"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        key: str = args["key"]
        value: str = args["value"]

        plot_py = runner.task_dir / "chart" / "plot.py"
        if not plot_py.exists():
            return {"ok": False, "error": "chart/plot.py not found — use write_file first"}

        code = plot_py.read_text()

        from agent.config_block import (
            config_block_present, parse_props, patch_prop,
        )

        if not config_block_present(code):
            return {
                "ok": False,
                "error": (
                    "chart/plot.py has no CHART CONFIG block. "
                    "Use write_file to rewrite the file with the CONFIG block, "
                    "then use patch_config_prop for subsequent edits."
                ),
            }

        props = parse_props(code)
        prop_keys = {p.key for p in props}
        if key not in prop_keys:
            return {
                "ok": False,
                "error": (
                    f"'{key}' is not a declared @prop. "
                    f"Available keys: {sorted(prop_keys)}. "
                    "To add a new property, use write_file to update the CONFIG block."
                ),
            }

        success, patched_code, message = patch_prop(code, key, value)
        if not success:
            return {"ok": False, "error": message}

        # Write the patched file
        plot_py.write_text(patched_code)

        # Re-execute to produce new SVG
        exec_result = await runner.render_chart()
        if exec_result.returncode != 0:
            plot_py.write_text(code)  # rollback
            return {
                "ok": False,
                "error": (
                    f"Patched {key} = {value} but execution failed — rolled back. "
                    f"stderr: {exec_result.stderr[:400]}"
                ),
                "rolled_back": True,
            }

        svg_path = runner.task_dir / "chart" / "output.svg"
        svg_content = svg_path.read_text() if svg_path.exists() else None

        return {
            "ok": True,
            "message": message,
            "key": key,
            "value": value,
            "svg_content": svg_content,
        }
