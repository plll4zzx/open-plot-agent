"""
Manual test: real Ollama agent loop end-to-end.
Run: PYTHONPATH=. .venv/bin/python test_agent_loop.py
"""
import asyncio
import json
import sys
from pathlib import Path

from agent.loop import AgentLoop
from agent.providers.ollama_provider import OllamaProvider
from agent.providers.base import ProviderConfig
from sandbox.runner import SandboxRunner, PROJECTS_ROOT
from workspace_init import create_project_dirs, create_task_dirs

PROJECT_ID = "test-ollama"
TASK_ID = "fig1-bar"
MODEL = "qwen3.6:35b"

USER_MSG = "画一个简单的柱状图，数据：A=10, B=25, C=15, D=8。保存为 output.svg。"


async def main():
    print(f"\n{'='*60}")
    print(f"OpenPlotAgent · Ollama test ({MODEL})")
    print(f"{'='*60}\n")

    # Setup dirs
    create_project_dirs(PROJECT_ID)
    task_dir = create_task_dirs(PROJECT_ID, TASK_ID)
    print(f"Task dir: {task_dir}\n")

    # Build provider + runner + loop
    config = ProviderConfig(model=MODEL)
    provider = OllamaProvider(config)
    runner = SandboxRunner(PROJECT_ID, TASK_ID)
    loop = AgentLoop(provider, runner, task_dir)

    # Ensure venv ready (downloads packages if first run)
    print("Ensuring sandbox venv...")
    await runner.ensure_venv()
    print("Venv ready.\n")

    print(f"User: {USER_MSG}\n")
    print("Agent:")

    collected_text = []

    async def send(payload: str):
        event = json.loads(payload)
        t = event["type"]

        if t == "text_delta":
            text = event["content"]
            collected_text.append(text)
            print(text, end="", flush=True)

        elif t == "tool_call":
            name = event["name"]
            inp = event.get("input", {})
            # Truncate code for readability
            if "code" in inp:
                preview = inp["code"][:120].replace("\n", "↵ ")
                print(f"\n\n  🔧 {name}(code=\"{preview}...\")", flush=True)
            else:
                print(f"\n\n  🔧 {name}({json.dumps(inp)[:80]})", flush=True)

        elif t == "tool_result":
            name = event["name"]
            ok = event.get("ok", False)
            out = event.get("output", {})
            status = "✓" if ok else "✗"
            if name == "render_chart" or name == "execute_python":
                artifacts = out.get("artifacts", [])
                stderr = out.get("stderr", "")[:200]
                print(f"\n  {status} {name} → artifacts={artifacts}", flush=True)
                if stderr:
                    print(f"     stderr: {stderr}", flush=True)
            else:
                print(f"\n  {status} {name} → ok={ok}", flush=True)

        elif t == "done":
            print(f"\n\n{'─'*60}")
            print("Turn complete.")

        elif t == "error":
            print(f"\n\n❌ Error: {event.get('message')}", flush=True)

    await loop.run_turn(USER_MSG, send)

    # Show what was produced
    chart_dir = task_dir / "chart"
    svg_files = list(chart_dir.glob("*.svg"))
    if svg_files:
        svg_path = svg_files[0]
        size = svg_path.stat().st_size
        print(f"\n✅ SVG produced: {svg_path} ({size:,} bytes)")
        # Print first 3 lines of SVG to confirm it's valid
        lines = svg_path.read_text().splitlines()[:3]
        for l in lines:
            print(f"   {l}")
    else:
        print("\n⚠️  No SVG file found in", chart_dir)

    plot_py = chart_dir / "plot.py"
    if plot_py.exists():
        print(f"\n📄 plot.py ({plot_py.stat().st_size} bytes):")
        print("─" * 40)
        print(plot_py.read_text())


if __name__ == "__main__":
    asyncio.run(main())
