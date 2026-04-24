import { useStore } from './store'

export const DICT = {
  // Common
  loading:         { zh: '加载中…',   en: 'Loading…' },
  save:            { zh: '保存',       en: 'Save' },
  saving:          { zh: '保存中…',   en: 'Saving…' },
  saved:           { zh: '已保存',     en: 'Saved' },
  cancel:          { zh: '取消',       en: 'Cancel' },
  create:          { zh: '创建',       en: 'Create' },
  close:           { zh: '关闭',       en: 'Close' },
  restore:         { zh: '恢复',       en: 'Restore' },
  restoring:       { zh: '恢复中…',   en: 'Restoring…' },
  refresh:         { zh: '刷新',       en: 'Refresh' },
  uploadFile:      { zh: '上传文件',   en: 'Upload file' },
  newLabel:        { zh: '新建',       en: 'New' },
  on:              { zh: '开',         en: 'On' },
  off:             { zh: '关',         en: 'Off' },
  auto:            { zh: '自动',       en: 'Auto' },
  stop:            { zh: '停止',       en: 'Stop' },
  run:             { zh: '▶ 运行',     en: '▶ Run' },
  running:         { zh: '运行中…',   en: 'Running…' },
  noHistory:       { zh: '暂无历史记录', en: 'No history records' },
  reference:       { zh: '参考',       en: 'Reference' },
  addToChat:       { zh: '添加到对话框', en: 'Add to chat' },
  unsaved:         { zh: '● 未保存',   en: '● Unsaved' },
  backendError:    { zh: '无法连接到后端', en: 'Unable to connect to backend' },
  saveFailed:      { zh: '保存失败',   en: 'Save failed' },
  loadFailed:      { zh: '加载失败',   en: 'Load failed' },
  download:        { zh: '下载',       en: 'Download' },

  // Language
  language:        { zh: '语言',   en: 'Language' },
  langZh:          { zh: '中文',   en: '中文' },
  langEn:          { zh: 'English', en: 'English' },

  // Git status
  gitSaved:        { zh: '已保存',   en: 'Saved' },
  gitSaving:       { zh: '保存中…', en: 'Saving…' },
  gitPending:      { zh: '等待提交', en: 'Pending' },

  // Dashboard
  dashboardTitle:    { zh: '学术图表', en: 'Academic Plots' },
  dashboardTitleEm:  { zh: '工作室', en: 'Studio' },
  dashboardSubtitle: { zh: '用 matplotlib + PGF 输出投稿级 PDF。每次编辑 git 自动留痕。', en: 'Export submission-quality PDFs with matplotlib + PGF. Every edit is tracked with git.' },
  loadDemo:        { zh: '加载 Demo',  en: 'Load Demo' },
  newProject:      { zh: '新建项目',   en: 'New Project' },
  searchProjects:  { zh: '搜索项目…', en: 'Search projects…' },
  noProjects:      { zh: '还没有项目，点击新建开始', en: 'No projects yet. Click New Project to get started.' },
  projects:        { zh: '个项目', en: 'projects' },

  // Nav
  navProjects:     { zh: '项目',   en: 'Projects' },
  navWorkspace:    { zh: '工作台', en: 'Workspace' },

  // Modals
  newProjectTitle:    { zh: '新建项目', en: 'New Project' },
  newProjectNamePh:   { zh: '项目名称（如 Nature 2026）', en: 'Project name (e.g., Nature 2026)' },
  newProjectDescPh:   { zh: '描述（可选）', en: 'Description (optional)' },
  newExperimentTitle: { zh: '新建实验', en: 'New Experiment' },
  newExperimentNamePh: { zh: '实验名称（如 exp-baseline）', en: 'Experiment name (e.g., exp-baseline)' },
  copyDataFrom:       { zh: '复制原始数据自（可选）', en: 'Copy raw data from (optional)' },
  noCopy:             { zh: '不复制', en: 'Do not copy' },
  newTaskTitle:       { zh: '新建任务', en: 'New Task' },
  newTaskNamePh:      { zh: '任务名称（如 Fig.2 时间演化）', en: 'Task name (e.g., Fig.2 Time Evolution)' },
  copyScriptFrom:     { zh: '复制数据/脚本自（可选）', en: 'Copy data/scripts from (optional)' },

  // Toast messages
  projectCreated:    { zh: '项目已创建', en: 'Project created' },
  experimentCreated: { zh: '实验已创建', en: 'Experiment created' },
  taskCreated:       { zh: '任务已创建', en: 'Task created' },
  restoreFailed:     { zh: '恢复失败', en: 'Restore failed' },
  restoredTo:        { zh: '已恢复到 {hash}', en: 'Restored to {hash}' },
  tableSaved:        { zh: '表格已保存，切到预览让 agent 生成图表', en: 'Table saved. Switch to Preview to generate a chart.' },
  pdfFailed:         { zh: 'PDF 生成失败', en: 'PDF generation failed' },

  // Workspace / task area
  selectOrCreateTask:       { zh: '选择或新建一个任务', en: 'Select or create a task' },
  selectOrCreateExperiment: { zh: '选择或新建一个实验', en: 'Select or create an experiment' },
  agentGenerating:  { zh: 'Agent 正在生成…', en: 'Agent is generating…' },
  agentPipeline:    { zh: '分析 → 生成代码 → 执行', en: 'Analyze → Generate code → Execute' },
  downloadPdf:      { zh: '下载 PDF', en: 'Download PDF' },
  filename:         { zh: '文件名', en: 'Filename' },
  generating:       { zh: '生成中…', en: 'Generating…' },
  history:          { zh: '历史', en: 'History' },
  currentVersion:   { zh: '当前', en: 'Current' },
  previewTab:       { zh: '预览', en: 'Preview' },
  applyPalette:     { zh: '应用 {name} 配色', en: 'Apply {name} palette' },

  // Sidebar
  noExperiments:   { zh: '还没有实验', en: 'No experiments yet' },
  newExperiment:   { zh: '新建实验',   en: 'New Experiment' },
  newTask:         { zh: '新建任务',   en: 'New Task' },
  sideProjects:    { zh: '项目', en: 'Projects' },
  sideAllProjects: { zh: '所有项目', en: 'All Projects' },
  expandSidebar:   { zh: '展开侧栏', en: 'Expand sidebar' },
  collapseSidebar: { zh: '收起侧栏', en: 'Collapse sidebar' },

  // Command palette
  cmdPlaceholder:  { zh: '输入命令或搜索…', en: 'Type a command or search…' },
  cmdGrpGenerate:  { zh: '生成', en: 'Generate' },
  cmdGrpView:      { zh: '新建', en: 'New' },
  cmdGrpExport:    { zh: '导出', en: 'Export' },
  cmdGrpHistory:   { zh: '历史', en: 'History' },
  cmdRegen:        { zh: '重新生成图表', en: 'Regenerate chart' },
  cmdNewTask:      { zh: '新建任务', en: 'New task' },
  cmdNewExp:       { zh: '新建实验', en: 'New experiment' },
  cmdExportPdf:    { zh: '导出 PDF', en: 'Export PDF' },
  cmdExportSvg:    { zh: '导出 SVG', en: 'Export SVG' },
  cmdUndo:         { zh: '回退到上一版', en: 'Revert to previous version' },

  // Activity tabs / section headers
  tabChat:         { zh: '对话',     en: 'Chat' },
  tabEdit:         { zh: '元素编辑', en: 'Element Editor' },
  tabProperties:   { zh: '属性',     en: 'Properties' },
  tabPalette:      { zh: '配色方案', en: 'Color Scheme' },
  tabMemory:       { zh: '记忆',     en: 'Memory' },
  tabTemplate:     { zh: '模板',     en: 'Templates' },
  tabHistory:      { zh: '历史',     en: 'History' },
  sectionProperties: { zh: '图表属性', en: 'Chart Properties' },

  // Settings modal
  settingsTitle:           { zh: '模型设置',       en: 'Model Settings' },
  settingsDefaultProvider: { zh: '默认模型提供商', en: 'Default model provider' },
  settingsMaxRounds:       { zh: '最大工具轮次',   en: 'Max tool rounds' },
  settingsMaxRoundsHint:   { zh: 'Agent 每次响应最多可调用工具的轮数。若出现超出轮次错误请调大此值。', en: 'Max tool rounds per agent response. Increase if you hit "max rounds exceeded" errors.' },
  settingsEditorTheme:     { zh: '编辑器主题',     en: 'Editor theme' },
  ollamaModelName:         { zh: '模型名称',       en: 'Model name' },
  testConnection:          { zh: '测试连接',       en: 'Test connection' },
  testing:                 { zh: '测试中…',       en: 'Testing…' },
  connectedModels:         { zh: '✓ 已连接，{n} 个模型', en: '✓ Connected, {n} models' },
  installedModels:         { zh: '已安装的模型',   en: 'Installed models' },
  litellmModelString:      { zh: '模型字符串',     en: 'Model string' },
  litellmHint:             { zh: 'LiteLLM 格式：provider/model，如 "openai/gpt-4o"、"gemini/gemini-2.0-flash"', en: 'LiteLLM format: provider/model, e.g. "openai/gpt-4o", "gemini/gemini-2.0-flash"' },
  showKey:                 { zh: '显示',           en: 'Show' },
  hideKey:                 { zh: '隐藏',           en: 'Hide' },
  apiKeyConfigured:        { zh: '已配置（留空则保留现有 key）', en: 'Configured (leave blank to keep existing key)' },
  apiKeyNotConfigured:     { zh: '尚未配置',       en: 'Not configured' },
  apiKeyHint:              { zh: '对应服务商的 API Key', en: 'API key for the selected provider' },
  supportedProviders:      { zh: '支持的 provider', en: 'Supported providers' },
  getApiKey:               { zh: '获取 API Key',   en: 'Get API Key' },
  anthropicModel:          { zh: '模型',           en: 'Model' },
  anthropicModelHint:      { zh: '选择或输入模型 ID', en: 'Select or enter model ID' },
  anthropicCustom:         { zh: '自定义…',        en: 'Custom…' },

  // Chat panel
  thinkingProcess: { zh: '思考过程 ({n} 行)', en: 'Thinking process ({n} lines)' },
  thinking:        { zh: '思考中…',           en: 'Thinking…' },
  contextSync:     { zh: '🔄 上下文同步',     en: '🔄 Context Sync' },
  chatPlaceholder: { zh: '描述你想做什么图…', en: 'Describe the chart you want…' },
  sendShortcut:    { zh: '⌘↵ 发送',           en: '⌘↵ Send' },

  // Data panel (Processed tab)
  pasteFromExcel:  { zh: '从 Excel / Numbers 粘贴', en: 'Paste from Excel / Numbers' },
  pasteHere:       { zh: '粘贴数据后在此显示', en: 'Paste data to display here' },
  editHint:        { zh: '双击编辑 · Shift+点击扩选 · ⌘C/⌘V', en: 'Double-click to edit · Shift+click to extend · ⌘C/⌘V' },
  addRow:          { zh: '新增一行', en: 'Add row' },
  addCol:          { zh: '新增一列', en: 'Add column' },
  transpose:       { zh: '转置', en: 'Transpose' },
  clearAll:        { zh: '清空', en: 'Clear' },
  rowLabel:        { zh: '行', en: 'Row' },
  colLabel:        { zh: '列', en: 'Col' },
  rowColCount:     { zh: '{rows} 行 × {cols} 列', en: '{rows} rows × {cols} cols' },
  saveFailedDetail: { zh: '保存失败：{error}', en: 'Save failed: {error}' },
  savedCheck:      { zh: '✓ 已保存', en: '✓ Saved' },
  saveToCsv:       { zh: '保存到 processed/data.csv', en: 'Save to processed/data.csv' },

  // Script tab
  findSaveHint:    { zh: '⌘F 查找 · ⌘S 保存', en: '⌘F Find · ⌘S Save' },
  runSuccess:      { zh: '运行成功，预览已更新', en: 'Run successful, preview updated' },
  runFailed:       { zh: '运行失败', en: 'Run failed' },

  // Palette panel
  currentPalette:     { zh: '当前配色', en: 'Current palette' },
  presetSchemes:      { zh: '预设方案', en: 'Preset schemes' },
  noColorsDetected:   { zh: '未检测到可替换的颜色', en: 'No replaceable colors detected' },
  paletteWriteFailed: { zh: '写回 plot.py 失败', en: 'Failed to write back to plot.py' },
  colorsReplaced:     { zh: '已替换 {n} 处颜色', en: 'Replaced {n} colors' },
  customPalette:      { zh: '自定义 {n}', en: 'Custom {n}' },
  generateChartFirst: { zh: '生成图表后才能切换配色', en: 'Generate a chart first to switch palettes' },

  // Memory panel
  taskMemory:       { zh: 'Task 记忆',   en: 'Task Memory' },
  experimentMemory: { zh: 'Experiment 记忆', en: 'Experiment Memory' },
  selectExpOrTask:  { zh: '选择一个实验或任务', en: 'Select an experiment or task' },
  memoryDesc:       { zh: 'Memory 会记录 agent 和用户的关键决策', en: 'Memory records key decisions from the agent and user' },
  memoryFooter:     { zh: 'Agent 对话摘要会自动写入 Task 记忆。你也可以手动记录偏好和决策。', en: 'Agent summaries are automatically written to Task Memory. You can also manually record preferences and decisions.' },

  // Experiment panel
  filterColLabel:    { zh: '列', en: 'Col' },
  filterRows:        { zh: '筛选行', en: 'Filter rows' },
  selectFilePreview: { zh: '选择左侧文件预览数据', en: 'Select a file on the left to preview data' },
  filteredRowsCount: { zh: '{n} 行（共 {m} 行）', en: '{n} rows (of {m})' },
  exportTo:          { zh: '导出到', en: 'Export to' },
  selectTask:        { zh: '选择任务…', en: 'Select task…' },
  taskName:          { zh: '任务名称', en: 'Task name' },
  rowCount:          { zh: '{n} 行', en: '{n} rows' },
  exporting:         { zh: '导出中…', en: 'Exporting…' },
  exportToTask:      { zh: '导出到任务 ▶', en: 'Export to task ▶' },
  exportedRows:      { zh: '✓ 已导出 {n} 行到 {path}', en: '✓ Exported {n} rows to {path}' },
  exportFailed:      { zh: '导出失败', en: 'Export failed' },
  exportFailedBackend: { zh: '导出失败，请检查后端', en: 'Export failed, please check backend' },
  receiving:         { zh: '接收中…', en: 'Receiving…' },
  liveReceive:       { zh: '实时接收', en: 'Live receive' },
  noRawData:         { zh: '还没有原始数据文件', en: 'No raw data files yet' },
  waitingForStream:  { zh: '等待数据流接入…', en: 'Waiting for data stream…' },

  // Template panel
  chartTemplates: { zh: '图表模板', en: 'Chart templates' },
  journalSpecs:   { zh: '期刊规范', en: 'Journal specs' },
  templateHint:   { zh: '点击模板，Agent 会基于你的数据生成对应图表', en: 'Click a template and the Agent will generate the corresponding chart.' },
  journalHint:    { zh: '点击期刊规范，Agent 会按要求调整图表格式', en: 'Click a journal spec and the Agent will adjust the chart format accordingly.' },

  // Template names / descriptions
  tmplGroupedBarName:  { zh: '分组柱状图', en: 'Grouped Bar Chart' },
  tmplGroupedBarDesc:  { zh: '比较多组数据的均值差异，支持误差线', en: 'Compare group means with optional error bars' },
  tmplLinePlotName:    { zh: '折线图', en: 'Line Plot' },
  tmplLinePlotDesc:    { zh: '展示趋势变化，支持多条线和置信区间', en: 'Show trends with multiple lines and confidence intervals' },
  tmplHeatmapName:     { zh: '热力图', en: 'Heatmap' },
  tmplHeatmapDesc:     { zh: '展示矩阵数据或相关性，支持聚类', en: 'Visualize matrix data or correlations, supports clustering' },
  tmplBoxPlotName:     { zh: '箱线图', en: 'Box Plot' },
  tmplBoxPlotDesc:     { zh: '展示数据分布、中位数、四分位数和异常值', en: 'Show data distribution, median, quartiles, and outliers' },
  tmplScatterName:     { zh: '散点图', en: 'Scatter Plot' },
  tmplScatterDesc:     { zh: '展示两变量关系，支持回归线和分组', en: 'Show bivariate relationships with regression line and grouping' },
  tmplViolinName:      { zh: '小提琴图', en: 'Violin Plot' },
  tmplViolinDesc:      { zh: '展示数据分布密度，比箱线图信息更丰富', en: 'Show density distribution, more informative than box plots' },
  tmplStackedBarName:  { zh: '堆叠柱状图', en: 'Stacked Bar Chart' },
  tmplStackedBarDesc:  { zh: '展示各部分占总体的比例', en: 'Show part-to-whole proportions' },
  tmplDonutName:       { zh: '环形图', en: 'Donut Chart' },
  tmplDonutDesc:       { zh: '展示比例关系，中心可标注总数', en: 'Show proportions with optional center label' },

  // Properties panel - group labels
  gLayout:     { zh: '布局', en: 'Layout' },
  gText:       { zh: '文字', en: 'Text' },
  gTypography: { zh: '字号', en: 'Typography' },
  gColor:      { zh: '颜色', en: 'Color' },
  gChart:      { zh: '图表', en: 'Chart' },
  gAxes:       { zh: '坐标轴', en: 'Axes' },
  gLegend:     { zh: '图例', en: 'Legend' },
  gOther:      { zh: '其他', en: 'Other' },

  // Properties panel - prop labels
  pFigsize:      { zh: '图形大小', en: 'Figure size' },
  pTitle:        { zh: '标题', en: 'Title' },
  pXlabel:       { zh: 'X 轴标签', en: 'X label' },
  pYlabel:       { zh: 'Y 轴标签', en: 'Y label' },
  pSuptitle:     { zh: '总标题', en: 'Figure title' },
  pTitleSize:    { zh: '标题字号', en: 'Title size' },
  pLabelSize:    { zh: '轴标签字号', en: 'Label size' },
  pTickSize:     { zh: '刻度字号', en: 'Tick size' },
  pFontSize:     { zh: '全局字号', en: 'Font size' },
  pPalette:      { zh: '颜色方案', en: 'Color palette' },
  pBarAlpha:     { zh: '柱透明度', en: 'Bar alpha' },
  pBarWidth:     { zh: '柱宽', en: 'Bar width' },
  pLineWidth:    { zh: '线宽', en: 'Line width' },
  pLineStyle:    { zh: '线型', en: 'Line style' },
  pMarkerSize:   { zh: '标记大小', en: 'Marker size' },
  pScatterAlpha: { zh: '散点透明度', en: 'Scatter alpha' },
  pViolinAlpha:  { zh: '小提琴透明度', en: 'Violin alpha' },
  pFillAlpha:    { zh: '填充透明度', en: 'Fill alpha' },
  pCapSize:      { zh: '误差线端宽', en: 'Cap size' },
  pErrorWidth:   { zh: '误差线宽', en: 'Error width' },
  pHeatmapCmap:  { zh: '热图色谱', en: 'Heatmap cmap' },
  pGrid:         { zh: '网格线', en: 'Grid' },
  pGridAlpha:    { zh: '网格透明度', en: 'Grid alpha' },
  pXlim:         { zh: 'X 轴范围', en: 'X range' },
  pYlim:         { zh: 'Y 轴范围', en: 'Y range' },
  pXscale:       { zh: 'X 轴刻度', en: 'X scale' },
  pYscale:       { zh: 'Y 轴刻度', en: 'Y scale' },
  pLegendLoc:    { zh: '图例位置', en: 'Legend location' },
  pLegendSize:   { zh: '图例字号', en: 'Legend size' },
  pLegendAlpha:  { zh: '图例透明度', en: 'Legend alpha' },

  // Properties panel - misc
  propToggleDisable: { zh: '点击关闭此属性', en: 'Click to disable' },
  propToggleEnable:  { zh: '点击启用此属性', en: 'Click to enable' },
  propSaving:        { zh: '保存中…', en: 'Saving…' },
  selectTaskForProps: { zh: '选择一个任务查看属性', en: 'Select a task to view properties' },
  noChartYet:        { zh: '还没有图表', en: 'No chart yet' },
  noChartDesc:       { zh: '让 Agent 生成图表后，所有可编辑属性会出现在这里', en: 'After the Agent generates a chart, all editable properties will appear here.' },
}

// Map from propKey → i18n dict key
export const PROP_KEY_MAP = {
  figsize:       'pFigsize',
  title:         'pTitle',
  xlabel:        'pXlabel',
  ylabel:        'pYlabel',
  suptitle:      'pSuptitle',
  title_size:    'pTitleSize',
  label_size:    'pLabelSize',
  tick_size:     'pTickSize',
  font_size:     'pFontSize',
  palette:       'pPalette',
  bar_alpha:     'pBarAlpha',
  bar_width:     'pBarWidth',
  line_width:    'pLineWidth',
  line_style:    'pLineStyle',
  marker_size:   'pMarkerSize',
  scatter_alpha: 'pScatterAlpha',
  violin_alpha:  'pViolinAlpha',
  fill_alpha:    'pFillAlpha',
  cap_size:      'pCapSize',
  error_width:   'pErrorWidth',
  heatmap_cmap:  'pHeatmapCmap',
  grid:          'pGrid',
  grid_alpha:    'pGridAlpha',
  xlim:          'pXlim',
  ylim:          'pYlim',
  xscale:        'pXscale',
  yscale:        'pYscale',
  legend_loc:    'pLegendLoc',
  legend_size:   'pLegendSize',
  legend_alpha:  'pLegendAlpha',
}

// Map from group key → i18n dict key
export const GROUP_KEY_MAP = {
  layout:     'gLayout',
  text:       'gText',
  typography: 'gTypography',
  color:      'gColor',
  chart:      'gChart',
  axes:       'gAxes',
  legend:     'gLegend',
  other:      'gOther',
}

export function useT() {
  const lang = useStore(s => s.lang)
  return (key, vars) => {
    const entry = DICT[key]
    if (!entry) return key
    let str = entry[lang] ?? entry.zh
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, v)
      }
    }
    return str
  }
}
