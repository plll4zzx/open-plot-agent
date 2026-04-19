# OpenPlotAgent 升级方案

> 基于 LIDA / Data Formulator / MatPlotAgent / PlotGen / SVG-Edit 的设计经验
> 制定日期：2026-04-19
> 最近更新：2026-04-19（tools 重构为分类子包 + SVG 双击编辑文本/坐标轴范围）

---

## 进度总览（2026-04-19）

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 · 稳定核心体验 | ✅ 100% | Ollama 稳定性 + 数据摘要 + 上下文压缩全部完成 |
| Phase 2 · 视觉反馈循环 | ✅ 100% | 确定性检查 + Anthropic 多模态 visual 全部完成 |
| Phase 3 · 交互编辑增强 | ✅ 100% | 颜色/文字/字号/线宽 + 混合模式 + 图例拖拽 + 坐标轴范围 UI + SVG 文字双击直接编辑全部完成 |
| Phase 4 · 数据探索与分支 | 🟡 67% | Data Threads 分支 + 图表推荐已做，缺 DuckDB |
| Phase 5 · 高级功能 | 🟡 67% | 记忆系统（4 层）+ 模板市场已做，缺多 Agent 协作 |
| 工程重构 | ✅ 完成 | tools 按类别分包（file/data/chart/env/git_ops/memory），新增 `@register_tool` 自动发现 |

总体完成度 ≈ **90%**（按优先级矩阵加权，P0/P1/P2 全部完成，P3 只剩 DuckDB 和多 Agent）。

---

## 一、定位差异化

现有项目各做了一部分，但没有谁把这四块串在一起：

| 能力 | LIDA | Data Formulator | MatPlotAgent | PlotGen | SVG-Edit | **OpenPlotAgent** |
|------|------|-----------------|--------------|---------|----------|-------------------|
| 数据摘要/探索 | ✅ Summarizer | ✅ DuckDB+SQL | ❌ | ❌ | ❌ | ✅ summarize_data |
| AI 代码生成 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 视觉反馈验证 | ❌ | ❌ | ✅ 多模态 | ✅ 三路反馈 | ❌ | ✅ 确定性+多模态 |
| 交互式图形编辑 | ❌ | ✅ UI拖拽 | ❌ | ❌ | ✅ 完整编辑器 | ✅ 大部分 |
| 版本控制/回溯 | ❌ | ✅ Data Threads | ❌ | ❌ | ❌ | ✅ git + fork |
| 学术图表专用 | ❌ 通用 | ❌ 通用 | ✅ | ✅ | ❌ | ✅ |
| 本地运行 | ❌ 需API | ✅ | ❌ 需API | ❌ 需API | ✅ | ✅ |

**OpenPlotAgent 的独特价值 = 学术专用 + 本地运行 + 四合一（数据→代码→编辑→版本）**

---

## 二、升级路线图（按优先级排序）

### Phase 1 · 稳定核心体验（1-2 周）— ✅ 已完成

目标：让现有功能真正可用，修复阻碍日常使用的问题。

#### 1.1 Ollama 稳定性 — ✅ 已完成
- [x] 添加 max_tokens 限制，防止无限生成
- [x] 处理 Qwen3 `<think>` 标签的流式传输
- [x] 支持 thinking_budget 配置
- [x] 支持 /nothink 关闭思考模式

#### 1.2 数据摘要优化（借鉴 LIDA Summarizer）— ✅ 已完成

- [x] 新增 `summarize_data` 工具（`backend/agent/tools/summarize_data.py`）
- [x] 输出紧凑自然语言摘要（行列数、数值列范围、分类列分布、缺失情况、分组建议）
- [x] loop.py 的 system prompt 已把 summarize_data 设为首选探索工具
- [x] inspect_data 保留给需要精确列信息的场景

#### 1.3 上下文压缩（解决长对话崩溃）— ✅ 已完成

- [x] `backend/agent/context_compressor.py` 实现 `maybe_compress()`
- [x] 阈值 `TOKEN_THRESHOLD=12000`，`KEEP_RECENT=6`
- [x] 用 LLM 自己做摘要，作为 system message 注入
- [x] 摘要同时写入 TASK.md 作为持久记忆
- [x] loop.py 在每个 turn 开始前调用 maybe_compress

---

### Phase 2 · 视觉反馈循环（2-3 周）— ✅ 已完成

这是 MatPlotAgent 和 PlotGen 最核心的创新。

#### 2.1 自动视觉验证（借鉴 MatPlotAgent）— ✅ 已完成

- [x] `backend/agent/chart_validator.py` 提供 `validate_chart(svg_path, data_path)`
- [x] loop.py 在 execute_python / render_chart 成功后自动调用
- [x] 问题以 `context_notice` 事件推送给前端
- [x] 并作为 `_validation` 字段注入工具结果，让 agent 自修复
- [x] **新增**：Anthropic provider 支持多模态 visual 检查（`validate_chart_visual()`），用 Claude 看渲染后的图，检查标签覆盖、颜色对比、数据合理性等主观维度
- [x] **新增**：配置 `visual_feedback: true/false` 开关（config.toml `[validation]` 段）
- [x] **新增**：最多重试 2 次，避免无限循环

#### 2.2 三路反馈（借鉴 PlotGen）— ✅ 已完成

| 反馈类型 | 检查内容 | 方法 | 状态 |
|----------|----------|------|------|
| Lexical | title / xlabel / ylabel / 空文本 | `_check_labels` 解析 SVG | ✅ |
| Structural | SVG 有无尺寸、有无可视元素、有无 data gid | 解析 SVG | ✅ |
| Numeric | bar 数量 vs CSV 行数 × 数值列 | `_numeric_spot_check` | ✅ |
| Visual | 标签覆盖、色盲友好、图例清晰 | Anthropic 多模态 LLM | ✅ |

---

### Phase 3 · 交互编辑增强（3-4 周）— 🟡 70%

#### 3.1 直接编辑增强（借鉴 SVG-Edit + Data Formulator）

- [x] **颜色编辑** — 预设 12 种快速色 + 取色器 + hex 输入，即时预览
- [x] **文字编辑** — title / xlabel / ylabel / annotation 直接改
- [x] **字号滑块** — 6-32pt，即时预览，**松手自动保存**（UX 升级）
- [x] **线宽滑块** — 0.5-8px，即时预览，**松手自动保存**（UX 升级）
- [x] **CodePatcher 回写 plot.py** — 所有直接编辑都走确定性 regex patch，不经 LLM
- [x] **git 自动 commit** — 每次 patch 都产生一个版本
- [x] **拖拽图例位置** — SvgPreview 直接按住图例拖动，松开自动写入 `bbox_to_anchor=(x,y), bbox_transform=fig.transFigure` 到 plot.py。失败自动回退 DOM 位置
- [x] **坐标轴范围 UI 入口** — 双击 x/y 轴弹出内联 min/max 输入框，确认后 POST `xlim`/`ylim` patch；后端 gid_fixer 给 `matplotlib.axis_1/2` 打上 `xaxis`/`yaxis` 语义 gid
- [x] **文字双击直接编辑** — 双击 title/xlabel/ylabel/annotation_* 在原位渲染输入框（HTML overlay 而非 foreignObject，避免 SVG/HTML 字体不一致），Enter/blur 提交，Esc 取消

#### 3.2 混合 UI+NL 模式（借鉴 Data Formulator）— ✅ 已完成

- [x] ElementEditor 底部有 `AgentPromptBox`
- [x] 自动拼上下文提示（`[上下文: 已选中 bar_3，当前颜色 #E69F00] 用户输入`）
- [x] 发送到 ChatPanel 触发 agent

---

### Phase 4 · 数据探索与分支（4-6 周）— 🟡 67%

#### 4.1 Data Threads（借鉴 Data Formulator）— ✅ 已完成

- [x] 每个 git commit 就是一个节点（已有）
- [x] 时间轴 UI（已有）
- [x] **新增**：`POST /api/projects/{pid}/experiments/{eid}/tasks/{tid}/fork-from-commit` 接口 —— 从任意 commit 创建分支 task，复制该 commit 快照到新 task
- [x] **新增**：ExperimentPanel 时间轴节点支持"从此版本分支出新 Task"按钮

#### 4.2 Smart Data Profiling — ✅ 已完成

- [x] **新增** `recommend_charts` 工具（`backend/agent/tools/recommend_charts.py`）
- [x] 基于列结构（分类列数、数值列数、时间列）自动推荐 2-3 种合适图表
- [x] 返回每个推荐的理由和对应的 template id，用户可一键触发

```
"你的数据包含 3 个分类变量和 2 个数值变量，建议：
 1. 分组柱状图 — 比较不同处理组的均值差异
 2. 箱线图 — 展示各组数据分布
 3. 热力图 — 展示变量间相关性"
```

#### 4.3 大数据支持（借鉴 Data Formulator v0.2）— ❌ 未完成

- [ ] 超 10MB CSV 自动导入 DuckDB
- [ ] query_data 底层用 SQL
- [ ] 前端表格虚拟滚动

（优先级 P3，暂缓。现有 pandas 方案在 100MB 以下足够用）

---

### Phase 5 · 高级功能（6-8 周）— 🟡 67%

#### 5.1 记忆系统 — ✅ 已完成

四层记忆结构：

```
GLOBAL.md    — 跨项目偏好（"我的论文图统一用 Okabe-Ito 配色"）  [新增]
PROJECT.md   — 项目级约束（"Nature 要求单栏图宽 89mm"）        [已有]
EXPERIMENT.md — 实验级背景                                      [已有]
TASK.md      — 任务级历史                                       [已有]
```

- [x] PROJECT.md、EXPERIMENT.md、TASK.md 三层已存在
- [x] MemoryPanel 前端面板（可编辑 TASK / EXPERIMENT）
- [x] Context Compressor 自动把对话摘要写入 TASK.md
- [x] **新增**：GLOBAL.md 层（`~/open-plot-agent/GLOBAL.md`）
- [x] **新增**：`memory_read(scope)` / `memory_write(scope, content, mode)` 工具供 agent 使用
- [x] **新增**：MemoryPanel 增加 Global 标签页

#### 5.2 多 Agent 协作（借鉴 PlotGen）— ❌ 未完成

- [ ] Planning Agent → Code Agent → Validator Agent 链式调用
- [ ] Anthropic 可用不同模型（Haiku 规划 / Sonnet 编码）

（优先级 P3，暂缓。当前单 agent + chart_validator 自修复环路已覆盖 80% 场景）

#### 5.3 模板市场 — ✅ 已完成

- [x] 8 种学术图表模板（分组柱/折线/热力/箱线/散点/小提琴/堆叠柱/环形图）
- [x] 4 种期刊规范预设（Nature / Cell / Science / IEEE）
- [x] 一键触发 agent 生成对应图表
- [ ] 用户自定义模板保存（未实现）

### Phase 6 sandbox 里常驻一个 tool-server 进程

每个项目启动时 spin up 一个长连接 Python worker（unix socket 或 zmq）
后端把 tool call 转发过去，worker 里直接 import pandas 跑
消除了 spawn 开销，代价是要管理 worker 生命周期（何时重启、何时淘汰）
已有 install_package 改动时，向 worker 发 signal 让它重 import

---

## 三、实现优先级矩阵（更新后）

| 功能 | 影响 | 难度 | 优先级 | 状态 |
|------|------|------|--------|------|
| Ollama max_tokens 修复 | 🔴 高 | 🟢 低 | P0 | ✅ 完成 |
| 上下文压缩 | 🔴 高 | 🟡 中 | P1 | ✅ 完成 |
| 数据摘要工具 | 🟡 中 | 🟢 低 | P1 | ✅ 完成 |
| 视觉反馈（确定性） | 🔴 高 | 🟡 中 | P1 | ✅ 完成 |
| 视觉反馈（多模态） | 🟡 中 | 🟡 中 | P1 | ✅ 完成 |
| 文字/颜色/字号编辑 | 🟡 中 | 🟡 中 | P2 | ✅ 完成 |
| 混合 UI+NL 模式 | 🟡 中 | 🟢 低 | P2 | ✅ 完成 |
| Data Threads 分支 | 🟡 中 | 🟡 中 | P2 | ✅ 完成 |
| 图表推荐 | 🟡 中 | 🟢 低 | P2 | ✅ 完成 |
| 记忆系统（4 层 + 工具）| 🟡 中 | 🟡 中 | P2 | ✅ 完成 |
| 模板市场 | 🟡 中 | 🟡 中 | P2 | ✅ 完成 |
| 拖拽图例 | 🟡 中 | 🔴 高 | P3 | ✅ 完成 |
| DuckDB 大数据 | 🟢 低 | 🟡 中 | P3 | ❌ 未完成 |
| 多 Agent 协作 | 🟡 中 | 🔴 高 | P3 | ❌ 未完成 |

---

## 四、技术债清理（贯穿全程）

1. **tools 模块化** — ✅ 已完成。tools/ 按类别拆为 `file/`、`data/`、`chart/`、`env/`、`git_ops/`、`memory/` 子包，新增 `@register_tool` 装饰器与 `pkgutil` 自动发现。新增工具只需在合适的子包里建文件、加装饰器即可
2. **tools.py 兼容 shim** — 已经有了 shim 文件，但要确保所有导入路径都用新路径，然后删除 shim
3. **前端组件拆分** — App.jsx 过大（所有 modal 和逻辑都在里面），需要拆分
4. **错误处理** — 目前很多 try/except 只是 pass，需要统一错误上报
5. **类型标注** — 后端 Python 代码类型标注不完整，加上 mypy 检查
6. **测试** — 目前零测试，至少需要核心工具的单元测试
7. **WebSocket 重连** — 前端 WS 断连后无自动重连机制

---

## 五、参考项目链接

| 项目 | Stars | 核心借鉴点 |
|------|-------|-----------|
| [Microsoft LIDA](https://github.com/microsoft/lida) | ~3.2k | Summarizer 模块、Self-evaluation |
| [Microsoft Data Formulator](https://github.com/microsoft/data-formulator) | - | 混合 UI+NL、Data Threads、DuckDB |
| [MatPlotAgent](https://github.com/thunlp/MatPlotAgent) | ~100+ | 多模态视觉反馈循环 |
| [PlotGen](https://arxiv.org/abs/2502.00988) | 论文 | 三路反馈（Numeric/Lexical/Visual） |
| [SVG-Edit](https://github.com/svgedit/svgedit) | ~6k+ | SVG 元素编辑交互设计 |
| [Chat2Plot](https://github.com/nyanp/chat2plot) | - | 声明式图表规范（JSON→Chart） |
