"""
Load ~/open-plot-agent/config.toml and build ProviderConfig objects.
Falls back to sensible defaults if the file doesn't exist.
"""
import os
from pathlib import Path

try:
    import tomllib
except ImportError:
    import tomli as tomllib  # type: ignore

from agent.providers.base import ProviderConfig

CONFIG_PATH = Path.home() / "open-plot-agent" / "config.toml"

_DEFAULT: dict = {
    "max_tool_rounds": 8,
    "provider": {
        "default": "ollama",
        "anthropic": {
            "model": "claude-sonnet-4-6",
            "api_key_env": "ANTHROPIC_API_KEY",
        },
        "ollama": {
            "model": "qwen3.6:35b",
            "base_url": "http://localhost:11434/v1",
        },
    }
}


def _load_raw() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "rb") as f:
            return tomllib.load(f)
    return _DEFAULT


def _format_toml(raw: dict) -> str:
    """Serialize the config dict back to TOML (covers the fixed config structure)."""
    prov = raw.get("provider", {})
    lines = [
        f'max_tool_rounds = {raw.get("max_tool_rounds", 8)}',
        f'visual_feedback = {"true" if raw.get("visual_feedback", False) else "false"}',
        "",
        "[provider]",
    ]
    lines.append(f'default = "{prov.get("default", "ollama")}"')

    anth = prov.get("anthropic")
    if anth:
        lines += ["", "[provider.anthropic]"]
        lines.append(f'model = "{anth.get("model", "claude-sonnet-4-6")}"')
        if "api_key" in anth and anth["api_key"]:
            lines.append(f'api_key = "{anth["api_key"]}"')
        elif "api_key_env" in anth:
            lines.append(f'api_key_env = "{anth["api_key_env"]}"')

    oll = prov.get("ollama")
    if oll:
        lines += ["", "[provider.ollama]"]
        lines.append(f'model = "{oll.get("model", "qwen3.6:35b")}"')
        lines.append(f'base_url = "{oll.get("base_url", "http://localhost:11434/v1")}"')

    return "\n".join(lines) + "\n"


def get_provider_config(provider_name: str | None = None) -> tuple[str, ProviderConfig]:
    raw = _load_raw()
    prov_section = raw.get("provider", {})
    name = provider_name or prov_section.get("default", "ollama")
    cfg = prov_section.get(name, {})

    if name == "anthropic":
        # Support both direct api_key and env var indirection
        api_key = cfg.get("api_key") or os.environ.get(
            cfg.get("api_key_env", "ANTHROPIC_API_KEY"), ""
        )
        return name, ProviderConfig(
            model=cfg.get("model", "claude-sonnet-4-6"),
            api_key=api_key,
            extra={
                "thinking": cfg.get("thinking", True),
                "thinking_budget": cfg.get("thinking_budget", 5000),
            },
        )
    elif name == "ollama":
        return name, ProviderConfig(
            model=cfg.get("model", "qwen3.6:35b"),
            base_url=cfg.get("base_url", "http://localhost:11434/v1"),
            extra={
                "thinking": cfg.get("thinking", True),
                "thinking_budget": cfg.get("thinking_budget", 4096),
            },
        )
    else:
        raise ValueError(f"Unknown provider: {name}")


def get_settings_dict() -> dict:
    """Return current settings as a dict suitable for the /api/settings response."""
    raw = _load_raw()
    prov = raw.get("provider", {})
    anth = prov.get("anthropic", {})
    oll = prov.get("ollama", {})

    anth_key = anth.get("api_key") or os.environ.get(
        anth.get("api_key_env", "ANTHROPIC_API_KEY"), ""
    )

    return {
        "max_tool_rounds": raw.get("max_tool_rounds", 8),
        "visual_feedback": raw.get("visual_feedback", False),
        "default_provider": prov.get("default", "ollama"),
        "anthropic": {
            "model": anth.get("model", "claude-sonnet-4-6"),
            "api_key_set": bool(anth_key),
        },
        "ollama": {
            "model": oll.get("model", "qwen3.6:35b"),
            "base_url": oll.get("base_url", "http://localhost:11434/v1"),
        },
    }


def write_settings(updates: dict) -> None:
    """Persist updated settings to config.toml."""
    raw = _load_raw()
    prov = raw.setdefault("provider", {})

    if "max_tool_rounds" in updates:
        raw["max_tool_rounds"] = int(updates["max_tool_rounds"])

    if "visual_feedback" in updates:
        raw["visual_feedback"] = bool(updates["visual_feedback"])

    if "default_provider" in updates:
        prov["default"] = updates["default_provider"]

    if "anthropic_model" in updates:
        prov.setdefault("anthropic", {})["model"] = updates["anthropic_model"]
    if updates.get("anthropic_api_key"):
        prov.setdefault("anthropic", {})["api_key"] = updates["anthropic_api_key"]

    if "ollama_model" in updates:
        prov.setdefault("ollama", {})["model"] = updates["ollama_model"]
    if "ollama_base_url" in updates:
        prov.setdefault("ollama", {})["base_url"] = updates["ollama_base_url"]

    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(_format_toml(raw))


def build_provider(provider_name: str | None = None):
    name, cfg = get_provider_config(provider_name)
    if name == "anthropic":
        from agent.providers.anthropic_provider import AnthropicProvider
        return AnthropicProvider(cfg)
    elif name == "ollama":
        from agent.providers.ollama_provider import OllamaProvider
        return OllamaProvider(cfg)
    raise ValueError(f"Unknown provider: {name}")
