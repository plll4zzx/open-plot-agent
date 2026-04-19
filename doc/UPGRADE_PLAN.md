# OpenPlotAgent 升级方案

> 基于 LIDA / Data Formulator / MatPlotAgent / PlotGen / SVG-Edit 的设计经验
> 制定日期：2026-04-19

---

## 一、定位差异化

现有项目各做了一部分，但没有谁把这四块串在一起：

| 能力 | LIDA | Data Formulator | MatPlotAgent | PlotGen | SVG-Edit | **OpenPlotAgent** |
|------|------|-----------------|--------------|---------|----------|-------------------|
| 数据摘要/探索 | ✅ Summarizer | ✅ DuckDB+SQL | ❌ | ❌ | ❌ | 🔨 inspect_data |
| AI 代码生成 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 视觉反馈验证 | ❌ | ❌ | ✅ 多模态 | ✅ 三路反馈 | ❌ | ❌ **待加** |
| 交互式图形编辑 | ❌ | ✅ UI拖拽 | ❌ | ❌ | ✅ 完整编辑器 | 🔨 部分 |
| 版本控制/回溯 | ❌ | ✅ Data Threads | ❌ | ❌ | ❌ | ✅ git |
| 学术图表专用 | ❌ 通用 | ❌ 通用 | ✅ | ✅ | ❌ | ✅ |
| 本地运行 | ❌ 需API | ✅ | ❌ 需API | ❌ 需API | ✅ | ✅ |

**OpenPlotAgent 的独特价值 = 学术专用 + 本地运行 + 四合一（数据→代码→编辑→版本）**

---

## 二、升级路线图（按优先级排序）

### Phase 1 · 稳定核心体验（1-2 周）

目标：让现有功能真正可用，修复阻碍日常使用的问题。

#### 1.1 Ollama 稳定性（已完成 ✅）
- [x] 添加 max_tokens 限制，防止无限生成
- [x] 处理 Qwen3 `<think>` 标签的流式传输
- [x] 支持 thinking_budget 配置
- [x] 支持 /nothink 关闭思考模式

#### 1.2 数据摘要优化（借鉴 LIDA Summarizer）

**现状**：inspect_data 返回列信息和统计值，但格式是 JSON。
**改进**：加一个 `summarize_data` 工具，生成自然语言数据摘要。

```
输入：processed/data.csv
输出：
  "This dataset contains 150 rows × 6 columns, representing experimental
   measurements across 3 treatment groups (Control, Drug A, Drug B).
   Key numeric columns: response_time (mean=2.3s, std=0.8), accuracy
   (mean=87.2%, range 45-100%). The data is balanced across groups
   (~50 rows each). No missing values detected."
```

LIDA 的经验是：**紧凑的自然语言摘要比结构化 JSON 更节省 token 且更容易被 LLM 理解**。我们保留 inspect_data 的结构化输出给需要精确信息的场景，加 summarize_data 给初始探索阶段。

#### 1.3 上下文压缩（解决长对话崩溃）

**方案**：
- 当 history 超过 N 条（如 20 条）或 token 估算超阈值时，触发压缩
- 将旧对话摘要为一段文字，作为 system message 注入
- 保留最近 4-6 轮完整对话
- 摘要同时写入 TASK.md 作为持久记忆

```python
class ContextCompressor:
    """对话摘要压缩器"""
    THRESHOLD = 16000  # estimated tokens
    KEEP_RECENT = 6    # keep last N messages intact

    async def compress(self, history: list[dict], provider: LLMProvider) -> list[dict]:
        old = history[:-self.KEEP_RECENT]
        recent = history[-self.KEEP_RECENT:]
        summary = await provider.summarize(old)  # 用 LLM 自己做摘要
        return [{"role": "system", "content": f"[对话历史摘要]\n{summary}"}] + recent
```

---

### Phase 2 · 视觉反馈循环（2-3 周）

这是 MatPlotAgent 和 PlotGen 最核心的创新，也是 OpenPlotAgent 目前最缺的。

#### 2.1 自动视觉验证（借鉴 MatPlotAgent）

**思路**：Agent 生成 SVG 后，自动截图/编码，用多模态能力（或专门的验证 prompt）检查。

```
生成 plot.py → 执行 → 得到 output.svg
                         ↓
                   视觉验证 Agent
                   "检查这张图：
                    1. 数据是否正确反映了 CSV 中的值？
                    2. 标签是否完整？
                    3. 配色是否区分度足够？
                    4. 是否符合学术图表规范？"
                         ↓
                   通过 → 完成
                   不通过 → 反馈给主 Agent → 修复 → 重新验证
```

**实现要点**：
- Anthropic Claude 原生支持图片输入，可以直接发 SVG 渲染后的截图
- Ollama 本地模型需要用多模态模型（如 llava、qwen-vl）
- 验证最多重试 2 次，避免无限循环
- 这个验证步骤可配置开关（`visual_feedback: true/false`）

#### 2.2 三路反馈（借鉴 PlotGen，可选高级功能）

PlotGen 把反馈分成三路，比 MatPlotAgent 更精细：

| 反馈类型 | 检查内容 | 方法 |
|----------|----------|------|
| Numeric Feedback | 图中数值是否与数据一致 | 用代码检查：提取 bar heights/line values，对比 CSV |
| Lexical Feedback | 标签、标题、图例文字是否正确 | 解析 SVG 中的 text 元素，对比预期 |
| Visual Feedback | 整体视觉效果 | 多模态 LLM 看图 |

**我们的简化版**：前两个可以用确定性代码做（更快更准），第三个才需要 LLM。

```python
class ChartValidator:
    async def validate(self, svg_path, data_path, plot_py_path):
        errors = []
        # 1. Numeric: 解析 SVG gid 元素的值，对比 CSV
        errors += self._check_numeric(svg_path, data_path)
        # 2. Lexical: 检查 title/xlabel/ylabel 是否存在且非空
        errors += self._check_labels(svg_path)
        # 3. Visual: 可选，用多模态 LLM
        if self.visual_feedback_enabled:
            errors += await self._check_visual(svg_path)
        return errors
```

---

### Phase 3 · 交互编辑增强（3-4 周）

#### 3.1 直接编辑增强（借鉴 SVG-Edit + Data Formulator）

**当前**：只有颜色编辑是直接操作 DOM。
**目标**：更多属性可以直接编辑，不需要走 agent。

优先实现：
1. **文字双击编辑** — 双击 SVG text 元素直接改内容，保存时更新 plot.py
2. **拖拽图例位置** — 拖动 legend 组元素，计算 matplotlib 坐标，写回 plot.py
3. **坐标轴范围** — 双击坐标轴弹出输入框，设置 xlim/ylim
4. **字号调节** — 滑块调节选中元素的 font-size

**关键设计（从 SVG-Edit 学到的）**：
- 所有直接编辑先作用于 DOM（即时反馈）
- 同时记录到 pending_edits（已有机制）
- 下次 agent turn 时统一同步到 plot.py
- 或者提供"一键同步"按钮，批量将 DOM 编辑写回代码

#### 3.2 混合 UI+NL 模式（借鉴 Data Formulator）

Data Formulator 的核心创新是用户可以用 UI 操作和自然语言混合表达意图。我们可以借鉴：

**场景**：用户选中一个柱子 → 右侧面板不仅显示颜色编辑，还显示一个"向 Agent 描述"输入框，预填上下文：

```
"我选中了 bar_3（对应 Drug B 组），当前颜色是 #E69F00。
 我想要：[用户输入的自然语言]"
```

这样 agent 有了精确的上下文（哪个元素、当前状态），用户只需要说"加个误差线"或"改成渐变色"就行，不需要描述"第三个柱子"。

---

### Phase 4 · 数据探索与分支（4-6 周）

#### 4.1 Data Threads（借鉴 Data Formulator）

Data Formulator 的 Data Threads 设计很值得参考：每次操作形成一个节点，用户可以从任意节点分支出新的探索方向。

在 OpenPlotAgent 中的实现：
- 每个 git commit 就是一个节点
- 时间轴已经有了（前端已实现）
- 需要加的是：**从任意 commit 创建分支 task**
- UI：在时间轴节点上右键 → "从此版本创建新 Task"

```
commit_1 → commit_2 → commit_3 → commit_4 (当前)
                ↓
            fork: Task "Fig.2-方案B"
            commit_2' → commit_3'
```

#### 4.2 Smart Data Profiling

LIDA 的 Goal Explorer 自动枚举可视化目标，我们可以做一个轻量版：

当用户上传新数据时，自动运行：
1. `inspect_data` 获取结构
2. `summarize_data` 获取摘要
3. 基于数据特征，**自动推荐 2-3 种适合的图表类型**

```
"你的数据包含 3 个分类变量和 2 个数值变量，建议：
 1. 分组柱状图 — 比较不同处理组的均值差异
 2. 箱线图 — 展示各组数据分布
 3. 热力图 — 展示变量间相关性"
```

用户点击推荐项，直接开始生成。

#### 4.3 大数据支持（借鉴 Data Formulator v0.2）

Data Formulator v0.2 用 DuckDB 处理大数据。我们可以：
- 当 CSV 超过 10MB 时，自动导入 DuckDB
- Agent 的 query_data 工具底层用 SQL 而不是 pandas（更快更省内存）
- 前端表格显示虚拟滚动（只渲染可见行）

---

### Phase 5 · 高级功能（6-8 周）

#### 5.1 记忆系统

```
层级：
  GLOBAL.md   — 跨项目偏好（"我的论文图统一用 Okabe-Ito 配色"）
  PROJECT.md  — 项目级约束（"Nature 要求单栏图宽 89mm，双栏 183mm"）
  TASK.md     — 任务级历史（"reviewer 说要加 p-value 标注"）

Agent 工具：
  memory_read(scope, query?)  — 读取指定层级的记忆
  memory_write(scope, content) — 更新记忆
  memory_search(query)        — 跨层级搜索相关记忆
```

#### 5.2 多 Agent 协作（借鉴 PlotGen）

PlotGen 用多 agent 分工，我们可以在后端实现 agent 链：

```
User Message
    ↓
Planning Agent → "需要做：1.清洗数据 2.画分组柱状图 3.加误差线"
    ↓
Code Agent → 生成 plot.py
    ↓
Validator Agent → 检查数值 + 标签 + 视觉
    ↓
[如果失败] → 返回 Code Agent 修复
    ↓
[如果通过] → 返回结果给用户
```

对于 Ollama 本地模型，可以用同一个模型扮演不同角色（通过不同 system prompt）。
对于 Anthropic API，可以用不同模型（planning 用 Haiku 省钱，coding 用 Sonnet）。

#### 5.3 模板市场

学术图表有很多固定模式（生存曲线、火山图、热力图、PCA 散点图等），我们可以：
- 内置 20+ 学术图表模板
- 每个模板包含 plot.py 骨架 + 示例数据 + 缩略图
- 用户选择模板后，agent 基于模板修改以适配用户数据
- 支持用户保存自己的模板

---

## 三、实现优先级矩阵

| 功能 | 影响 | 难度 | 优先级 |
|------|------|------|--------|
| Ollama max_tokens 修复 | 🔴 高 | 🟢 低 | **P0 已完成** |
| 上下文压缩 | 🔴 高 | 🟡 中 | **P1** |
| 数据摘要工具 | 🟡 中 | 🟢 低 | **P1** |
| 视觉反馈（基础版） | 🔴 高 | 🟡 中 | **P1** |
| 文字双击编辑 | 🟡 中 | 🟡 中 | **P2** |
| 拖拽图例 | 🟡 中 | 🔴 高 | **P3** |
| Data Threads 分支 | 🟡 中 | 🟡 中 | **P2** |
| 图表推荐 | 🟡 中 | 🟢 低 | **P2** |
| 记忆系统 | 🟡 中 | 🟡 中 | **P2** |
| DuckDB 大数据 | 🟢 低 | 🟡 中 | **P3** |
| 多 Agent 协作 | 🟡 中 | 🔴 高 | **P3** |
| 模板市场 | 🟡 中 | 🟡 中 | **P3** |

---

## 四、技术债清理（贯穿全程）

1. **tools.py 兼容 shim** — 已经有了 shim 文件，但要确保所有导入路径都用新路径，然后删除 shim
2. **前端组件拆分** — App.jsx 过大（所有 modal 和逻辑都在里面），需要拆分
3. **错误处理** — 目前很多 try/except 只是 pass，需要统一错误上报
4. **类型标注** — 后端 Python 代码类型标注不完整，加上 mypy 检查
5. **测试** — 目前零测试，至少需要核心工具的单元测试
6. **WebSocket 重连** — 前端 WS 断连后无自动重连机制

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
