"""
Git operations for OpenPlotAgent.
Each project has one git repo. All commits are auto-generated with structured messages.
"""
import asyncio
from pathlib import Path

from git import GitCommandError, InvalidGitRepositoryError, Repo


class GitManager:
    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self._repo: Repo | None = None

    def _get_repo(self) -> Repo:
        if self._repo is None:
            try:
                self._repo = Repo(self.project_dir)
            except InvalidGitRepositoryError:
                self._repo = Repo.init(self.project_dir)
                self._repo.index.commit("init: create project")
        return self._repo

    async def ensure_repo(self) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._get_repo)

    async def auto_commit(self, message: str) -> str | None:
        """Stage all changes and commit. Returns commit hash or None if nothing to commit."""
        def _commit():
            repo = self._get_repo()
            repo.git.add(A=True)
            if not repo.index.diff("HEAD") and not repo.untracked_files:
                return None
            commit = repo.index.commit(message)
            return commit.hexsha[:7]

        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(None, _commit)
        except GitCommandError:
            return None

    async def git_log(self, n: int = 20) -> list[dict]:
        def _log():
            repo = self._get_repo()
            commits = []
            for c in list(repo.iter_commits(max_count=n)):
                commits.append({
                    "hash": c.hexsha[:7],
                    "message": c.message.strip(),
                    "author": c.author.name,
                    "timestamp": c.committed_datetime.isoformat(),
                })
            return commits

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _log)

    async def git_diff(self, hash1: str, hash2: str, path: str | None = None) -> str:
        def _diff():
            repo = self._get_repo()
            args = [hash1, hash2]
            if path:
                args += ["--", path]
            return repo.git.diff(*args)

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _diff)

    async def git_restore(self, hash_: str, path: str | None = None) -> None:
        def _restore():
            repo = self._get_repo()
            if path:
                repo.git.checkout(hash_, "--", path)
            else:
                repo.git.checkout(hash_)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _restore)
