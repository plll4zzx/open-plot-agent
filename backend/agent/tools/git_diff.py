from agent.tools.base import Tool
from sandbox.runner import SandboxRunner


class GitDiffTool(Tool):
    def __init__(self):
        super().__init__(
            name="git_diff",
            description=(
                "Compare two git versions to see what changed. "
                "Shows the diff between two commits for a specific file or the entire task. "
                "Useful for understanding what was modified between versions."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "hash1": {
                        "type": "string",
                        "description": "First commit hash (older). Use 'HEAD~1' for previous commit.",
                    },
                    "hash2": {
                        "type": "string",
                        "description": "Second commit hash (newer). Default: 'HEAD' (current).",
                    },
                    "path": {
                        "type": "string",
                        "description": (
                            "File path to diff, relative to task dir (e.g. 'chart/plot.py'). "
                            "Omit to diff all files in the task."
                        ),
                    },
                },
                "required": ["hash1"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        from git_manager.manager import GitManager

        gm = GitManager(runner.project_dir)
        hash1 = args["hash1"]
        hash2 = args.get("hash2", "HEAD")

        # Scope to task directory
        diff_path = None
        if args.get("path"):
            diff_path = f"experiments/{runner.experiment_id}/tasks/{runner.task_id}/{args['path']}"
        else:
            diff_path = f"experiments/{runner.experiment_id}/tasks/{runner.task_id}"

        try:
            diff_text = await gm.git_diff(hash1, hash2, diff_path)
        except Exception as e:
            return {"error": f"Failed to compute diff: {e}"}

        # Truncate if too long
        if len(diff_text) > 4000:
            diff_text = diff_text[:4000] + "\n... (truncated, diff too long)"

        return {
            "hash1": hash1,
            "hash2": hash2,
            "path": args.get("path", "(all task files)"),
            "diff": diff_text if diff_text else "(no differences)",
        }
