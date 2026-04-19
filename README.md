# OpenPlotAgent

**🌐 语言 / Language：** 当前：中文 ｜ [Switch to English](README_EN.md)

---

> **面向科研人员的 AI 绘图智能体** — 人机协同工作流：AI 脚本生成 × 手工可视化调整，直接导出论文可用的 PDF 图形，全程 Git 版本管理。

---

## 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [安装与运行](#安装与运行)
- [配置说明](#配置说明)
- [工作流程](#工作流程)
- [API 文档](#api-文档)
- [数据存储结构](#数据存储结构)
- [Agent 工具列表](#agent-工具列表)
- [设计理念](#设计理念)

---

## 项目简介

OpenPlotAgent 是一款面向科研人员（研究生、博士后、PI）的 **AI 绘图助手**，深度整合 LaTeX 工作流、Python 生态和 Git 版本控制。

**你只需用自然语言描述**："帮我画一个对比三组实验结果的箱线图，符合 Nature 投稿规范"——Agent 会自动完成数据处理、Matplotlib 代码生成、图表渲染与导出。你可以随时接管：点击 SVG 元素直接调整颜色和文字，或切换整套配色方案，最终一键导出论文可用的 PDF。每一步变更自动提交至 Git，确保完全可复现。

与 Datawrapper、Flourish 等在线工具不同，OpenPlotAgent：

- **Human-in-the-Loop**：AI 脚本生成与手工可视化编辑无缝结合，而非黑盒自动化
- **原生支持学术规范**（SVG/PDF 导出、PGF 后端、LaTeX 公式、期刊尺寸）
- **Git 全程溯源**，每次代码/数据/对话均自动提交
- **灵活的 LLM 后端**：支持本地（Ollama/Qwen）和云端（Claude），可随时切换

---

## 核心特性

### Human-in-the-Loop 人机协同

OpenPlotAgent 的核心设计理念：AI 负责繁琐的脚本编写与数据处理，人负责审美判断与精细调整，两者无缝衔接。

- 对话式绘图：用自然语言描述需求，Agent 自动完成数据探索、代码生成、图表渲染
- 可视化接管：点击 SVG 元素直接修改颜色、文字、线宽等属性，无需改代码
- 一键切换配色方案，支持自定义调色板保存
- 数据表格可视化查看与编辑，支持直接粘贴 Excel 数据
- Agent 感知人工编辑：手工改动会自动通知 Agent，保持上下文同步

### 论文可用的 PDF 导出

- 直接导出符合期刊投稿规范的 PDF（matplotlib PGF 后端）
- SVG 矢量格式，无限缩放不失真
- 支持 LaTeX 数学公式渲染
- 默认 Okabe-Ito 色盲友好配色方案
- 可配置期刊规范尺寸（Nature、Science、IEEE 等）

### AI 驱动绘图

- 支持流式输出，实时展示思考过程与工具调用
- 三层记忆系统：全局偏好 → 项目约定 → 任务历史，跨会话积累经验
- 完整的数据处理管线：原始数据 → 清洗 → 绘图，全程在 Agent 内完成

### 全程 Git 版本管理

- 每个项目独立 Git 仓库
- 代码编辑、数据变更、对话记录自动提交
- 支持查看 Diff、回退到任意历史版本

### 隔离代码执行环境

- 每个项目独立 `uv` 虚拟环境
- 30 秒超时的沙盒执行，安全可控
- 支持动态安装 pip 包到项目环境

### 灵活的 LLM 后端

- **Anthropic Claude**（云端，推荐 claude-sonnet-4-6）
- **Ollama / Qwen3**（本地部署，支持 `<think>` 推理块）
- UI 内可随时切换 Provider 和模型，无需重启

---

## 技术栈

### 后端（Python）

| 组件 | 技术 |
|------|------|
| Web 框架 | FastAPI 0.115+、Uvicorn 0.34+ |
| LLM 接入 | Anthropic SDK、OpenAI SDK（兼容 Ollama） |
| 代码执行 | `uv` 虚拟环境 + subprocess 沙盒（30s 超时） |
| 数据处理 | pandas、numpy、scipy、seaborn |
| 绘图 | matplotlib（SVG/PDF/PGF 后端） |
| 版本控制 | GitPython 3.1+ |
| 异步 I/O | aiofiles、WebSocket |
| 数据验证 | Pydantic 2.0+ |
| 测试 | pytest、pytest-asyncio、httpx |

**Python 版本要求：≥ 3.11**

### 前端（JavaScript/React）

| 组件 | 技术 |
|------|------|
| 框架 | React 19.2、Vite 8.0 |
| 状态管理 | Zustand 5.0 |
| 样式 | Tailwind CSS 4.2 |
| 图标 | Lucide React 1.8 |
| 字体 | Fraunces、Geist、JetBrains Mono、Cormorant Garamond |

---

## 项目结构

```
open-plot-agent/
├── backend/                    # Python FastAPI 后端
│   ├── agent/
│   │   ├── providers/          # LLM 适配层（Anthropic / Ollama）
│   │   ├── tools/              # Agent 工具集（14 个工具）
│   │   └── loop.py             # Agent 主循环（流式 + 工具调用）
│   ├── sandbox/
│   │   └── runner.py           # 沙盒代码执行器
│   ├── git_manager/            # Git 操作封装
│   ├── main.py                 # FastAPI 路由（30+ 接口）
│   ├── config.py               # 配置管理
│   ├── workspace_init.py       # 项目目录初始化
│   └── pyproject.toml          # Python 依赖声明
├── frontend/                   # React + Vite 前端
│   ├── src/
│   │   ├── App.jsx             # 主界面（Dashboard + Workspace）
│   │   ├── components/         # 7 个核心 UI 组件
│   │   ├── hooks/
│   │   │   └── useAgentChat.js # WebSocket 通信 Hook
│   │   └── store/
│   │       └── index.js        # Zustand 全局状态
│   └── package.json
├── DesignSystem/               # 设计系统文档与组件展示
│   ├── README.md               # 设计规范（颜色、字体、间距）
│   └── ui_kits/                # React 组件 Showcase
└── doc/                        # 项目文档
    ├── PROJECT_OVERVIEW.md
    ├── REQUIREMENTS.md
    ├── UI_DESIGN.md
    └── UPGRADE_PLAN.md
```

---

## 安装与运行

### 前置依赖

- Python ≥ 3.11
- Node.js ≥ 18
- `uv`（Python 包管理器）：`pip install uv`
- 可选：[Ollama](https://ollama.ai)（本地 LLM）

### 1. 启动后端

```bash
cd backend/

# 安装 Python 依赖
pip install -e .

# （可选）包含开发依赖
pip install -e ".[dev]"

# 启动 FastAPI 服务（默认端口 8000）
uvicorn main:app --reload --port 8000
```

### 2. 启动前端

```bash
cd frontend/

# 安装 Node 依赖
npm install

# 启动开发服务器（默认端口 5173）
npm run dev

# 生产构建
npm run build
```

### 3. 配置 LLM

**使用 Claude（推荐）：**

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

**使用 Ollama 本地模型：**

```bash
# 安装并启动 Ollama
ollama pull qwen3:8b
ollama serve
```

然后在 UI 设置面板或配置文件中切换 Provider 为 `ollama`。

### 4. 访问应用

浏览器打开 [http://localhost:5173](http://localhost:5173)

---

## 配置说明

配置文件路径（按优先级）：

- `~/.config/open-plot-agent/config.toml`
- `~/open-plot-agent/config.toml`

```toml
# 最大工具调用轮次（防止无限循环）
max_tool_rounds = 8

[provider]
default = "anthropic"   # "anthropic" 或 "ollama"

[provider.anthropic]
model = "claude-sonnet-4-6"
api_key_env = "ANTHROPIC_API_KEY"   # 从环境变量读取
# api_key = "sk-ant-..."            # 或直接填写（不推荐）

[provider.ollama]
model = "qwen3:8b"
base_url = "http://localhost:11434/v1"
thinking = true           # 启用推理块（<think>）
thinking_budget = 4096    # 最大推理 token 数
```

也可以在 UI 的**设置面板**中直接修改上述配置，无需手动编辑文件。

---

## 工作流程

OpenPlotAgent 将科研绘图拆解为四步标准流程：

```
① 发现数据  →  ② 清洗处理  →  ③ 编写代码  →  ④ 执行渲染
   inspect        transform       write plot.py    execute_python
   query_data     write_data      (matplotlib)     render_chart
```

### 典型使用场景

1. **新建项目** — 在 Dashboard 创建项目（关联期刊规范、视觉风格）
2. **上传数据** — 在 Experiment 面板上传原始数据文件（CSV、Excel、JSON 等）
3. **创建任务** — 为每张图创建独立 Task，保持关注点分离
4. **对话绘图** — 在 Chat 面板描述需求，Agent 自动完成数据探索、代码生成、图表渲染
5. **可视化调整** — 点击 SVG 元素修改颜色/文字，或切换整体配色方案
6. **导出发布** — 下载 SVG 或 PDF（PGF 格式，兼容 LaTeX）

---

## API 文档

后端启动后访问 [http://localhost:8000/docs](http://localhost:8000/docs) 查看完整 Swagger 文档。

### 主要接口概览

#### 项目管理
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/projects` | 创建项目 |
| `GET` | `/api/projects` | 列出所有项目 |

#### 实验管理
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/projects/{pid}/experiments` | 创建实验 |
| `POST` | `/api/projects/{pid}/experiments/{eid}/data` | 上传原始数据文件 |
| `GET` | `/api/projects/{pid}/experiments/{eid}/raw/{fname}/preview` | 预览数据（前 200 行） |

#### 任务与图表
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/projects/{pid}/experiments/{eid}/tasks` | 创建任务 |
| `GET` | `/api/projects/{pid}/experiments/{eid}/tasks/{tid}/chart/svg` | 获取当前 SVG |
| `POST` | `/api/projects/{pid}/experiments/{eid}/tasks/{tid}/render` | 重新渲染图表 |
| `GET` | `/api/projects/{pid}/experiments/{eid}/tasks/{tid}/chart/export-pdf` | 导出 PDF |

#### Git 操作
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/projects/{pid}/git/log` | 查看提交历史 |
| `POST` | `/api/projects/{pid}/experiments/{eid}/tasks/{tid}/git/restore` | 回退文件到指定提交 |

#### Agent 实时对话
| 协议 | 路径 | 说明 |
|------|------|------|
| `WebSocket` | `/ws/{pid}/{eid}/{tid}?provider={name}` | 流式 Agent 对话 |

#### 系统设置
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/settings` | 获取当前配置 |
| `POST` | `/api/settings` | 更新配置 |
| `GET` | `/health` | 健康检查 |

---

## 数据存储结构

所有数据存储在本地 `~/open-plot-agent/` 目录下：

```
~/open-plot-agent/
├── config.toml                             # 全局配置
└── projects/
    └── {project_id}/                       # 项目根目录
        ├── .git/                           # Git 仓库
        ├── .venv/                          # 独立 Python 虚拟环境
        ├── PROJECT.md                      # 项目记忆（期刊规范、视觉约定）
        └── experiments/
            └── {experiment_id}/
                ├── EXPERIMENT.md           # 实验记忆（数据来源、采集说明）
                ├── raw/                    # 原始数据文件
                └── tasks/
                    └── {task_id}/
                        ├── TASK.md         # 任务记忆（决策历史）
                        ├── processed/
                        │   └── data.csv    # 清洗后的数据（Agent 直接读取）
                        ├── chart/
                        │   ├── plot.py     # 生成的 Matplotlib 代码
                        │   └── output.svg  # 渲染输出
                        └── conversations/  # 对话记录（JSON）
```

---

## Agent 工具列表

Agent 具备以下 14 个工具：

### 数据处理工具
| 工具 | 说明 |
|------|------|
| `inspect_data` | 预览文件结构、列名、数据类型、统计摘要 |
| `query_data` | 按列/条件筛选数据，支持限制返回行数 |
| `transform_data` | 12+ 种转换操作（前向填充、转置、透视、融合、重命名、删除列、数值转换等） |
| `write_data` | 将处理后的数据保存为 CSV |
| `read_file` | 读取任意任务文件内容 |
| `write_file` | 写入文件内容 |
| `list_files` | 列出目录中的文件 |
| `export_from_experiment` | 将实验级原始数据复制到任务级 |

### 图表生成工具
| 工具 | 说明 |
|------|------|
| `execute_python` | 在项目沙盒中执行 Python 代码（30s 超时） |
| `render_chart` | 重新运行 `plot.py` 并返回 SVG |
| `install_package` | 动态安装 pip 包到项目虚拟环境 |

### Git 版本控制工具
| 工具 | 说明 |
|------|------|
| `git_log` | 查看提交历史记录 |
| `git_diff` | 对比两个版本的差异 |
| `git_restore` | 将文件回退到指定提交版本 |

---

## 设计理念

OpenPlotAgent 遵循以下核心设计原则：

- **接口密度是特性** — 紧凑的信息密度，无动画、无插图，专注于精确操作
- **Git 作为基础设施** — 版本控制不是可选项，而是工作流的核心组成
- **可切换的 AI 后端** — 不绑定特定 LLM，支持在 Claude 和本地模型间自由切换
- **记忆随项目积累** — Agent 在三个层级（全局/项目/任务）积累偏好，越用越懂你

