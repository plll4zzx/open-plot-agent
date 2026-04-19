"""
Agent tool registry.
Each tool lives in its own module under agent/tools/.
This __init__ assembles them into TOOL_REGISTRY and provides get_schemas().
"""
from agent.tools.base import Tool

from agent.tools.list_files import ListFilesTool
from agent.tools.read_file import ReadFileTool
from agent.tools.write_file import WriteFileTool
from agent.tools.execute_python import ExecutePythonTool
from agent.tools.render_chart import RenderChartTool
from agent.tools.install_package import InstallPackageTool
from agent.tools.inspect_data import InspectDataTool
from agent.tools.query_data import QueryDataTool
from agent.tools.transform_data import TransformDataTool
from agent.tools.write_data import WriteDataTool
from agent.tools.git_log import GitLogTool
from agent.tools.git_diff import GitDiffTool
from agent.tools.git_restore import GitRestoreTool


TOOL_REGISTRY: dict[str, Tool] = {
    t.name: t for t in [
        # File operations
        ListFilesTool(),
        ReadFileTool(),
        WriteFileTool(),
        # Execution
        ExecutePythonTool(),
        RenderChartTool(),
        InstallPackageTool(),
        # Data tools
        InspectDataTool(),
        QueryDataTool(),
        TransformDataTool(),
        WriteDataTool(),
        # Git tools
        GitLogTool(),
        GitDiffTool(),
        GitRestoreTool(),
    ]
}


def get_schemas(fmt: str) -> list[dict]:
    """Return tool schemas in 'anthropic' or 'openai' format."""
    schemas = []
    for tool in TOOL_REGISTRY.values():
        if fmt == "anthropic":
            schemas.append({
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            })
        else:  # openai / ollama
            schemas.append({
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema,
            })
    return schemas
