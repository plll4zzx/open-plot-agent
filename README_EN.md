# OpenPlotAgent

**🌐 Language / 语言：** Current: English ｜ [切换到中文](README.md)

---

> **An AI agent for academic figure generation** — human-in-the-loop workflow: AI script generation meets manual visual refinement, with direct PDF export for paper submission and full Git provenance.

---

## Table of Contents

- [Introduction](#introduction)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Workflow](#workflow)
- [API Reference](#api-reference)
- [Data Storage Layout](#data-storage-layout)
- [Agent Tool Reference](#agent-tool-reference)
- [Design Philosophy](#design-philosophy)

---

## Introduction

OpenPlotAgent is an **AI plotting assistant** built for researchers (graduate students, postdocs, PIs) who live in LaTeX, Python, and the terminal. It deeply integrates with Python's scientific ecosystem and Git version control.

**Just describe what you need:** "Draw a boxplot comparing three experimental groups, following Nature submission guidelines" — the Agent automatically handles data exploration, Matplotlib code generation, chart rendering, and export. You can step in at any time: click SVG elements to adjust colors and labels, or swap the entire color scheme, then export a paper-ready PDF in one click. Every change is automatically committed to Git for full reproducibility.

Unlike online tools such as Datawrapper or Flourish, OpenPlotAgent:

- **Human-in-the-Loop** — AI script generation and manual visual editing work together seamlessly, not a black-box automation
- **Natively supports academic standards** (SVG/PDF export, PGF backend, LaTeX formulas, journal-specific dimensions)
- **Full Git provenance** — every code edit, data change, and conversation is auto-committed
- **Flexible LLM backend** — supports both local (Ollama/Qwen) and cloud (Claude), switchable at runtime

---

## Key Features

### Human-in-the-Loop

The core design principle: AI handles the tedious scripting and data processing; you handle aesthetic judgment and fine-tuning — the two work together seamlessly.

- Conversational plotting: describe what you need, Agent handles data exploration, code generation, and rendering
- Visual takeover: click any SVG element to directly edit colors, labels, line widths — no code changes needed
- One-click color scheme switching with custom palette saving
- Tabular data viewer and editor — paste Excel data directly
- Agent-aware manual edits: handmade changes automatically notify the Agent to keep context in sync

### Paper-Ready PDF Export

- Export PDFs that meet journal submission standards (matplotlib PGF backend)
- SVG vector format — infinitely scalable without quality loss
- LaTeX math formula rendering support
- Default Okabe-Ito colorblind-friendly palette
- Configurable journal-specific dimensions (Nature, Science, IEEE, etc.)

### AI-Driven Chart Generation

- Streaming output shows real-time reasoning and tool calls
- Three-tier memory system: global preferences → project conventions → task history, accumulated across sessions
- Full data pipeline: raw data → cleaning → plotting, entirely within the Agent

### Full Git Version Control

- Each project has its own isolated Git repository
- Code edits, data changes, and conversation logs are automatically committed
- Browse diff, restore any file to any previous commit

### Isolated Code Execution

- Per-project `uv` virtual environment
- Sandboxed subprocess execution with 30-second timeout
- Dynamically install pip packages into the project environment

### Flexible LLM Backend

- **Anthropic Claude** (cloud, recommended: claude-sonnet-4-6)
- **Ollama / Qwen3** (local deployment, with `<think>` reasoning block support)
- Switch provider and model anytime from the UI settings panel — no restart required

---

## Tech Stack

### Backend (Python)

| Component | Technology |
|-----------|------------|
| Web Framework | FastAPI 0.115+, Uvicorn 0.34+ |
| LLM Integration | Anthropic SDK, OpenAI SDK (Ollama-compatible) |
| Code Execution | `uv` venv + subprocess sandbox (30s timeout) |
| Data Processing | pandas, numpy, scipy, seaborn |
| Chart Generation | matplotlib (SVG/PDF/PGF backends) |
| Version Control | GitPython 3.1+ |
| Async I/O | aiofiles, WebSocket |
| Data Validation | Pydantic 2.0+ |
| Testing | pytest, pytest-asyncio, httpx |

**Python version requirement: ≥ 3.11**

### Frontend (JavaScript/React)

| Component | Technology |
|-----------|------------|
| Framework | React 19.2, Vite 8.0 |
| State Management | Zustand 5.0 |
| Styling | Tailwind CSS 4.2 |
| Icons | Lucide React 1.8 |
| Fonts | Fraunces, Geist, JetBrains Mono, Cormorant Garamond |

---

## Project Structure

```
open-plot-agent/
├── backend/                    # Python FastAPI backend
│   ├── agent/
│   │   ├── providers/          # LLM adapters (Anthropic / Ollama)
│   │   ├── tools/              # Agent tool registry (14 tools)
│   │   └── loop.py             # Agent main loop (streaming + tool dispatch)
│   ├── sandbox/
│   │   └── runner.py           # Sandboxed code executor
│   ├── git_manager/            # Git operation wrappers
│   ├── main.py                 # FastAPI routes (30+ endpoints)
│   ├── config.py               # Configuration management
│   ├── workspace_init.py       # Project directory initializer
│   └── pyproject.toml          # Python dependency declaration
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx             # Main UI (Dashboard + Workspace)
│   │   ├── components/         # 7 core UI components
│   │   ├── hooks/
│   │   │   └── useAgentChat.js # WebSocket communication hook
│   │   └── store/
│   │       └── index.js        # Zustand global state
│   └── package.json
├── DesignSystem/               # Design system docs & component showcase
│   ├── README.md               # Design tokens (colors, fonts, spacing)
│   └── ui_kits/                # React component showcase
└── doc/                        # Project documentation
    ├── PROJECT_OVERVIEW.md
    ├── REQUIREMENTS.md
    ├── UI_DESIGN.md
    └── UPGRADE_PLAN.md
```

---

## Installation & Setup

### Prerequisites

- Python ≥ 3.11
- Node.js ≥ 18
- `uv` (Python package manager): `pip install uv`
- Optional: [Ollama](https://ollama.ai) for local LLM support

### 1. Start the Backend

```bash
cd backend/

# Install Python dependencies
pip install -e .

# (Optional) Include dev dependencies
pip install -e ".[dev]"

# Launch FastAPI server (default port 8000)
uvicorn main:app --reload --port 8000
```

### 2. Start the Frontend

```bash
cd frontend/

# Install Node dependencies
npm install

# Start dev server (default port 5173)
npm run dev

# Production build
npm run build
```

### 3. Configure Your LLM

**Using Claude (recommended):**

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

**Using a local Ollama model:**

```bash
# Install and start Ollama
ollama pull qwen3:8b
ollama serve
```

Then switch the provider to `ollama` in the UI settings panel or config file.

### 4. Open the App

Navigate to [http://localhost:5173](http://localhost:5173) in your browser.

---

## Configuration

Config file locations (by priority):

- `~/.config/open-plot-agent/config.toml`
- `~/open-plot-agent/config.toml`

```toml
# Maximum tool call rounds per agent turn (prevents infinite loops)
max_tool_rounds = 8

[provider]
default = "anthropic"   # "anthropic" or "ollama"

[provider.anthropic]
model = "claude-sonnet-4-6"
api_key_env = "ANTHROPIC_API_KEY"   # Read from environment variable
# api_key = "sk-ant-..."            # Or hardcode directly (not recommended)

[provider.ollama]
model = "qwen3:8b"
base_url = "http://localhost:11434/v1"
thinking = true           # Enable reasoning blocks (<think>)
thinking_budget = 4096    # Max reasoning tokens
```

All settings can also be changed directly from the **Settings panel** in the UI.

---

## Workflow

OpenPlotAgent breaks academic figure creation into four standard steps:

```
① Discover Data  →  ② Clean & Process  →  ③ Write Code  →  ④ Execute & Render
   inspect_data       transform_data        write plot.py     execute_python
   query_data         write_data            (matplotlib)      render_chart
```

### Typical Usage

1. **Create a Project** — Set up a project in the Dashboard (associate journal specs and visual style)
2. **Upload Data** — Upload raw data files (CSV, Excel, JSON, etc.) in the Experiment panel
3. **Create a Task** — Create one Task per figure to maintain separation of concerns
4. **Chat to Plot** — Describe your needs in the Chat panel; the Agent handles data exploration, code generation, and rendering automatically
5. **Visual Refinement** — Click SVG elements to edit colors/text, or swap the entire color scheme
6. **Export** — Download SVG or PDF (PGF format, LaTeX-compatible)

---

## API Reference

After starting the backend, visit [http://localhost:8000/docs](http://localhost:8000/docs) for the full interactive Swagger documentation.

### Endpoint Overview

#### Project Management
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects` | List all projects |

#### Experiment Management
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/projects/{pid}/experiments` | Create an experiment |
| `POST` | `/api/projects/{pid}/experiments/{eid}/data` | Upload a raw data file |
| `GET` | `/api/projects/{pid}/experiments/{eid}/raw/{fname}/preview` | Preview data (first 200 rows) |

#### Tasks & Charts
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/projects/{pid}/experiments/{eid}/tasks` | Create a task |
| `GET` | `/api/projects/{pid}/experiments/{eid}/tasks/{tid}/chart/svg` | Get current SVG |
| `POST` | `/api/projects/{pid}/experiments/{eid}/tasks/{tid}/render` | Re-render chart |
| `GET` | `/api/projects/{pid}/experiments/{eid}/tasks/{tid}/chart/export-pdf` | Export PDF |

#### Git Operations
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/{pid}/git/log` | View commit history |
| `POST` | `/api/projects/{pid}/experiments/{eid}/tasks/{tid}/git/restore` | Restore file to a commit |

#### Real-Time Agent Chat
| Protocol | Path | Description |
|----------|------|-------------|
| `WebSocket` | `/ws/{pid}/{eid}/{tid}?provider={name}` | Streaming agent conversation |

#### System Settings
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Get current configuration |
| `POST` | `/api/settings` | Update configuration |
| `GET` | `/health` | Health check |

---

## Data Storage Layout

All data is stored locally under `~/open-plot-agent/`:

```
~/open-plot-agent/
├── config.toml                             # Global configuration
└── projects/
    └── {project_id}/                       # Project root
        ├── .git/                           # Git repository
        ├── .venv/                          # Isolated Python virtual environment
        ├── PROJECT.md                      # Project memory (journal specs, visual conventions)
        └── experiments/
            └── {experiment_id}/
                ├── EXPERIMENT.md           # Experiment memory (data source, collection notes)
                ├── raw/                    # Original data files
                └── tasks/
                    └── {task_id}/
                        ├── TASK.md         # Task memory (decision history)
                        ├── processed/
                        │   └── data.csv    # Cleaned data (Agent reads this directly)
                        ├── chart/
                        │   ├── plot.py     # Generated Matplotlib code
                        │   └── output.svg  # Rendered output
                        └── conversations/  # Conversation logs (JSON)
```

---

## Agent Tool Reference

The Agent has access to 14 tools:

### Data Processing Tools
| Tool | Description |
|------|-------------|
| `inspect_data` | Preview file structure, column names, data types, and statistics |
| `query_data` | Filter data by columns/conditions with row limit support |
| `transform_data` | 12+ transformation operations (forward_fill, transpose, pivot, melt, rename, drop, to_numeric, fillna, etc.) |
| `write_data` | Save processed data as CSV |
| `read_file` | Read any task file |
| `write_file` | Write content to a file |
| `list_files` | List files in a directory |
| `export_from_experiment` | Copy raw data from experiment level to task level |

### Chart Generation Tools
| Tool | Description |
|------|-------------|
| `execute_python` | Execute Python code in the project sandbox (30s timeout) |
| `render_chart` | Re-run `plot.py` and return the SVG |
| `install_package` | Dynamically install a pip package into the project venv |

### Git Version Control Tools
| Tool | Description |
|------|-------------|
| `git_log` | View commit history |
| `git_diff` | Compare two versions of a file |
| `git_restore` | Restore a file to a specific commit |

---

## Design Philosophy

OpenPlotAgent is guided by the following core principles:

- **Local-first, data stays local** — All data and computation remain on your machine, suitable for confidential research
- **Interface density is a feature** — Compact information density, no animations, no decorative illustrations — precision-focused
- **Git as infrastructure** — Version control is not optional; it is a core part of the workflow
- **Swappable AI backend** — Not locked to any specific LLM; freely switch between Claude and local models
- **Memory accumulates with projects** — The Agent builds up preferences across three levels (global / project / task), getting smarter the more you use it


