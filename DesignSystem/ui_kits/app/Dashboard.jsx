/* global React, Icon */
const { useState: useState_app, useEffect: useEffect_app } = React;

// ── Header (global) ───────────────────────────────────────────
function Header({ view, setView, crumb }) {
  return (
    <header className="opa-header">
      <div className="opa-header-l">
        <button className="opa-logo" onClick={() => setView('dashboard')}>
          <div className="opa-logo-mark"><Icon.BarChart3 size={15} strokeWidth={2.2} /></div>
          <span className="opa-logo-word">OpenPlotAgent</span>
        </button>
        {view === 'workspace' && crumb && (
          <div className="opa-crumb">
            <Icon.ChevronRight size={12} />
            <button onClick={() => setView('dashboard')}>Projects</button>
            <Icon.ChevronRight size={12} />
            <span className="opa-crumb-cur">{crumb}</span>
          </div>
        )}
      </div>
      <div className="opa-header-r">
        <div className="opa-viewtog">
          {[['dashboard', Icon.LayoutGrid, '项目'], ['workspace', Icon.FileText, '工作台']].map(([k, I, l]) => (
            <button key={k} onClick={() => setView(k)}
              className={"opa-viewtog-btn" + (view === k ? " is-active" : "")}>
              <I size={11} />{l}
            </button>
          ))}
        </div>
        <div className="opa-divider"/>
        <button className="opa-icobtn"><Icon.Settings size={14} /></button>
      </div>
    </header>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
const PROJECTS = [
  { id: 'Nature Submission 2026', sub: 'Figure 1-4 · 细胞动力学', charts: 7, when: '2h 前', star: true,
    palette: ['#E63946','#457B9D','#1C1917','#B45309'] },
  { id: 'IEEE TPAMI 2025', sub: '多模态检索 · 8 张图', charts: 8, when: '昨天',
    palette: ['#0072B2','#D55E00','#009E73','#CC79A7'] },
  { id: 'PhD Thesis · Ch4', sub: '收敛性分析 · 12 张图', charts: 12, when: '3d',
    palette: ['#1C1917','#57534E','#A8A29E','#E7E0D1'] },
  { id: 'Cell 2025 revised', sub: '修回版 · Fig.2 / Fig.5', charts: 2, when: '1w',
    palette: ['#0F766E','#B45309','#7C3AED','#1C1917'] },
];

function Dashboard({ onOpen, onNew }) {
  return (
    <div className="opa-dash">
      <div className="opa-dash-inner">
        <div className="opa-dash-hero">
          <div>
            <div className="opa-tag">WORKSPACE · {PROJECTS.length} PROJECTS</div>
            <h1 className="opa-hero">学术图表 <em>工作室</em></h1>
            <p className="opa-hero-sub">用 matplotlib + PGF 输出投稿级 PDF。每次编辑 git 自动留痕。</p>
          </div>
          <button className="opa-btn-pri" onClick={onNew}><Icon.Plus size={14} />新建项目</button>
        </div>

        <div className="opa-search">
          <Icon.Search size={14} />
          <input placeholder="搜索项目…" />
          <span className="opa-kbd">⌘K</span>
        </div>

        <div className="opa-grid">
          {PROJECTS.map(p => (
            <button key={p.id} className="opa-pcard" onClick={() => onOpen(p.id)}>
              <div className="opa-pcard-strip">
                {p.palette.map((c,i) => <div key={i} style={{ background: c }} />)}
              </div>
              <div className="opa-pcard-t">
                <h3>{p.id}</h3>
                {p.star && <Icon.Star size={12} fill="#B45309" style={{ color: '#B45309' }} />}
              </div>
              <p className="opa-pcard-sub">{p.sub}</p>
              <div className="opa-pcard-meta">
                <span>■■■■ {p.charts} charts</span>
                <span className="opa-mono">{p.when}</span>
              </div>
            </button>
          ))}
          <button className="opa-pcard-new" onClick={onNew}>
            <Icon.Plus size={18} />
            <span>新建项目</span>
          </button>
        </div>

        <div className="opa-dash-section">
          <div className="opa-section-tag"><Icon.Clock size={11} />最近任务</div>
          {[
            { thumb: 'line',    t: 'Fig.3 时间演化', pj: 'Nature 2026', v: 'v7', ago: '2h 前', fin: true },
            { thumb: 'scatter', t: 'Fig.2 散点矩阵', pj: 'IEEE 2025',   v: 'v3', ago: '昨天' },
            { thumb: 'bar',     t: 'Fig.1 分组柱图', pj: 'Cell 2025',    v: 'v2', ago: '3d' },
          ].map((r,i) => (
            <div key={i} className="opa-trow">
              <div className={"opa-thumb opa-thumb-" + r.thumb} />
              <div className="opa-trow-m">
                <div className="opa-trow-t">{r.t}</div>
                <div className="opa-trow-sub">{r.pj}</div>
              </div>
              <div className="opa-trow-meta">
                <span className="opa-mono">{r.v} · {r.ago}</span>
                {r.fin && <span className="opa-pill-final">🔒 已定稿</span>}
                <Icon.ChevronRight size={13} style={{ color: '#A8A29E' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.Header = Header;
window.Dashboard = Dashboard;
window.PROJECTS = PROJECTS;
