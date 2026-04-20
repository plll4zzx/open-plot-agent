from agent.tools.base import Tool, register_tool
from sandbox.runner import SandboxRunner


@register_tool
class SearchChartsTool(Tool):
    def __init__(self):
        super().__init__(
            name="search_charts",
            category="rag",
            description=(
                "Search through past successfully generated chart code using semantic similarity. "
                "Returns up to k matching plot.py scripts from your history. "
                "Use this when the user wants a chart 'similar to' a previous one, or when you want "
                "reference examples for a specific chart type (e.g. 'violin plot', 'heatmap with annotations')."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural language description of the chart you're looking for",
                    },
                    "k": {
                        "type": "integer",
                        "description": "Number of results to return (default 3, max 5)",
                        "default": 3,
                    },
                },
                "required": ["query"],
            },
        )

    async def run(self, args: dict, runner: SandboxRunner) -> dict:
        from agent.rag.chart_rag import get_rag

        query: str = args["query"]
        k: int = min(int(args.get("k", 3)), 5)

        rag = get_rag()
        if not rag.ready:
            return {
                "ok": False,
                "results": [],
                "message": (
                    "Chart index is empty or not ready. "
                    "Make sure Ollama is running and `nomic-embed-text` is pulled "
                    "(`ollama pull nomic-embed-text`). Charts are indexed automatically "
                    "after each successful execution."
                ),
            }

        results = rag.search(query, k=k)
        return {
            "ok": True,
            "count": len(results),
            "index_size": rag.size,
            "results": results,
        }
