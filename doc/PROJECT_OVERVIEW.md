# OpenPlotAgent · 项目概览

> 最后更新：2026-04-19

---

## 一、项目动机

学术论文的图表制作是一个繁琐且高度迭代的过程：实验数据结构复杂、期刊格式要求严苛、改图需求反复出现（reviewer 意见、合作者建议、数据更新）。现有工具要么太通用（Excel、Python 脚本），要么太专有（Prism、Origin），要么不支持版本追踪。

**OpenPlotAgent 的出发点**：给论文作者一个**本地运行的 AI 图表工作站**，让 LLM 承担绝大部分代码生成与修改工作，同时对每一次改动自动留下 git 记录，使图表制作像 Overleaf 写作一样可回溯、可复现。

---

## 二、设计目标

| 目标 | 说明 |
|------|------|
| **AI 驱动** | 用自然语言描述需求，agent 生成/修改 matplotlib 代码并执行，用户无需手写代码 |
| **投稿级输出** | 默认支持 SVG/PDF 输出，遵循 Nature/Cell 等期刊尺寸规范，支持 LaTeX 公式 |
| **全程可追溯** | 代码、数据、对话均进 git，每次改动自动提交，可随时回滚任意版本 |
| **端到端工作流** | 从实验 raw data 到最终投稿图，在同一工具内完成，不需要跳出到其他软件 |
| **可扩展** | LLM provider 可插拔（Ollama / Anthropic API）；工具集可插件化 |
| **human in loop** | 可以人工干预，包括手动修改画图代码，图形界面编辑图表中的每一个元素，比如图片的标题，图注，每个元素的配色，字体大小，柱状图宽度，支持表格中的数据修改后实时渲染到图片 |

---

## 三、核心概念

### 3.1 层级结构

```
Project（一篇论文 / 一个研究课题）
  ├── .venv/               独立 Python 环境（uv 管理）
  ├── .git/                项目级 git 仓库
  ├── _shared/             跨 experiment 复用的样式、依赖
  └── experiments/
       └── Experiment（一组相关实验，如"对照组 vs 实验组"）
            ├── EXPERIMENT.md    实验背景记录
            ├── raw/             原始实验数据（各种格式，主要是jsonl，可以吧jsonl按照表格的格式查看和编辑，选中的行和列可以导出到指定的task）
            └── tasks/
                 └── Task（一个具体的图表任务，如"Fig.2 时间演化"）
                      ├── TASK.md          任务记忆与决策轨迹
                      ├── processed/       画图用表格（processed/data.csv）
                      ├── chart/           plot.py + output.svg/pdf
                      ├── conversations/   对话记录
                      └── .plotsmith/      agent 内部状态（context.json）
```

- **Project** 对应一篇论文，共享一个 Python venv 和一个 git repo
- **Experiment** 对应一组实验条件，共享 raw 数据
- **Task** 对应一张图，维护独立的 processed 数据和 plot.py

### 3.2 数据流

```
实验设备 / 脚本
    │
    ▼  上传 / 粘贴 / API ingest
  raw/                ← 原始实验数据，格式不限
    │
    ▼  pipeline.py（agent 生成或手写）
  processed/data.csv  ← 规整的画图用表格
    │
    ▼  plot.py（agent 生成，用户可迭代）
  chart/output.svg    ← 最终 SVG 图表
    │
    ▼  PDF 导出
  chart/output.pdf    ← 投稿用 PDF
```

---

## 四、计划实现的功能

### 4.1 已规划的完整功能集

**项目管理**
- 创建/切换项目，支持从已有项目复制样式和模板
- 每个项目独立的 uv venv，agent 可动态安装依赖
- 项目级记忆（PROJECT.md），记录期刊要求、配色偏好、历史决策

**数据管理**
- 粘贴表格（Excel/Numbers 复制）、上传文件、API 实时数据流入（Ingest API）
- 可视化表格编辑（单元格、转置、合并表头）
- Pipeline 脚本（raw → processed 的自动化变换）
- 手动编辑表格时打 "manual override" 标记，防止 pipeline 重跑意外覆盖

**Agent 核心**
- 支持 Ollama（本地 LLM）和 Anthropic API（Claude）两种 provider，可在设置中切换
- 工具集：`list_files, read_file, write_file, execute_python, install_package, render_chart`
- 流式输出，支持 `<think>` 标签折叠展示推理过程
- 每轮结束后自动 git commit（防抖 1.2s）
- 可配置最大工具轮次，超出轮次给出明确提示
- 对话按 task 维护独立 session，切换 task 后可恢复历史对话

**图表编辑**
- 预览区 SVG 元素点击高亮（所有元素强制设 semantic gid）
- 元素编辑面板：柱/线颜色即时修改（DOM 直接操作），文字内容通过 agent 修改
- 配色方案一键切换（DOMParser 直接改 SVG，无需 agent），支持保存自定义调色板
- PDF 导出（指定文件名，后端重渲染输出）
- Script 标签页：查看 agent 生成的 plot.py，手动点击运行

**版本管理**
- 预览区下方显示 git commit 历史时间轴
- 历史面板（History 标签）显示完整 commit log

**设置**
- Ollama Base URL、模型名称、连接测试，是否使用thinking
- Anthropic API Key、模型选择
- 默认 Provider
- 最大工具轮次（4–40，滑块调节）

---

## 五、项目结构

```
open-plot-agent/
├── backend/
│   ├── main.py                  FastAPI 主程序，所有 REST 和 WebSocket 端点
│   ├── config.py                配置读写（~/open-plot-agent/config.toml）
│   ├── workspace_init.py        创建项目/实验/任务目录结构
│   ├── agent/
│   │   ├── loop.py              AgentLoop：单任务的对话状态机，驱动工具调用循环
│   │   ├── tools.py             工具实现（list_files / read_file / write_file / execute_python 等）
│   │   └── providers/
│   │       ├── base.py          LLMProvider 抽象接口
│   │       ├── anthropic_provider.py   Anthropic API 实现
│   │       └── ollama_provider.py      Ollama（OpenAI 兼容）实现
│   ├── sandbox/
│   │   ├── runner.py            SandboxRunner：管理 uv venv、执行 Python 代码、收集输出文件
│   │   └── gid_fixer.py         SVG 后处理：校验并补全 semantic gid
│   └── git_manager/
│       └── manager.py           GitManager：auto_commit、git_log
│
├── frontend/
│   └── src/
│       ├── App.jsx              主布局：Dashboard / WorkspaceView / 所有 Modal
│       ├── store/index.js       Zustand 全局状态（projects、tasks、svgContent、chatSessions 等）
│       ├── hooks/
│       │   └── useAgentChat.js  WebSocket 连接管理、消息状态、stop 函数
│       └── components/
│           ├── ChatPanel.jsx    对话面板（消息列表、think 折叠、工具调用展开、输入框）
│           ├── SvgPreview.jsx   SVG 预览，semantic gid hover/click 交互
│           ├── ElementEditor.jsx 元素属性编辑器（颜色即时生效，文字通过 agent 修改）
│           ├── PalettePanel.jsx 配色方案面板（直接操作 SVG，无需 agent）
│           ├── DataPanel.jsx    Processed 数据表格编辑 + Script 标签页（查看/运行 plot.py）
│           ├── ExperimentPanel.jsx  实验视图（选中 experiment 但未选 task 时显示）
│           └── SettingsModal.jsx    模型设置弹窗
│
├── DesignSystem/                UI 设计规范（色彩、字体、组件预览页）
├── REQUIREMENTS.md              完整功能需求文档（英文）
└── PROJECT_OVERVIEW.md          本文件
```

**数据目录**（运行时生成，在 `~/open-plot-agent/` 下）：
```
~/open-plot-agent/
├── config.toml          模型配置（provider、api key、max_tool_rounds 等）
└── projects/
     └── <project_id>/
          ├── .venv/
          ├── .git/
          ├── _shared/
          └── experiments/<exp_id>/tasks/<task_id>/...
```

---

## 六、技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 18 + Vite |
| 样式 | Tailwind CSS（内联 JIT） |
| 状态管理 | Zustand |
| 实时通信 | WebSocket（每个 task 一条连接） |
| 后端框架 | FastAPI + uvicorn |
| Python 环境管理 | uv（比 virtualenv 快 10x） |
| LLM 集成 | Anthropic SDK + Ollama OpenAI-compat API |
| 版本控制 | GitPython（自动 commit） |
| SVG 操作 | 浏览器原生 DOMParser / XMLSerializer |
| 字体 | Fraunces（标题衬线）+ JetBrains Mono（代码/数字） |

---

## 七、已实现的功能（当前进展）

### ✅ 完成

**后端**
- FastAPI 服务，REST + WebSocket 双通道
- 三级目录结构（Project / Experiment / Task）完整 CRUD
- SandboxRunner：uv venv 管理、Python 代码执行、SVG/PDF artifact 收集
- AgentLoop：工具调用状态机，支持 Anthropic 和 Ollama 两种消息格式，流式输出
- 工具集：`list_files, read_file, write_file, execute_python, install_package, render_chart`
- SVG gid_fixer：自动补全 semantic gid 后处理
- GitManager：防抖自动提交
- 配置系统（config.toml）：provider 设置、max_tool_rounds、API key 读写
- 端点：GET/POST 项目、实验、任务；WebSocket 对话；SVG 读取（不重渲染）；PDF 导出；Pipeline 运行；文件读取；Git log；Settings 读写；Demo 数据加载
- Demo（toy example）：自动生成带多级列头 CSV 的完整演示数据

**前端**
- Dashboard：项目卡片列表，新建项目，加载 Demo
- WorkspaceView：三列布局（Sidebar + Main + Right Panel），面板宽度可拖拽调节
- Sidebar：三级树形导航（Project → Experiment → Task），点击切换，hover 显示新建按钮
- TaskMainArea：三个标签页（Processed / Script / 预览），CSS-hidden 保持组件状态不丢失
- Processed 标签页：粘贴表格（Excel/Numbers/TSV/CSV），可编辑单元格，转置，保存到后端，切换 task 自动加载已有数据
- Script 标签页：显示 agent 生成的 plot.py，▶ 运行按钮，agent 生成新图后自动刷新
- 预览标签页：SVG 渲染，semantic gid hover 高亮（虚线框），下载 PDF（可自定义文件名）
- ChatPanel：流式对话，think 标签折叠，工具调用展开（input/output），Ollama/Anthropic 切换，可调大小的输入框，⌘↵ 发送，停止按钮
- ElementEditor：点击 SVG 元素打开，柱/线颜色即时生效（直接操作 DOM），"保存到 plot.py" 发送 agent 消息
- PalettePanel：5 种预设配色方案，直接操作 SVG 无需 agent，支持保存/删除自定义方案
- SettingsModal：Ollama 配置 + 连接测试 + 模型列表，Anthropic API key + 模型选择，max_tool_rounds 滑块
- 实验面板（ExperimentPanel）：点击 experiment 时显示简要信息
- New Experiment / New Task Modal：支持从已有 experiment/task 复制
- Per-task chat session 持久化：切换 task 后回到 chat 记录原样恢复
- Git 状态徽章（保存中 / 已保存），git commit 历史时间轴
- Toast 提示

### 🚧 部分实现 / 已知问题

| 问题 | 状态 | 说明 |
|------|------|------|
| SVG 文字直接编辑 | 部分 | 颜色已支持直接改；文字内容需通过 agent（matplotlib SVG 的 tspan 结构较复杂） |
| Pipeline 标签页 | 降级 | 原设计应显示 raw→processed 处理脚本，现已改为 Script（显示 plot.py）；独立 pipeline 功能待实现 |
| 实时数据 Ingest API | 未实现 | 需求文档中的 POST ingest 端点尚未开发 |
| 三级记忆系统 | 未实现 | GLOBAL.md / PROJECT.md / TASK.md 目录已创建，但 agent 尚未有 memory_read/write 工具 |
| 上下文压缩 | 未实现 | 长对话后 token 超限无优雅处理，仅依赖 LLM 自身的截断 |
| Git 版本对比 / 回滚 | 未实现 | History 面板仅展示 commit log，无法对比或恢复 |
| SVG 元素拖拽 | 未实现 | 需求文档中的拖图例、调整图例位置等功能未开发 |
| LaTeX 公式编辑器 | 未实现 | 双击文字元素弹出 LaTeX 编辑器尚未开发 |
| 图表尺寸拖拽 | 未实现 | 拖角调整 figsize 未开发 |
| "在 VSCode 打开" | 未实现 | code <path> 快捷出口未开发 |
| 项目导出打包 | 未实现 | zip 打包、清理 venv 后打包、全部 PDF 合并导出未开发 |
| 跨项目模板 | 未实现 | 创建项目时继承另一项目 _shared/ 样式的功能未开发 |
| API key 加密存储 | 未实现 | 当前直接存 config.toml 明文，macOS Keychain 集成未开发 |

---

## 八、典型使用场景

### 场景 A · 从零出一张论文图（当前可完整走通）

1. 点"加载 Demo"，自动生成带多级表头的示例数据并跳转到任务
2. 切到 Processed 标签页，看到已加载的 CSV 表格
3. 在右侧 PlotAgent 面板输入："帮我画一个分组柱状图，X 轴是处理方式，Y 轴是各组均值"
4. Agent 读取 processed/data.csv → 写 chart/plot.py → 执行 → 生成 output.svg
5. 预览标签页自动更新显示图表
6. 点击柱子 → 右侧切到"元素编辑"面板 → 颜色选择器即时改色
7. 点右侧"配色方案" → 一键切换 Okabe-Ito / Tab10 等调色板
8. 点"下载 PDF"，指定文件名，下载 PDF

### 场景 B · 多轮迭代修改

1. 在 ChatPanel 继续对话："把 Y 轴改成对数刻度，加上误差线"
2. Agent 修改 plot.py，重新执行，预览自动刷新
3. Script 标签页查看生成的完整代码，点 ▶ 运行按钮手动重跑
4. 任意时刻点"停止"按钮可中断正在生成的 agent 输出

### 场景 C · 多 task 管理（当前支持）

1. 在同一 experiment 下新建多个 task（如 Fig.2、Fig.3、Fig.4）
2. 每个 task 独立维护 processed 数据和 plot.py
3. 切换 task 时 chat 记录自动保存，切回时完整恢复
4. 新建 task 时可从已有 task 复制 processed 数据和 chart 脚本

---

## 九、当前主要待解决问题

### 技术层面

1. **SVG 文字直接编辑**：matplotlib 输出的 `<text>` 元素有时使用 `<tspan>` 嵌套，有时文字内容不在 textContent 里（尤其是带 LaTeX 公式的情况）。目前文字修改走 agent，体验不够流畅。**方向**：在 agent 生成 plot.py 时统一避免 PGF/LaTeX 字体，确保 SVG 输出是标准 `<text>` 元素，使前端可直接 mutate textContent。

2. **超长对话上下文**：当前无上下文压缩机制，对话越来越长后 LLM 性能下降或直接报错。**方向**：实现自动对话摘要，在 token 超过阈值时压缩旧对话写入 TASK.md。

3. **Agent 工具效率**：Ollama 本地模型（如 qwen）有时会选错路径、多余的工具调用轮次，导致超出 max_tool_rounds。**方向**：优化 system prompt，提供更多示例；对常见错误提供快速恢复路径。

4. **Pipeline 标签页**：原本设计用于展示 raw→processed 的数据处理脚本，现已降级为 Script（显示 plot.py）。raw 数据展示和 pipeline 编写功能还需独立实现。

### 产品层面

5. **Ingest API**：实验过程中实时推数据这个场景尚未实现，是区分本工具与普通画图工具的核心功能之一。

6. **版本对比与回滚**：git 基础设施已就绪，但 UI 层面只展示了 commit log，无法做两版图的并排对比，也无法一键恢复某个版本。这是 Overleaf 体验中用户最期待的功能。

7. **记忆系统**：TASK.md / PROJECT.md 目录已创建，但 agent 没有 memory_read/write 工具，无法自动记住用户偏好或历史决策。每次新 task 都需要重新告知。

8. **直接操作图表**：当前只有颜色编辑支持直接操作，拖拽图例位置、双击改坐标轴范围、LaTeX 公式编辑等更高级的直接操作尚未实现。

---

## 十、快速启动（开发模式）

```bash
# 后端
cd backend
uv run uvicorn main:app --reload --port 8000

# 前端
cd frontend
npm run dev   # 启动 Vite dev server，代理到 localhost:8000

# 浏览器访问
open http://localhost:5173
```

**依赖**：Python 3.11+，uv，Node.js 18+，（可选）Ollama

**配置**：首次运行后，在设置页面填写 Ollama 服务地址或 Anthropic API Key。配置保存到 `~/open-plot-agent/config.toml`。
