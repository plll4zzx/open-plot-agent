from agent.tools.base import Tool, register_tool
from sandbox.runner import SandboxRunner


@register_tool
class GitRestoreTool(Tool):
    def __init__(self):
        super().__init__(
            name="git_restore",
            category="git",
            description=(
                "Restore a file or the entire task to a previous git version. "
                "This checks out the specified file(s) from the given commit hash "
                "and creates a new commit recording the restoration. "
                "Use git_log first to find the commit hash you want to restore to."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "hash": {
                        "type": "string",
                        "description": "Commit hash to restore from (e.g. 'abc1234').",
                    },
                    "path": {
                        "type": "string",
                        "description": (
                            "File path to restore, relative to task dir (e.g. 'chart/plot.py'). "
                            "Omit to restore all task files."
                        ),
                    },
                },
                "required": ["hash"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        from git_manager.manager import GitManager

        gm = GitManager(runner.project_dir)
        hash_ = args["hash"]

        # Build the full path scoped to this task
        task_rel = f"experiments/{runner.experiment_id}/tasks/{runner.task_id}"
        restore_path = f"{task_rel}/{args['path']}" if args.get("path") else task_rel

        try:
            await gm.git_restore(hash_, restore_path)
            await gm.auto_commit(f"restore: revert {restore_path} to {hash_[:7]}")
        except Exception as e:
            return {"error": f"Failed to restore: {e}"}

        # Return the restored file content if it's a single file
        result: dict = {
            "ok": True,
            "restored_hash": hash_,
            "restored_path": args.get("path", "(all task files)"),
        }

        if args.get("path"):
            restored_file = runner.task_dir / args["path"]
            if restored_file.exists():
                content = restored_file.read_text()
                result["content"] = content[:3000]
                if len(content) > 3000:
                    result["content"] += "\n... (truncated)"

        return result
