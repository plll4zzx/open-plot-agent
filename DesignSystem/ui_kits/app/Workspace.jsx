/* global React, Icon */
const { useState: useState_ws } = React;

function SectionHeader({ num, title, subtitle, right }) {
  return (
    <div className="opa-sh">
      <div className="opa-sh-l">
        <span className="opa-sh-num">{num}</span>
        <span className="opa-sh-t">{title}</span>
        {subtitle && <span className="opa-sh-sub">· {subtitle}</span>}
      </div>
      {right}
    </div>
  );
}

function GitBadge({ status }) {
  const cfg = {
    saved:   { color: '#0F766E', label: '已保存' },
    saving:  { color: '#B45309', label: '保存中…' },
    pending: { color: '#A8A29E', label: '等待提交' },
  }[status];
  return <span className="opa-git-badge" style={{ color: cfg.color }}><span>●</span>{cfg.label}</span>;
}

const TASKS = [
  { id: '001', t: 'Fig.1 实验装置', v: 4, ago: '2h', star: true, done: true },
  { id: '002', t: 'Fig.2 时间演化', v: 7, ago: '30m', done: true },
  { id: '003', t: 'Fig.3 相关性', v: 3, ago: '1d' },
  { id: '004', t: 'Fig.4 分布对比', v: 2, ago: '2d', done: true },
  { id: '005', t: 'Fig.5 消融', v: 1, ago: '3d' },
];

function ProjectSidebar({ activeId, setActive, onNew, projectName }) {
  return (
    <aside className="opa-sidebar">
      <div className="opa-sidebar-h">
        <div className="opa-tag">PROJECT</div>
        <div className="opa-sidebar-name">{projectName}</div>
        <div className="opa-sidebar-pal">
          <span style={{ background: '#E63946' }} />
          <span style={{ background: '#457B9D' }} />
          <span style={{ background: '#1C1917' }} />
          <span style={{ background: '#B45309' }} />
        </div>
      </div>
      <div className="opa-sidebar-list">
        <div className="opa-sidebar-subhead">
          <span>任务 · {TASKS.length}</span>
          <span className="opa-mono" style={{ color: '#A8A29E' }}>⏱</span>
        </div>
        {TASKS.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={"opa-task-row" + (t.id === activeId ? ' is-active' : '')}>
            <span className="opa-task-id">{t.id}</span>
            <span className="opa-task-dot">{t.done ? '●' : '○'}</span>
            <div className="opa-task-m">
              <div className="opa-task-t">{t.t} {t.star && <span style={{ color: '#B45309' }}>⭐</span>}</div>
              <div className="opa-task-sub">v{t.v} · {t.ago}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="opa-sidebar-f">
        <button className="opa-btn-sec-sm" onClick={onNew}><Icon.Plus size={12} />新建任务</button>
      </div>
    </aside>
  );
}

// ── Sample matplotlib-style chart (hand-composed SVG)
function ChartPreview() {
  const W = 520, H = 320, px = { l: 56, r: 24, t: 28, b: 40 };
  const iw = W - px.l - px.r, ih = H - px.t - px.b;
  // log-ish series
  const treatment = [0.02,0.05,0.09,0.18,0.32,0.55,0.82,1.05,1.18,1.22,1.18,1.10];
  const control = [0.02,0.03,0.04,0.06,0.10,0.16,0.25,0.38,0.55,0.70,0.80,0.85];
  const xs = treatment.map((_,i) => i);
  const toX = i => px.l + (i/(treatment.length-1)) * iw;
  const toY = v => px.t + ih - (v/1.3) * ih;
  const path = arr => arr.map((v,i) => (i===0?'M':'L') + toX(i) + ' ' + toY(v)).join(' ');
  const band = arr => {
    const up = arr.map(v => v*1.15), dn = arr.map(v => v*0.85);
    return up.map((v,i) => (i===0?'M':'L') + toX(i) + ' ' + toY(v)).join(' ')
      + ' ' + dn.slice().reverse().map((v,i) => 'L' + toX(dn.length-1-i) + ' ' + toY(v)).join(' ') + ' Z';
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="opa-chart-svg">
      <rect x={px.l} y={px.t} width={iw} height={ih} fill="#FFFFFF" stroke="#E7E0D1"/>
      {[0,1,2,3,4].map(i => {
        const y = px.t + ih - (i/4)*ih;
        return <line key={i} x1={px.l} x2={px.l+iw} y1={y} y2={y} stroke="#F0EAD9" strokeWidth="1"/>;
      })}
      <path d={band(treatment)} fill="#E6394622"/>
      <path d={band(control)} fill="#457B9D22"/>
      <path d={path(treatment)} stroke="#E63946" strokeWidth="2" fill="none"/>
      <path d={path(control)}   stroke="#457B9D" strokeWidth="2" fill="none"/>
      {xs.map(i => (i%2===0 &&
        <g key={i}>
          <line x1={toX(i)} x2={toX(i)} y1={px.t+ih} y2={px.t+ih+4} stroke="#78716C"/>
          <text x={toX(i)} y={px.t+ih+16} fontFamily="JetBrains Mono,monospace" fontSize="10" fill="#57534E" textAnchor="middle">{i}h</text>
        </g>
      ))}
      {[0,0.5,1.0].map(v => (
        <g key={v}>
          <line x1={px.l-4} x2={px.l} y1={toY(v)} y2={toY(v)} stroke="#78716C"/>
          <text x={px.l-8} y={toY(v)+3} fontFamily="JetBrains Mono,monospace" fontSize="10" fill="#57534E" textAnchor="end">{v.toFixed(1)}</text>
        </g>
      ))}
      <text x={W/2} y={18} fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="14" fill="#1C1917" textAnchor="middle">X₁ expression · n=24</text>
      <text x={18} y={H/2} fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="12" fill="#44403C" transform={`rotate(-90 18 ${H/2})`} textAnchor="middle">expression (a.u.)</text>
      <text x={W/2} y={H-6} fontFamily="Cormorant Garamond,serif" fontStyle="italic" fontSize="12" fill="#44403C" textAnchor="middle">t (hours)</text>
      {/* legend */}
      <g transform={`translate(${W-px.r-110} ${px.t+12})`}>
        <rect width="100" height="36" rx="4" fill="#FFFFFF" stroke="#E7E0D1"/>
        <line x1="8" x2="22" y1="13" y2="13" stroke="#E63946" strokeWidth="2"/>
        <text x="28" y="16" fontFamily="Geist,sans-serif" fontSize="10" fill="#1C1917">treatment</text>
        <line x1="8" x2="22" y1="27" y2="27" stroke="#457B9D" strokeWidth="2"/>
        <text x="28" y="30" fontFamily="Geist,sans-serif" fontSize="10" fill="#1C1917">control</text>
      </g>
    </svg>
  );
}

function ToolPill({ name, status }) {
  return (
    <div className="opa-toolpill">
      <Icon.ChevronRight size={11} />
      <span>🔧 {name}</span>
      <span className={"opa-toolpill-s opa-toolpill-s-" + status}>
        {status === 'ok' ? '✓' : status === 'fail' ? '✗' : '…'}
      </span>
    </div>
  );
}

function ChatTab() {
  return (
    <div className="opa-chat">
      <div className="opa-chat-msgs">
        <div className="opa-bub-u">把颜色改成蓝色，加网格</div>
        <div className="opa-ag-sig"><div className="opa-ag-dot">✨</div><span>Agent</span></div>
        <ToolPill name="read_plot_py()" status="ok" />
        <ToolPill name="memory_read('task')" status="ok" />
        <ToolPill name="write_plot_py(…)" status="ok" />
        <ToolPill name="execute_python()" status="ok" />
        <div className="opa-ag-body">已改为蓝色调色板，添加了 y 轴水平网格。<br/>→ 跳到 v2</div>

        <div className="opa-bub-u" style={{ marginTop: 14 }}>改成对数 y 轴，加 95% CI 阴影带</div>
        <div className="opa-ag-sig"><div className="opa-ag-dot">✨</div><span>Agent</span></div>
        <ToolPill name="write_plot_py(…)" status="ok" />
        <ToolPill name="execute_python()" status="wait" />
      </div>
      <div className="opa-chat-input-wrap">
        <div className="opa-ctx-bar">
          <span className="opa-mono" style={{ color: '#78716C' }}>context</span>
          <div className="opa-ctx-bar-track"><span style={{ width: '78%' }}/></div>
          <span className="opa-mono" style={{ color: '#78716C' }}>47.1k / 60k</span>
        </div>
        <div className="opa-composer">
          <textarea rows="2" placeholder="描述你想做什么图…" />
          <button className="opa-send"><Icon.Send size={13} /></button>
        </div>
        <div className="opa-kbd-hint">⌘↵ 发送</div>
      </div>
    </div>
  );
}

function HistoryTab() {
  const commits = [
    { h: 'a3f8c21', t: '10:41', tag: 'FINAL', msg: 'finalize: v4 as submission' },
    { h: '8b4e91d', t: '10:40', tag: 'STYLE', msg: 'apply Okabe-Ito palette' },
    { h: 'c7d2a5f', t: '10:39', tag: 'PLOT',  msg: 'edit title → LaTeX formula' },
    { h: 'f92e1c4', t: '10:38', tag: 'PLOT',  msg: 'move legend (-24,+8)' },
    { h: '2ac8193', t: '10:38', tag: 'AI',    msg: 'v3 – add gridlines' },
    { h: '7f4a2d1', t: '10:28', tag: 'DATA',  msg: 'raw: add exp_001..003' },
    { h: 'initial', t: '10:00', tag: 'INIT',  msg: 'create task Fig.2' },
  ];
  return (
    <div className="opa-hist">
      <div className="opa-hist-filter">
        {['全部','Plot','Data','Memory','Style','Final'].map((f,i) => (
          <button key={f} className={"opa-hist-chip" + (i===0?' is-active':'')}>{f}</button>
        ))}
      </div>
      <div className="opa-hist-meta">main · 42 commits</div>
      <div className="opa-hist-list">
        {commits.map(c => (
          <div key={c.h} className="opa-hist-item">
            <span className="opa-hist-dot">●</span>
            <span className="opa-mono opa-hist-h">{c.h}</span>
            <span className="opa-mono opa-hist-t">{c.t}</span>
            <span className={"opa-hist-tag opa-hist-tag-" + c.tag}>[{c.tag}]</span>
            <span className="opa-hist-msg">{c.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaletteTab() {
  const palettes = [
    { name: 'Okabe-Ito (CVD-safe)', cols: ['#E69F00','#56B4E9','#009E73','#F0E442','#0072B2','#D55E00','#CC79A7'] },
    { name: 'Nature',               cols: ['#E64B35','#4DBBD5','#00A087','#3C5488','#F39B7F','#8491B4'] },
    { name: 'Cell',                 cols: ['#5773CC','#FFB900','#D05151','#4C9F70','#8660A9','#F49D37'] },
    { name: 'ColorBrewer Set2',     cols: ['#66C2A5','#FC8D62','#8DA0CB','#E78AC3','#A6D854','#FFD92F'] },
    { name: 'Stone mono',           cols: ['#1C1917','#44403C','#78716C','#A8A29E','#C4BEB7','#E7E0D1'] },
  ];
  return (
    <div className="opa-pal">
      <div className="opa-pal-head">
        <span className="opa-mono opa-tag-row">灰度预览</span>
        <label className="opa-tog"><input type="checkbox"/><span/></label>
      </div>
      {palettes.map(p => (
        <div key={p.name} className="opa-pal-row">
          <div className="opa-pal-label">{p.name}</div>
          <div className="opa-pal-strip">
            {p.cols.map((c,i) => <span key={i} style={{ background: c }}/>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function CodeTab() {
  const lines = [
    ['import matplotlib.pyplot as plt', 'kw'],
    ['import matplotlib as mpl', 'kw'],
    ['import pandas as pd', 'kw'],
    ['', 'nl'],
    ['mpl.use("pgf")', 'fn'],
    ['df = pd.read_csv("processed/fig_data.csv")', 'fn'],
    ['', 'nl'],
    ['fig, ax = plt.subplots(figsize=(3.5, 2.2))', 'fn'],
    ['ax.set_yscale("log")', 'fn'],
    ['ax.fill_between(df.t, df.lo, df.hi, alpha=0.2)', 'fn'],
    ['ax.plot(df.t, df.x1, color="#E63946", label=r"$X_1$")', 'fn'],
    ['ax.plot(df.t, df.x1_ctrl, color="#457B9D", label=r"$X_1^\\mathrm{ctrl}$")', 'fn'],
    ['ax.legend(frameon=False, loc="upper left")', 'fn'],
    ['fig.savefig("chart/out.pdf", backend="pgf")', 'fn'],
  ];
  return (
    <div className="opa-code">
      <div className="opa-code-tabs">
        <button className="opa-code-tab is-active">plot.py</button>
        <button className="opa-code-tab">pipeline.py</button>
        <button className="opa-code-tab">TASK.md</button>
      </div>
      <div className="opa-code-body">
        {lines.map((l,i) => (
          <div key={i} className="opa-code-line">
            <span className="opa-code-n">{String(i+1).padStart(2,' ')}</span>
            <span>{l[0] || '\u00A0'}</span>
          </div>
        ))}
      </div>
      <div className="opa-code-foot">
        <span>只读 · 点编辑按钮手动修改</span>
        <button className="opa-btn-sec-sm">✏ 编辑</button>
      </div>
    </div>
  );
}

function MemoryTab() {
  return (
    <div className="opa-mem">
      <div className="opa-mem-tabs">
        {['Global','Project','Task'].map((l,i) => (
          <button key={l} className={"opa-mem-tab" + (i===2?' is-active':'')}>{l}</button>
        ))}
      </div>
      <div className="opa-mem-file">TASK.md · Fig.2 时间演化</div>
      <div className="opa-mem-body">
        <h4>## 数据背景</h4>
        <p>- 采集自 2026-03-15 的 12h 时序实验</p>
        <p>- 每 30min 采样，共 24 个时点</p>
        <h4>## 本图重点</h4>
        <p>- 要突出 t=6h 的转折点</p>
        <p>- y 轴对数刻度</p>
        <h4>## 用户决策轨迹</h4>
        <p>- [v2] 尝试过双 y 轴，用户否决</p>
        <p>- [v5] 尝试过 violin plot，用户否决</p>
        <p>- [v7] 最终用 line + shaded CI，用户批准</p>
      </div>
      <div className="opa-mem-foot">📝 Agent 最近更新：10:41（"v7 定稿"）</div>
    </div>
  );
}

function Workspace({ projectName, onBack }) {
  const [activeTask, setActiveTask] = useState_ws('002');
  const [tab, setTab] = useState_ws('chat');
  const [gitStatus] = useState_ws('saved');

  const task = TASKS.find(t => t.id === activeTask);

  const tabs = [
    ['chat',    Icon.MessageSquare, '对话'],
    ['history', Icon.Clock,         '历史'],
    ['palette', Icon.Palette,       '配色'],
    ['code',    Icon.Code,          '代码'],
    ['memory',  Icon.Brain,         '记忆'],
    ['model',   Icon.Cpu,           '模型'],
  ];

  return (
    <div className="opa-workspace">
      <ProjectSidebar projectName={projectName} activeId={activeTask} setActive={setActiveTask} onNew={() => {}} />

      <main className="opa-main">
        <SectionHeader num="01" title="预览" subtitle={task ? task.t : '—'}
          right={
            <div className="opa-sh-r">
              <GitBadge status={gitStatus} />
              <button className="opa-icobtn"><Icon.Eye size={13} /></button>
            </div>
          }
        />
        <div className="opa-main-body">
          <div className="opa-chart-wrap">
            <div className="opa-chart-toolbar">
              <span className="opa-mono">plot.py · 10:41</span>
              <span style={{ color: '#B45309' }}>⭐</span>
              <span style={{ marginLeft: 'auto', color: '#78716C', fontSize: 11 }}>v7 · figsize 3.5×2.2in</span>
            </div>
            <div className="opa-chart-canvas">
              <ChartPreview />
            </div>
          </div>

          <div className="opa-timeline">
            <div className="opa-tl-tag"><Icon.GitBranch size={11} /><span>历史</span></div>
            <div className="opa-tl-row">
              {[
                { h: 'a3f8c21', msg: 'finalize v7', t: '10:41', final: true },
                { h: '8b4e91d', msg: 'apply Okabe-Ito', t: '10:40' },
                { h: 'c7d2a5f', msg: 'LaTeX title',   t: '10:39' },
                { h: 'f92e1c4', msg: 'move legend',   t: '10:38' },
                { h: '2ac8193', msg: 'v3 add grid',   t: '10:38' },
                { h: '7f4a2d1', msg: 'raw +3 files',  t: '10:28' },
              ].map(c => (
                <div key={c.h} className="opa-tl-card">
                  <div className="opa-mono opa-tl-h" style={{ color: c.final ? '#B45309' : '#A8A29E' }}>{c.h}</div>
                  <div className="opa-tl-m">{c.msg}</div>
                  <div className="opa-mono opa-tl-t">{c.t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <div className="opa-ctxpanel">
        {tab === 'chat'    && <><SectionHeader num="02" title="对话" /><ChatTab /></>}
        {tab === 'history' && <><SectionHeader num="02" title="历史" /><HistoryTab /></>}
        {tab === 'palette' && <><SectionHeader num="02" title="配色" subtitle="学术期刊 / CVD" /><PaletteTab /></>}
        {tab === 'code'    && <><SectionHeader num="02" title="代码" subtitle="plot.py" /><CodeTab /></>}
        {tab === 'memory'  && <><SectionHeader num="02" title="记忆" subtitle="三级 md" /><MemoryTab /></>}
        {tab === 'model'   && <><SectionHeader num="02" title="模型" subtitle="Claude Code · Opus" /><div className="opa-model-stub">Opus 4.7 · active<br/><span style={{ color: '#A8A29E', fontSize: 11 }}>展开看 endpoint / key / temperature</span></div></>}
      </div>

      <div className="opa-rail">
        {tabs.map(([id, I, label]) => (
          <button key={id} onClick={() => setTab(id)} title={label}
            className={"opa-rail-btn" + (tab === id ? ' is-active' : '')}>
            {tab === id && <div className="opa-rail-bar" />}
            <I size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

window.Workspace = Workspace;
