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

_DEFAULT = {
    "provider": {
        "default": "anthropic",
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


def get_provider_config(provider_name: str | None = None) -> tuple[str, ProviderConfig]:
    raw = _load_raw()
    prov_section = raw.get("provider", {})
    name = provider_name or prov_section.get("default", "anthropic")
    cfg = prov_section.get(name, {})

    if name == "anthropic":
        api_key = os.environ.get(cfg.get("api_key_env", "ANTHROPIC_API_KEY"), "")
        return name, ProviderConfig(
            model=cfg.get("model", "claude-sonnet-4-6"),
            api_key=api_key,
        )
    elif name == "ollama":
        return name, ProviderConfig(
            model=cfg.get("model", "qwen3:35b"),
            base_url=cfg.get("base_url", "http://localhost:11434/v1"),
        )
    else:
        raise ValueError(f"Unknown provider: {name}")


def build_provider(provider_name: str | None = None):
    name, cfg = get_provider_config(provider_name)
    if name == "anthropic":
        from agent.providers.anthropic_provider import AnthropicProvider
        return AnthropicProvider(cfg)
    elif name == "ollama":
        from agent.providers.ollama_provider import OllamaProvider
        return OllamaProvider(cfg)
    raise ValueError(f"Unknown provider: {name}")
