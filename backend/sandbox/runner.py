"""
Sandbox runner: manages per-project uv venvs and executes Python code safely.
"""
import asyncio
import os
import shutil
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

PROJECTS_ROOT = Path.home() / "open-plot-agent" / "projects"
DEFAULT_PACKAGES = ["matplotlib", "pandas", "numpy", "scipy", "seaborn"]
EXEC_TIMEOUT = 30  # seconds


@dataclass
class ExecResult:
    stdout: str
    stderr: str
    returncode: int
    duration_ms: int
    artifacts: list[str] = field(default_factory=list)  # paths of output files


class SandboxRunner:
    def __init__(self, project_id: str, task_id: str):
        self.project_id = project_id
        self.task_id = task_id
        self.project_dir = PROJECTS_ROOT / project_id
        self.task_dir = self.project_dir / "tasks" / task_id
        self.venv_dir = self.project_dir / ".venv"
        self.python = self.venv_dir / "bin" / "python"

    # ── Setup ──────────────────────────────────────────────────────────────

    async def ensure_venv(self) -> None:
        if self.python.exists():
            return
        self.project_dir.mkdir(parents=True, exist_ok=True)
        proc = await asyncio.create_subprocess_exec(
            "uv", "venv", str(self.venv_dir), "--python", "3.11",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"uv venv failed: {stderr.decode()}")
        await self.install_packages(DEFAULT_PACKAGES)

    async def install_packages(self, packages: list[str]) -> ExecResult:
        start = time.monotonic()
        proc = await asyncio.create_subprocess_exec(
            "uv", "pip", "install", "--python", str(self.python), *packages,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        ms = int((time.monotonic() - start) * 1000)
        return ExecResult(
            stdout=stdout.decode(),
            stderr=stderr.decode(),
            returncode=proc.returncode,
            duration_ms=ms,
        )

    # ── Execution ──────────────────────────────────────────────────────────

    async def execute(self, code: str, cwd: Path | None = None) -> ExecResult:
        """Run code in the project venv, capture stdout/stderr and any output files."""
        await self.ensure_venv()
        work_dir = cwd or (self.task_dir / "chart")
        work_dir.mkdir(parents=True, exist_ok=True)

        with tempfile.NamedTemporaryFile(
            suffix=".py", dir=work_dir, delete=False, mode="w"
        ) as f:
            f.write(code)
            script_path = f.name

        try:
            start_ts = time.time()
            start = time.monotonic()

            proc = await asyncio.create_subprocess_exec(
                str(self.python), script_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(work_dir),
                env={**os.environ, "MPLBACKEND": "svg"},
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=EXEC_TIMEOUT
                )
            except asyncio.TimeoutError:
                proc.kill()
                return ExecResult(
                    stdout="", stderr=f"Execution timed out after {EXEC_TIMEOUT}s",
                    returncode=-1, duration_ms=EXEC_TIMEOUT * 1000,
                )

            ms = int((time.monotonic() - start) * 1000)
            new_files = [
                str(p) for p in work_dir.iterdir()
                if p.suffix in (".svg", ".pdf", ".png") and p.stat().st_mtime >= start_ts
            ]

            return ExecResult(
                stdout=stdout.decode(),
                stderr=stderr.decode(),
                returncode=proc.returncode,
                duration_ms=ms,
                artifacts=new_files,
            )
        finally:
            os.unlink(script_path)

    async def render_chart(self) -> ExecResult:
        """Re-run the task's plot.py, fix SVG gids, return result."""
        plot_py = self.task_dir / "chart" / "plot.py"
        if not plot_py.exists():
            return ExecResult(
                stdout="", stderr="plot.py not found", returncode=1, duration_ms=0
            )
        code = plot_py.read_text()
        result = await self.execute(code, cwd=self.task_dir / "chart")
        if result.returncode == 0:
            for artifact in result.artifacts:
                if artifact.endswith(".svg"):
                    from sandbox.gid_fixer import fix_and_save
                    gid_report = fix_and_save(artifact)
                    if gid_report.warnings:
                        result.stdout += f"\n[gid-fixer warnings] {gid_report.warnings}"
        return result

    # ── Package management ─────────────────────────────────────────────────

    async def check_env(self) -> dict:
        result = await self.execute(
            "import sys, pkg_resources; "
            "print(sys.version); "
            "[print(p.project_name, p.version) for p in pkg_resources.working_set]"
        )
        lines = result.stdout.strip().splitlines()
        return {
            "python_version": lines[0] if lines else "unknown",
            "packages": {l.split()[0]: l.split()[1] for l in lines[1:] if len(l.split()) >= 2},
        }

    def destroy_venv(self) -> None:
        if self.venv_dir.exists():
            shutil.rmtree(self.venv_dir)
