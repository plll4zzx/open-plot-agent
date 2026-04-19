from agent.tools.base import Tool, register_tool
from sandbox.runner import SandboxRunner


@register_tool
class GitLogTool(Tool):
    def __init__(self):
        super().__init__(
            name="git_log",
            category="git",
            description=(
                "View the git commit history for this project. "
                "Use this to understand what changes have been made, "
                "find a specific version to restore, or check recent activity."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "n": {
                        "type": "integer",
                        "description": "Number of commits to return (default: 10, max: 50)",
                    },
                    "path": {
                        "type": "string",
                        "description": (
                            "Optional file path to filter history for (e.g. 'chart/plot.py'). "
                            "Relative to the task directory."
                        ),
                    },
                },
                "required": [],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        from git_manager.manager import GitManager

        gm = GitManager(runner.project_dir)
        n = min(args.get("n", 10), 50)

        try:
            commits = await gm.git_log(n)
        except Exception as e:
            return {"error": f"Failed to read git log: {e}"}

        # If a path filter is specified, we re-query with path filter
        if args.get("path"):
            rel_path = f"experiments/{runner.experiment_id}/tasks/{runner.task_id}/{args['path']}"
            try:
                import asyncio
                def _filtered_log():
                    repo = gm._get_repo()
                    result = []
                    for c in repo.iter_commits(max_count=n, paths=rel_path):
                        result.append({
                            "hash": c.hexsha[:7],
                            "message": c.message.strip(),
                            "author": c.author.name,
                            "timestamp": c.committed_datetime.isoformat(),
                        })
                    return result
                loop = asyncio.get_event_loop()
                commits = await loop.run_in_executor(None, _filtered_log)
            except Exception as e:
                return {"error": f"Failed to filter git log: {e}"}

        return {
            "commits": commits,
            "count": len(commits),
        }
