import { useState, useRef, useEffect } from "react";
import {
  Upload, Send, Star, Download, Trash2, RefreshCw, Sparkles, Check, X,
  GitBranch, Info, Palette, BarChart3, Grid3x3, Type, Ruler, Languages,
  Clipboard, ChevronDown, ChevronLeft, ChevronRight, Copy, ArrowLeftRight,
  SplitSquareHorizontal, Plus, Settings, FolderOpen, LayoutGrid,
  Search, Clock, FileText, MessageSquare, History, Undo2, Redo2,
  Move, Pencil, Eye, EyeOff, RotateCcw, GitCommit, Sigma, Lock,
} from "lucide-react";

// ───────────────────────────────────────────────────────────
//  MOCK DATA
// ───────────────────────────────────────────────────────────

const projects = [
  { id: "sales_h1", name: "Sales Dashboard 2026", tagline: "上半年业务指标总览", chartCount: 5, lastModified: "2 小时前", starred: true, palette: ["#0F766E", "#F59E0B", "#B45309"], recentStyles: ["polished","grid","blue","default"], fontFamily: "SimHei + Geist" },
  { id: "nature_paper", name: "Nature Submission", tagline: "Figure 1-4 · 细胞动力学", chartCount: 7, lastModified: "昨天", starred: true, palette: ["#E63946","#457B9D","#2A9D8F"], recentStyles: ["polished","grid","blue"], fontFamily: "Times + CM" },
  { id: "ieee_paper", name: "IEEE Trans. 2025", tagline: "性能对比 · 灰度友好", chartCount: 6, lastModified: "3 天前", starred: false, palette: ["#1C1917","#78716C","#D6D3D1"], recentStyles: ["grid","default","blue"], fontFamily: "Times + Helvetica" },
  { id: "thesis", name: "PhD Thesis – Ch.4", tagline: "实验结果图表集", chartCount: 12, lastModified: "1 周前", starred: false, palette: ["#264653","#2A9D8F","#E9C46A"], recentStyles: ["default","grid","polished"], fontFamily: "Times" },
];

const projectCharts = [
  { id: "001", name: "Fig.1 实验装置", lastModified: "2h", style: "polished", versions: 4, starred: true, final: true },
  { id: "002", name: "Fig.2 结果对比", lastModified: "1d", style: "polished", versions: 3, starred: false, final: true },
  { id: "003", name: "Fig.3 时间演化", lastModified: "3d", style: "grid", versions: 2, starred: false, final: true },
  { id: "004", name: "Fig.4 相关性", lastModified: "5d", style: "blue", versions: 5, starred: false, final: true },
  { id: "005", name: "Fig.S1 附录", lastModified: "1w", style: "default", versions: 2, starred: false, final: false },
];

const tableData = [
  { month:"1月", sales:120, profit:24 },{ month:"2月", sales:145, profit:31 },
  { month:"3月", sales:98, profit:18 },{ month:"4月", sales:165, profit:38 },
  { month:"5月", sales:142, profit:29 },{ month:"6月", sales:178, profit:42 },
];

const initialVersions = [
  { id:"v1", timestamp:"10:32", label:"初版", note:"自动生成", style:"default", starred:false },
  { id:"v2", timestamp:"10:35", label:"蓝色主题", note:"把颜色改成蓝色", style:"blue", starred:false },
  { id:"v3", timestamp:"10:38", label:"加网格线", note:"加网格，字号变大", style:"grid", starred:true },
  { id:"v4", timestamp:"10:41", label:"学术配色", note:"用 Okabe-Ito + LaTeX 标题", style:"polished", starred:false },
];

const initialMessages = [
  { role:"system", text:"已解析数据：6 行 × 3 列。推荐分组柱状图。", versionId:"v1" },
  { role:"system", text:"已继承项目样式：主色 #0F766E / 辅 #F59E0B。", versionId:"v1", inherit:true },
  { role:"user", text:"把颜色改成蓝色" },
  { role:"system", text:"已改为蓝色调色板", versionId:"v2" },
  { role:"user", text:"加网格线，字号大一点" },
  { role:"system", text:"添加水平网格，字号 12→14", versionId:"v3" },
  { role:"user", text:"用 Okabe-Ito 配色，标题改成 LaTeX 公式" },
  { role:"system", text:"已应用 Okabe-Ito · 标题渲染 LaTeX", versionId:"v4" },
];

const gitHistory = [
  { hash:"a3f8c21", time:"10:41", type:"finalize", msg:"finalize: v4 as submission", author:"user" },
  { hash:"8b4e91d", time:"10:40", type:"style", msg:"style: apply Okabe-Ito palette", author:"direct" },
  { hash:"c7d2a5f", time:"10:39", type:"plot", msg:"plot: edit title → LaTeX formula", author:"direct" },
  { hash:"f92e1c4", time:"10:38", type:"plot", msg:"plot: move legend (-24, +8)", author:"direct" },
  { hash:"2ac8193", time:"10:38", type:"claude", msg:"plot: v3 – add gridlines, font 14", author:"claude" },
  { hash:"5e7f4b2", time:"10:35", type:"claude", msg:"plot: v2 – blue palette", author:"claude" },
  { hash:"d1a6738", time:"10:32", type:"claude", msg:"plot: v1 – initial generation", author:"claude" },
  { hash:"0b3c5e9", time:"10:30", type:"data", msg:"data: edit cells (3)", author:"user" },
  { hash:"7f4a2d1", time:"10:28", type:"data", msg:"data: initial paste", author:"user" },
];

const academicPalettes = {
  "色盲友好": [
    { id:"okabe", name:"Okabe-Ito", desc:"Nature 推荐 · 8 色", colors:["#000000","#E69F00","#56B4E9","#009E73","#F0E442","#0072B2","#D55E00","#CC79A7"] },
    { id:"wong", name:"Wong", desc:"色盲通过率最高", colors:["#000000","#E69F00","#56B4E9","#009E73","#F0E442","#0072B2","#D55E00"] },
    { id:"tol-bright", name:"Tol Bright", desc:"对比度高", colors:["#4477AA","#EE6677","#228833","#CCBB44","#66CCEE","#AA3377","#BBBBBB"] },
    { id:"tol-muted", name:"Tol Muted", desc:"柔和版", colors:["#CC6677","#332288","#DDCC77","#117733","#88CCEE","#882255","#44AA99","#999933"] },
  ],
  "期刊风格": [
    { id:"nature", name:"Nature", desc:"饱和暖色", colors:["#E63946","#F1A208","#2A9D8F","#457B9D","#1D3557"] },
    { id:"science", name:"Science", desc:"蓝红对比", colors:["#3C5488","#E64B35","#00A087","#4DBBD5","#F39B7F"] },
    { id:"cell", name:"Cell", desc:"紫粉渐变", colors:["#5F0F40","#9A031E","#FB8B24","#E36414","#0F4C5C"] },
    { id:"ieee", name:"IEEE", desc:"灰度友好", colors:["#1C1917","#44403C","#78716C","#A8A29E","#D6D3D1"] },
  ],
  "ColorBrewer": [
    { id:"set2", name:"Set2", desc:"定性 · 8 类", colors:["#66C2A5","#FC8D62","#8DA0CB","#E78AC3","#A6D854","#FFD92F","#E5C494","#B3B3B3"] },
    { id:"dark2", name:"Dark2", desc:"定性 · 深色", colors:["#1B9E77","#D95F02","#7570B3","#E7298A","#66A61E","#E6AB02","#A6761D","#666666"] },
    { id:"rdbu", name:"RdBu", desc:"发散 · 零中心", colors:["#B2182B","#EF8A62","#FDDBC7","#F7F7F7","#D1E5F0","#67A9CF","#2166AC"] },
    { id:"blues", name:"Blues", desc:"顺序 · 单色", colors:["#DEEBF7","#C6DBEF","#9ECAE1","#6BAED6","#4292C6","#2171B5","#084594"] },
  ],
};

const latexSymbols = [
  { cat:"希腊字母", items:[
    {l:"\\alpha", s:"α"},{l:"\\beta", s:"β"},{l:"\\gamma", s:"γ"},{l:"\\delta", s:"δ"},
    {l:"\\theta", s:"θ"},{l:"\\lambda", s:"λ"},{l:"\\mu", s:"μ"},{l:"\\sigma", s:"σ"},
    {l:"\\phi", s:"φ"},{l:"\\omega", s:"ω"},{l:"\\Sigma", s:"Σ"},{l:"\\Omega", s:"Ω"},
  ]},
  { cat:"运算符", items:[
    {l:"\\sum_{i}", s:"Σᵢ"},{l:"\\int", s:"∫"},{l:"\\prod", s:"∏"},{l:"\\partial", s:"∂"},
    {l:"\\infty", s:"∞"},{l:"\\leq", s:"≤"},{l:"\\geq", s:"≥"},{l:"\\times", s:"×"},
  ]},
  { cat:"结构", items:[
    {l:"_{i}", s:"xᵢ"},{l:"^{2}", s:"x²"},{l:"\\frac{a}{b}", s:"a/b"},{l:"\\sqrt{x}", s:"√x"},
  ]},
];

// ───────────────────────────────────────────────────────────
//  LATEX RENDERER (simplified)
// ───────────────────────────────────────────────────────────

function renderLatex(src) {
  if (!src) return "";
  let s = src.replace(/^\$+|\$+$/g, "");
  const greek = { alpha:"α",beta:"β",gamma:"γ",delta:"δ",epsilon:"ε",zeta:"ζ",eta:"η",theta:"θ",iota:"ι",kappa:"κ",lambda:"λ",mu:"μ",nu:"ν",xi:"ξ",pi:"π",rho:"ρ",sigma:"σ",tau:"τ",phi:"φ",chi:"χ",psi:"ψ",omega:"ω",Gamma:"Γ",Delta:"Δ",Theta:"Θ",Lambda:"Λ",Xi:"Ξ",Pi:"Π",Sigma:"Σ",Phi:"Φ",Psi:"Ψ",Omega:"Ω" };
  for (const [k,v] of Object.entries(greek)) s = s.replace(new RegExp(`\\\\${k}\\b`,"g"), v);
  s = s.replace(/\\sum/g,"Σ").replace(/\\int/g,"∫").replace(/\\prod/g,"∏").replace(/\\infty/g,"∞").replace(/\\partial/g,"∂").replace(/\\leq/g,"≤").replace(/\\geq/g,"≥").replace(/\\times/g,"×").replace(/\\cdot/g,"·").replace(/\\pm/g,"±").replace(/\\neq/g,"≠").replace(/\\approx/g,"≈");
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;font-size:0.88em;margin:0 2px"><span style="border-bottom:1px solid currentColor;padding:0 3px 1px">$1</span><span style="padding:1px 3px 0">$2</span></span>');
  s = s.replace(/\\sqrt\{([^}]+)\}/g, '<span style="border-top:1px solid currentColor;padding:0 2px">√<span>$1</span></span>');
  s = s.replace(/_\{([^}]+)\}/g, '<sub style="font-size:0.75em">$1</sub>').replace(/\^\{([^}]+)\}/g, '<sup style="font-size:0.75em">$1</sup>').replace(/_(\w)/g, '<sub style="font-size:0.75em">$1</sub>').replace(/\^(\w)/g, '<sup style="font-size:0.75em">$1</sup>');
  s = s.replace(/\\text\{([^}]+)\}/g, '<span style="font-style:normal">$1</span>');
  s = s.replace(/\\mathrm\{([^}]+)\}/g, '<span style="font-style:normal">$1</span>');
  s = s.replace(/\\mathbf\{([^}]+)\}/g, '<span style="font-weight:bold">$1</span>');
  return s;
}

// ───────────────────────────────────────────────────────────
//  MAIN APP
// ───────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("dashboard");
  const [activeProjectId, setActiveProjectId] = useState(projects[1].id);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [showNewChart, setShowNewChart] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [toast, setToast] = useState(null);
  const activeProject = projects.find(p => p.id === activeProjectId);

  const showToast = (text) => { setToast(text); setTimeout(() => setToast(null), 2400); };
  const openProject = (id) => { setActiveProjectId(id); setView("workspace"); };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col relative"
      style={{ background:"#F5F1EA", backgroundImage:"radial-gradient(circle at 20% 10%, rgba(180,83,9,0.04), transparent 40%), radial-gradient(circle at 80% 90%, rgba(15,118,110,0.04), transparent 40%)", color:"#1C1917", fontFamily:"Geist, -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap');
        *::-webkit-scrollbar { width:6px; height:6px; }
        *::-webkit-scrollbar-track { background:transparent; }
        *::-webkit-scrollbar-thumb { background:#D6CFC2; border-radius:3px; }
        @keyframes pulse-soft { 0%,100%{opacity:0.6} 50%{opacity:1} }
        .pulse-soft { animation:pulse-soft 1.4s ease-in-out infinite; }
        @keyframes slide-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .slide-in { animation:slide-in 0.3s ease-out; }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }
        .fade-in { animation:fade-in 0.4s ease-out; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .spin { animation:spin 1s linear infinite; }
        .chart-shadow { box-shadow:0 1px 2px rgba(28,25,23,0.04), 0 12px 32px -12px rgba(28,25,23,0.12); }
        .latex-text { font-family:'Cormorant Garamond', 'Times New Roman', serif; font-style:italic; }
        .element-outline { stroke:#B45309; stroke-width:1; stroke-dasharray:3 3; fill:none; pointer-events:none; }
        .element-hover { cursor:pointer; }
        .element-hover:hover + .hover-outline { opacity:1; }
      `}</style>

      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-3 border-b z-20"
        style={{ borderColor:"#E7E0D1", background:"rgba(245,241,234,0.85)", backdropFilter:"blur(8px)" }}>
        <div className="flex items-center gap-5">
          <button onClick={() => setView("dashboard")} className="flex items-center gap-2.5 transition hover:opacity-70">
            <div className="w-7 h-7 flex items-center justify-center rounded" style={{ background:"#1C1917" }}>
              <BarChart3 size={15} color="#F5F1EA" strokeWidth={2.2}/>
            </div>
            <span style={{ fontSize:17, fontFamily:"Fraunces, serif", fontWeight:500, fontStyle:"italic" }}>Plotsmith</span>
          </button>
          {view === "workspace" && (
            <div className="flex items-center gap-2" style={{ fontSize:12, color:"#78716C" }}>
              <ChevronRight size={12}/>
              <button onClick={() => setView("dashboard")} className="hover:underline" style={{ color:"#44403C" }}>Projects</button>
              <ChevronRight size={12}/>
              <span style={{ color:"#1C1917", fontWeight:500 }}>{activeProject?.name}</span>
              <ChevronRight size={12}/>
              <span className="font-mono">001_fig1_setup</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md p-0.5" style={{ background:"#E7E0D1" }}>
            {[["dashboard",LayoutGrid,"项目"],["workspace",FileText,"工作台"]].map(([k,I,l]) => (
              <button key={k} onClick={() => setView(k)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded transition"
                style={{ fontSize:11.5, background: view===k?"#FFFFFF":"transparent", color: view===k?"#1C1917":"#78716C", fontWeight: view===k?500:400 }}>
                <I size={11}/>{l}
              </button>
            ))}
          </div>
          <div className="w-px h-5 mx-1" style={{ background:"#D6CFC2" }}/>
          <button className="w-7 h-7 flex items-center justify-center rounded-md transition hover:opacity-70" style={{ color:"#78716C" }}>
            <Settings size={14}/>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {view === "dashboard" ? (
          <DashboardView projects={projects} onOpen={openProject} onNewProject={() => setShowNewProject(true)}/>
        ) : (
          <WorkspaceView activeProject={activeProject} sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded}
            onNewChart={() => setShowNewChart(true)} showToast={showToast}/>
        )}
      </div>

      {showNewChart && <NewChartModal project={activeProject} onClose={() => setShowNewChart(false)} onCreate={() => { setShowNewChart(false); showToast("已创建新图表"); }}/>}
      {showNewProject && <NewProjectModal projects={projects} onClose={() => setShowNewProject(false)} onCreate={() => { setShowNewProject(false); showToast("项目已创建"); }}/>}

      {toast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-md flex items-center gap-2 slide-in z-50"
          style={{ background:"#1C1917", color:"#F5F1EA", fontSize:12.5, boxShadow:"0 10px 30px rgba(0,0,0,0.2)" }}>
          <Check size={13} color="#0F766E"/>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
//  DASHBOARD
// ───────────────────────────────────────────────────────────

function DashboardView({ projects, onOpen, onNewProject }) {
  return (
    <div className="h-full overflow-y-auto fade-in">
      <div className="max-w-6xl mx-auto px-10 py-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="mb-2" style={{ fontSize:11, fontFamily:"JetBrains Mono, monospace", letterSpacing:"0.15em", color:"#A8A29E" }}>
              WORKSPACE · 4 PROJECTS · 30 CHARTS
            </div>
            <h1 style={{ fontSize:42, lineHeight:1, letterSpacing:"-0.02em", fontFamily:"Fraunces, serif", fontWeight:400 }}>
              学术图表 <em style={{ fontStyle:"italic", fontWeight:500 }}>工作室</em>
            </h1>
            <p className="mt-3 max-w-md" style={{ fontSize:14, color:"#57534E" }}>
              用 matplotlib + PGF 输出投稿级 PDF。每次编辑 git 自动留痕，像 Overleaf 一样可回溯。
            </p>
          </div>
          <button onClick={onNewProject} className="flex items-center gap-2 px-4 py-2.5 rounded-md font-medium transition hover:opacity-90 flex-shrink-0"
            style={{ fontSize:13, background:"#1C1917", color:"#F5F1EA" }}>
            <Plus size={14}/>新建项目
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2 rounded-md px-3 py-2" style={{ background:"#FFFFFF", border:"1px solid #E7E0D1" }}>
          <Search size={14} style={{ color:"#A8A29E" }}/>
          <input placeholder="搜索项目或图表…" className="flex-1 outline-none bg-transparent" style={{ fontSize:13 }}/>
          <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ fontSize:10.5, background:"#F5F1EA", color:"#A8A29E" }}>⌘K</kbd>
        </div>

        <div className="flex items-center gap-2 mb-4" style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.15em", color:"#78716C" }}>
          <FolderOpen size={12}/><span>全部项目</span>
          <div className="flex-1 h-px ml-3" style={{ background:"#E7E0D1" }}/>
        </div>

        <div className="grid gap-5" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))" }}>
          {projects.map(p => <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)}/>)}
          <NewProjectCard onClick={onNewProject}/>
        </div>

        <div className="mt-12 text-center" style={{ fontSize:11, color:"#A8A29E" }}>
          每个项目是独立 git 仓库 · <span className="font-mono" style={{ color:"#78716C" }}>~/plotsmith/projects/</span>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onOpen }) {
  return (
    <button onClick={onOpen} className="group text-left rounded-xl overflow-hidden transition hover:-translate-y-0.5"
      style={{ background:"#FFFFFF", border:"1px solid #E7E0D1", boxShadow:"0 1px 2px rgba(28,25,23,0.03)" }}>
      <div className="flex" style={{ height:96, background:"#FAF6ED" }}>
        {project.recentStyles.map((s,i) => (
          <div key={i} className="flex-1 p-1.5 overflow-hidden" style={{ borderRight: i < project.recentStyles.length-1 ? "1px solid #F1ECE0" : "none" }}>
            <div className="w-full h-full scale-90 origin-center"><ChartMock style={s}/></div>
          </div>
        ))}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 style={{ fontSize:16, lineHeight:1.2, fontFamily:"Fraunces, serif", fontWeight:500 }}>{project.name}</h3>
          {project.starred && <Star size={13} fill="#F59E0B" color="#F59E0B" className="flex-shrink-0 mt-0.5"/>}
        </div>
        <p className="mb-3" style={{ fontSize:12, color:"#78716C" }}>{project.tagline}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {project.palette.map((c,i) => <div key={i} className="w-3.5 h-3.5 rounded-sm" style={{ background:c, border:"1px solid rgba(0,0,0,0.08)" }}/>)}
          </div>
          <div className="flex items-center gap-2.5 font-mono" style={{ fontSize:10.5, color:"#A8A29E" }}>
            <span>{project.chartCount} charts</span><span>·</span><span>{project.lastModified}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function NewProjectCard({ onClick }) {
  return (
    <button onClick={onClick} className="group rounded-xl transition hover:-translate-y-0.5 flex flex-col items-center justify-center gap-2"
      style={{ border:"1.5px dashed #D6CFC2", background:"rgba(255,255,255,0.3)", minHeight:236 }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center transition group-hover:scale-110" style={{ background:"#F5F1EA", border:"1px solid #E7E0D1" }}>
        <Plus size={18} style={{ color:"#78716C" }}/>
      </div>
      <div style={{ fontSize:13, fontFamily:"Fraunces, serif", fontStyle:"italic", color:"#44403C", fontWeight:500 }}>新建项目</div>
      <div style={{ fontSize:11, color:"#A8A29E" }}>从空白开始 · 或复制已有</div>
    </button>
  );
}

// ───────────────────────────────────────────────────────────
//  WORKSPACE
// ───────────────────────────────────────────────────────────

function WorkspaceView({ activeProject, sidebarExpanded, setSidebarExpanded, onNewChart, showToast }) {
  const [versions, setVersions] = useState(initialVersions);
  const [selectedId, setSelectedId] = useState("v4");
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareId, setCompareId] = useState("v1");
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeChartId, setActiveChartId] = useState("001");

  // Direct manipulation state
  const [legendOffset, setLegendOffset] = useState({ dx:0, dy:0 });
  const [hoveredEl, setHoveredEl] = useState(null);
  const [latexEditor, setLatexEditor] = useState(null);
  const [titleLatex, setTitleLatex] = useState("\\alpha_i = \\sum_{j} \\beta_{ij} \\cdot x_j");
  const [activePalette, setActivePalette] = useState({ id:"okabe", colors:academicPalettes["色盲友好"][0].colors });
  const [rightTab, setRightTab] = useState("chat");
  const [gitStatus, setGitStatus] = useState("saved"); // pending | saving | saved
  const [pendingAction, setPendingAction] = useState(null);
  const [showElementBorders, setShowElementBorders] = useState(true);

  const selected = versions.find(v => v.id === selectedId);

  // Git debounce: when pending, wait 1.2s then save
  useEffect(() => {
    if (gitStatus !== "pending") return;
    const t = setTimeout(() => {
      setGitStatus("saving");
      setTimeout(() => setGitStatus("saved"), 600);
    }, 1200);
    return () => clearTimeout(t);
  }, [gitStatus, pendingAction]);

  const markPending = (action) => {
    setGitStatus("pending");
    setPendingAction(action);
  };

  const toggleStar = (id) => setVersions(vs => vs.map(v => v.id === id ? { ...v, starred:!v.starred } : v));
  const deleteVersion = (id) => {
    if (versions.length <= 1) return;
    setVersions(vs => vs.filter(v => v.id !== id));
    if (selectedId === id) setSelectedId(versions[versions.length-2].id);
    showToast("版本已删除");
  };

  const submitPrompt = (text) => {
    if (!text.trim()) return;
    const newId = `v${versions.length + 1}`;
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    setMessages(m => [...m, { role:"user", text }]);
    setInput("");
    setGenerating(true);
    setTimeout(() => {
      setVersions(vs => [...vs, { id:newId, timestamp:ts, label:text.slice(0,8), note:text, style:"polished", starred:false }]);
      setMessages(m => [...m, { role:"system", text:`已生成 ${newId}`, versionId:newId }]);
      setSelectedId(newId);
      setGenerating(false);
      markPending("claude");
    }, 1800);
  };

  return (
    <div className="h-full grid overflow-hidden fade-in" style={{ gridTemplateColumns:`${sidebarExpanded?"200px":"48px"} 300px 1fr 360px` }}>
      <ProjectSidebar expanded={sidebarExpanded} setExpanded={setSidebarExpanded} project={activeProject}
        activeChartId={activeChartId} setActiveChartId={setActiveChartId} onNewChart={onNewChart}/>

      {/* DATA PANEL */}
      <aside className="flex flex-col border-r overflow-hidden" style={{ borderColor:"#E7E0D1" }}>
        <SectionHeader num="01" title="数据" subtitle="粘贴 · 清洗"/>
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <div className="rounded-md border-2 border-dashed p-3 mb-4" style={{ borderColor:"#D6CFC2", background:"rgba(255,255,255,0.4)" }}>
            <div className="flex items-center gap-2" style={{ fontSize:12, color:"#57534E" }}>
              <Clipboard size={13}/><span>从 Excel 粘贴 · 或上传</span><Upload size={12} className="ml-auto"/>
            </div>
          </div>

          <div className="rounded-md overflow-hidden border" style={{ borderColor:"#E7E0D1", background:"#FFFFFF" }}>
            <table className="w-full" style={{ fontSize:12, fontFamily:"JetBrains Mono, monospace" }}>
              <thead>
                <tr style={{ background:"#FAF6ED", borderBottom:"1px solid #E7E0D1" }}>
                  {["月份","销售额","利润"].map(h => <th key={h} className="px-2 py-2 text-left" style={{ fontSize:11, fontWeight:500, color:"#57534E" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i<tableData.length-1 ? "1px solid #F1ECE0" : "none" }}>
                    <td className="px-2 py-1.5" contentEditable suppressContentEditableWarning style={{ outline:"none" }} onBlur={() => markPending("data")}>{row.month}</td>
                    <td className="px-2 py-1.5" contentEditable suppressContentEditableWarning style={{ outline:"none" }} onBlur={() => markPending("data")}>{row.sales}</td>
                    <td className="px-2 py-1.5" contentEditable suppressContentEditableWarning style={{ outline:"none" }} onBlur={() => markPending("data")}>{row.profit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-md px-3 py-2.5 flex items-start gap-2" style={{ fontSize:11.5, background:"rgba(15,118,110,0.06)", border:"1px solid rgba(15,118,110,0.15)" }}>
            <Info size={13} style={{ color:"#0F766E", marginTop:2, flexShrink:0 }}/>
            <div style={{ color:"#134E4A" }}>
              <div style={{ fontWeight:500 }}>列式 · 3 组数据</div>
              <div className="mt-0.5" style={{ color:"#0F766E" }}>已填充 2 处合并单元格</div>
            </div>
          </div>

          <div className="mt-3 rounded-md px-3 py-2.5 flex items-start gap-2" style={{ fontSize:11.5, background:"rgba(180,83,9,0.06)", border:"1px solid rgba(180,83,9,0.18)" }}>
            <FolderOpen size={13} style={{ color:"#B45309", marginTop:2, flexShrink:0 }}/>
            <div style={{ color:"#78350F" }}>
              <div style={{ fontWeight:500 }}>继承自项目</div>
              <div className="mt-0.5 flex items-center gap-1.5" style={{ color:"#B45309" }}>
                {activeProject.palette.slice(0,2).map((c,i) => <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background:c }}/>)}
                <span>· {activeProject.fontFamily}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md transition hover:opacity-80" style={{ fontSize:12, border:"1px solid #D6CFC2", color:"#44403C" }}>
              <ArrowLeftRight size={13}/>转置
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md transition hover:opacity-80" style={{ fontSize:12, border:"1px solid #D6CFC2", color:"#44403C" }}>
              <RefreshCw size={13}/>重解析
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-t" style={{ borderColor:"#E7E0D1", background:"rgba(255,255,255,0.4)" }}>
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition hover:opacity-90" style={{ fontSize:13, background:"#1C1917", color:"#F5F1EA" }}>
            <Sparkles size={14}/>生成新图表
          </button>
        </div>
      </aside>

      {/* CENTER: PREVIEW */}
      <main className="flex flex-col overflow-hidden relative">
        <SectionHeader num="02" title="预览" subtitle={`${selectedId} · ${selected?.label}`} right={
          <div className="flex items-center gap-1.5">
            <GitStatusBadge status={gitStatus} action={pendingAction}/>
            <div className="w-px h-4" style={{ background:"#D6CFC2" }}/>
            <ChartToolbarBtn title="显示/隐藏编辑框" icon={showElementBorders ? Eye : EyeOff} onClick={() => setShowElementBorders(!showElementBorders)} active={showElementBorders}/>
            <ChartToolbarBtn title="撤销" icon={Undo2}/>
            <ChartToolbarBtn title="重做" icon={Redo2}/>
            <div className="w-px h-4 mx-0.5" style={{ background:"#D6CFC2" }}/>
            <button onClick={() => setCompareMode(!compareMode)} className="flex items-center gap-1 px-2 py-1 rounded-md transition"
              style={{ fontSize:11, background: compareMode?"#1C1917":"transparent", color: compareMode?"#F5F1EA":"#78716C", border: compareMode?"1px solid #1C1917":"1px solid #D6CFC2" }}>
              <SplitSquareHorizontal size={11}/>对比
            </button>
          </div>
        }/>

        <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6 pt-4">
          <div className="flex-1 relative rounded-xl overflow-hidden chart-shadow" style={{ background:"#FFFFFF", border:"1px solid #E7E0D1" }}>
            <div className="absolute top-3 left-4 flex items-center gap-2 z-10 font-mono" style={{ fontSize:10.5, color:"#A8A29E" }}>
              <span>plot.py</span><span style={{ color:"#D6CFC2" }}>·</span><span>{selected?.timestamp}</span>
              {selected?.starred && <Star size={11} fill="#F59E0B" color="#F59E0B"/>}
            </div>
            <div className="absolute top-3 right-4 flex items-center gap-1 z-10">
              <IconBtn title="查看代码" icon={Copy}/>
              <IconBtn title="候选" icon={Star} active={selected?.starred} onClick={() => toggleStar(selectedId)}/>
              <IconBtn title="删除" icon={Trash2} onClick={() => deleteVersion(selectedId)}/>
            </div>

            {compareMode ? (
              <div className="absolute inset-0 grid grid-cols-2 divide-x" style={{ borderColor:"#E7E0D1" }}>
                <div className="p-6 pt-10 flex flex-col">
                  <div className="mb-2 font-mono" style={{ fontSize:10.5, color:"#78716C" }}>{compareId}</div>
                  <div className="flex-1"><ChartMock style={versions.find(v => v.id===compareId)?.style || "default"}/></div>
                </div>
                <div className="p-6 pt-10 flex flex-col" style={{ borderColor:"#E7E0D1" }}>
                  <div className="mb-2 font-mono" style={{ fontSize:10.5, color:"#78716C" }}>{selectedId} (当前)</div>
                  <div className="flex-1"><InteractiveChart style={selected?.style} legendOffset={legendOffset} setLegendOffset={setLegendOffset} hoveredEl={hoveredEl} setHoveredEl={setHoveredEl} titleLatex={titleLatex} palette={activePalette.colors} markPending={markPending} setLatexEditor={setLatexEditor} showBorders={showElementBorders}/></div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 p-8 pt-10">
                <InteractiveChart style={selected?.style} legendOffset={legendOffset} setLegendOffset={setLegendOffset} hoveredEl={hoveredEl} setHoveredEl={setHoveredEl} titleLatex={titleLatex} palette={activePalette.colors} markPending={markPending} setLatexEditor={setLatexEditor} showBorders={showElementBorders}/>
              </div>
            )}

            {generating && (
              <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ background:"rgba(245,241,234,0.7)" }}>
                <div className="text-center">
                  <div className="pulse-soft" style={{ fontSize:13, letterSpacing:"0.02em", fontWeight:500 }}>Claude Code 正在生成…</div>
                  <div className="mt-2 font-mono" style={{ fontSize:11, color:"#78716C" }}>分析 → 应用反馈 → 执行</div>
                </div>
              </div>
            )}

            {/* Hint overlay */}
            {showElementBorders && hoveredEl === null && !compareMode && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md" style={{ fontSize:10.5, background:"rgba(28,25,23,0.85)", color:"#F5F1EA", fontFamily:"JetBrains Mono, monospace" }}>
                hover 元素可编辑 · 拖动图例 · 双击标题改 LaTeX
              </div>
            )}
          </div>

          {/* Version timeline */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2" style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.15em", color:"#78716C" }}>
                <GitBranch size={12}/><span>版本历史</span>
              </div>
              {compareMode && <div className="font-mono" style={{ fontSize:10.5, color:"#78716C" }}>选择左侧对比版本 →</div>}
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {versions.map(v => {
                const isSelected = v.id === selectedId;
                const isCompare = compareMode && v.id === compareId;
                return (
                  <button key={v.id} onClick={() => compareMode ? setCompareId(v.id) : setSelectedId(v.id)}
                    className="flex-shrink-0 rounded-lg overflow-hidden text-left transition"
                    style={{ width:130, border: isSelected?"1.5px solid #1C1917":isCompare?"1.5px solid #0F766E":"1px solid #E7E0D1", background:"#FFFFFF" }}>
                    <div className="w-full flex items-center justify-center" style={{ height:68, background:"#FAFAF8" }}>
                      <div className="w-full h-full p-1"><ChartMock style={v.style}/></div>
                    </div>
                    <div className="px-2 py-1.5 border-t" style={{ borderColor:"#F1ECE0" }}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono" style={{ fontSize:11, fontWeight:500, color: isSelected?"#1C1917":"#57534E" }}>{v.id}</span>
                        {v.starred && <Star size={10} fill="#F59E0B" color="#F59E0B"/>}
                        <span className="font-mono ml-auto" style={{ fontSize:9.5, color:"#A8A29E" }}>{v.timestamp}</span>
                      </div>
                      <div className="mt-0.5 truncate" style={{ fontSize:10.5, color:"#78716C" }}>{v.note}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* RIGHT PANEL */}
      <RightPanel
        tab={rightTab} setTab={setRightTab}
        messages={messages} input={input} setInput={setInput} submitPrompt={submitPrompt} generating={generating}
        setSelectedId={setSelectedId} onFinalize={() => setShowFinalModal(true)} onExport={() => showToast("已导出 PDF (PGF)")}
        activePalette={activePalette} setActivePalette={(p) => { setActivePalette(p); markPending("palette"); }}
        onRestore={(hash) => showToast(`已恢复到 ${hash}`)}
      />

      {/* LaTeX Editor */}
      {latexEditor && (
        <LatexEditor
          initial={latexEditor.value}
          target={latexEditor.target}
          onClose={() => setLatexEditor(null)}
          onApply={(val) => { setTitleLatex(val); setLatexEditor(null); markPending("latex"); }}
        />
      )}

      {showFinalModal && (
        <div className="absolute inset-0 flex items-center justify-center z-50 slide-in" style={{ background:"rgba(28,25,23,0.4)", backdropFilter:"blur(6px)" }}>
          <div className="rounded-xl p-6 max-w-md w-full mx-6" style={{ background:"#FAF6ED", border:"1px solid #E7E0D1", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} fill="#B45309" color="#B45309"/>
              <h3 style={{ fontSize:16, fontWeight:500, fontFamily:"Fraunces, serif" }}>设为最终版本</h3>
            </div>
            <p className="mb-4" style={{ fontSize:13, color:"#57534E" }}>
              当前为 <span className="font-mono" style={{ fontWeight:500 }}>{selectedId}</span> · {selected?.label}
            </p>
            <div className="space-y-2 mb-5">
              <ModalOption checked label="导出 PDF (PGF 后端)" desc="LaTeX 渲染文字 · 投稿级矢量输出"/>
              <ModalOption checked label="保留 plot.py 和 data.csv" desc="用于复现或二次修改"/>
              <ModalOption checked label="提取样式到项目共享" desc="后续新图可继承"/>
              <ModalOption label="Git 打标签" desc={`v4-submitted · 永久锚点`}/>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFinalModal(false)} className="flex-1 px-3 py-2 rounded-md transition" style={{ fontSize:12.5, border:"1px solid #D6CFC2", color:"#57534E" }}>取消</button>
              <button onClick={() => { setShowFinalModal(false); showToast("已定稿并导出 PDF"); }} className="flex-1 px-3 py-2 rounded-md font-medium transition" style={{ fontSize:12.5, background:"#1C1917", color:"#F5F1EA" }}>确认定稿</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
//  INTERACTIVE CHART (with direct manipulation)
// ───────────────────────────────────────────────────────────

function InteractiveChart({ style, legendOffset, setLegendOffset, hoveredEl, setHoveredEl, titleLatex, palette, markPending, setLatexEditor, showBorders }) {
  const svgRef = useRef(null);
  const [dragStart, setDragStart] = useState(null);

  const W = 640, H = 400, mL = 60, mR = 24;
  const mT = 60, mB = 56;
  const pW = W - mL - mR, pH = H - mT - mB, max = 200;
  const gW = pW / tableData.length, bW = gW * 0.38, gap = 2;
  const ticks = [0,50,100,150,200];

  const salesColor = palette[0] || "#0F766E";
  const profitColor = palette[1] || "#F59E0B";

  // Legend drag
  useEffect(() => {
    if (!dragStart) return;
    const onMove = (e) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = W / rect.width;
      const dx = (e.clientX - dragStart.clientX) * scale + dragStart.initDx;
      const dy = (e.clientY - dragStart.clientY) * scale + dragStart.initDy;
      setLegendOffset({ dx, dy });
    };
    const onUp = () => {
      setDragStart(null);
      markPending("legend-move");
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragStart]);

  const startLegendDrag = (e) => {
    e.stopPropagation();
    setDragStart({ clientX:e.clientX, clientY:e.clientY, initDx:legendOffset.dx, initDy:legendOffset.dy });
  };

  const openLatexEditor = (target, value) => {
    setLatexEditor({ target, value });
  };

  const baseLegendX = mL + pW - 150;
  const baseLegendY = mT + 8;
  const legX = baseLegendX + legendOffset.dx;
  const legY = baseLegendY + legendOffset.dy;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet"
      style={{ userSelect:"none" }}>
      <rect width={W} height={H} fill="#FFFFFF" />

      {/* Title - LaTeX rendered */}
      <foreignObject x={60} y={12} width={W-120} height={40} onMouseEnter={() => setHoveredEl("title")} onMouseLeave={() => setHoveredEl(null)} onDoubleClick={() => openLatexEditor("title", titleLatex)} style={{ cursor:"text" }}>
        <div className="h-full w-full flex items-center justify-center" style={{ position:"relative" }}>
          <div className="latex-text" style={{ fontSize:19, color:"#1C1917" }} dangerouslySetInnerHTML={{ __html: renderLatex(titleLatex) }}/>
        </div>
      </foreignObject>
      {showBorders && hoveredEl === "title" && (
        <g pointerEvents="none">
          <rect x={60} y={12} width={W-120} height={40} className="element-outline"/>
          <rect x={60} y={-6} width={90} height={14} fill="#B45309"/>
          <text x={64} y={4} fontSize={9} fill="#FFFBEB" fontFamily="JetBrains Mono, monospace">TITLE · 双击改 LaTeX</text>
        </g>
      )}

      {/* Grid */}
      {(style==="grid" || style==="polished") && ticks.map(t => {
        const y = mT + pH - (t/max)*pH;
        return <line key={t} x1={mL} x2={mL+pW} y1={y} y2={y} stroke="#E7E5E4" strokeWidth={1}/>;
      })}

      {/* Y ticks & axis */}
      {ticks.map(t => {
        const y = mT + pH - (t/max)*pH;
        return (
          <g key={t}>
            <line x1={mL-4} x2={mL} y1={y} y2={y} stroke="#1C1917"/>
            <text x={mL-8} y={y+4} textAnchor="end" fontSize={12} fontFamily="JetBrains Mono, monospace" fill="#1C1917">{t}</text>
          </g>
        );
      })}
      <line x1={mL} x2={mL} y1={mT} y2={mT+pH} stroke="#1C1917"/>
      <line x1={mL} x2={mL+pW} y1={mT+pH} y2={mT+pH} stroke="#1C1917"/>

      {/* Axis labels */}
      <g onMouseEnter={() => setHoveredEl("xlabel")} onMouseLeave={() => setHoveredEl(null)} onDoubleClick={() => openLatexEditor("xlabel","month")} style={{ cursor:"text" }}>
        <text x={mL+pW/2} y={H-14} textAnchor="middle" fontSize={13} fontFamily="Cormorant Garamond, serif" fontStyle="italic" fill="#1C1917">month</text>
        {showBorders && hoveredEl === "xlabel" && <rect x={mL+pW/2-40} y={H-28} width={80} height={20} className="element-outline"/>}
      </g>
      <g onMouseEnter={() => setHoveredEl("ylabel")} onMouseLeave={() => setHoveredEl(null)} onDoubleClick={() => openLatexEditor("ylabel","y_{value}")} style={{ cursor:"text" }}>
        <foreignObject x={2} y={mT+pH/2-40} width={20} height={80}>
          <div className="h-full flex items-center justify-center latex-text" style={{ fontSize:13, color:"#1C1917", transform:"rotate(-90deg)", whiteSpace:"nowrap" }}>
            <span dangerouslySetInnerHTML={{ __html: renderLatex("y_{value}") }}/>
          </div>
        </foreignObject>
        {showBorders && hoveredEl === "ylabel" && <rect x={2} y={mT+pH/2-40} width={20} height={80} className="element-outline"/>}
      </g>

      {/* Bars */}
      {tableData.map((d, i) => {
        const x = mL + i*gW + gW/2;
        const sH = (d.sales/max)*pH, pHt = (d.profit/max)*pH;
        return (
          <g key={i}>
            <rect x={x-bW-gap/2} y={mT+pH-sH} width={bW} height={sH} fill={salesColor}
              onMouseEnter={() => setHoveredEl(`bar-s-${i}`)} onMouseLeave={() => setHoveredEl(null)}
              style={{ cursor:"pointer" }}/>
            <rect x={x+gap/2} y={mT+pH-pHt} width={bW} height={pHt} fill={profitColor}
              onMouseEnter={() => setHoveredEl(`bar-p-${i}`)} onMouseLeave={() => setHoveredEl(null)}
              style={{ cursor:"pointer" }}/>
            <text x={x} y={mT+pH+18} textAnchor="middle" fontSize={12} fontFamily="Cormorant Garamond, serif" fontStyle="italic" fill="#1C1917">{d.month}</text>
            {showBorders && hoveredEl === `bar-s-${i}` && (
              <rect x={x-bW-gap/2-1} y={mT+pH-sH-1} width={bW+2} height={sH+2} className="element-outline"/>
            )}
            {showBorders && hoveredEl === `bar-p-${i}` && (
              <rect x={x+gap/2-1} y={mT+pH-pHt-1} width={bW+2} height={pHt+2} className="element-outline"/>
            )}
          </g>
        );
      })}

      {/* Legend (draggable) */}
      <g transform={`translate(${legX}, ${legY})`} onMouseEnter={() => setHoveredEl("legend")} onMouseLeave={() => setHoveredEl(null)}
        onMouseDown={startLegendDrag} style={{ cursor: dragStart?"grabbing":"grab" }}>
        <rect x={-6} y={-6} width={146} height={42} fill="rgba(255,255,255,0.9)" stroke={showBorders && hoveredEl==="legend" ? "#B45309" : "transparent"} strokeWidth={1} strokeDasharray="3 3" rx={2}/>
        <rect width={14} height={14} fill={salesColor}/>
        <text x={20} y={11} fontSize={12} fontFamily="Cormorant Garamond, serif" fontStyle="italic" fill="#1C1917">sales</text>
        <rect y={20} width={14} height={14} fill={profitColor}/>
        <text x={20} y={31} fontSize={12} fontFamily="Cormorant Garamond, serif" fontStyle="italic" fill="#1C1917">profit</text>
        {showBorders && hoveredEl === "legend" && !dragStart && (
          <g pointerEvents="none">
            <rect x={-6} y={-22} width={76} height={14} fill="#B45309"/>
            <text x={-2} y={-12} fontSize={9} fill="#FFFBEB" fontFamily="JetBrains Mono, monospace">LEGEND · 拖动</text>
            <Move x={56} y={-20} width={10} height={10}/>
          </g>
        )}
        {dragStart && (
          <g pointerEvents="none" transform={`translate(-${legX},-${legY})`}>
            <text x={legX+70} y={legY-10} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="#B45309" textAnchor="middle">
              ({legendOffset.dx.toFixed(0)}, {legendOffset.dy.toFixed(0)})
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}

// Plain chart for thumbnails
function ChartMock({ style }) {
  const p = { default:{s:"#6B7280",p:"#D1D5DB",a:"#374151",g:null}, blue:{s:"#1E3A8A",p:"#60A5FA",a:"#1F2937",g:null}, grid:{s:"#1E3A8A",p:"#60A5FA",a:"#1F2937",g:"#E5E7EB"}, polished:{s:"#0F766E",p:"#F59E0B",a:"#1C1917",g:"#E7E5E4"} }[style] || { s:"#6B7280",p:"#D1D5DB",a:"#374151",g:null };
  const W=640, H=400, mL=60, mR=24, mT=style==="polished"?50:24, mB=style==="polished"?56:36;
  const pW=W-mL-mR, pH=H-mT-mB, max=200;
  const gW=pW/tableData.length, bW=gW*0.38, gap=2;
  const ticks=[0,50,100,150,200];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <rect width={W} height={H} fill="#FFFFFF"/>
      {style==="polished" && <text x={W/2} y={28} textAnchor="middle" fontFamily="Fraunces, serif" fontSize={18} fontWeight={500} fill={p.a}>上半年销售与利润</text>}
      {p.g && ticks.map(t => { const y=mT+pH-(t/max)*pH; return <line key={t} x1={mL} x2={mL+pW} y1={y} y2={y} stroke={p.g} strokeWidth={1}/>; })}
      {ticks.map(t => { const y=mT+pH-(t/max)*pH; return <g key={t}><line x1={mL-4} x2={mL} y1={y} y2={y} stroke={p.a}/><text x={mL-8} y={y+4} textAnchor="end" fontSize={12} fill={p.a}>{t}</text></g>; })}
      <line x1={mL} x2={mL} y1={mT} y2={mT+pH} stroke={p.a}/>
      <line x1={mL} x2={mL+pW} y1={mT+pH} y2={mT+pH} stroke={p.a}/>
      {tableData.map((d,i) => { const x=mL+i*gW+gW/2, sH=(d.sales/max)*pH, pHt=(d.profit/max)*pH;
        return <g key={i}><rect x={x-bW-gap/2} y={mT+pH-sH} width={bW} height={sH} fill={p.s}/><rect x={x+gap/2} y={mT+pH-pHt} width={bW} height={pHt} fill={p.p}/></g>; })}
    </svg>
  );
}

// ───────────────────────────────────────────────────────────
//  GIT STATUS BADGE
// ───────────────────────────────────────────────────────────

function GitStatusBadge({ status, action }) {
  const cfg = {
    pending: { text:"等待提交", color:"#B45309", bg:"rgba(180,83,9,0.1)", icon:Clock },
    saving:  { text:"提交中", color:"#0F766E", bg:"rgba(15,118,110,0.1)", icon:RefreshCw, spin:true },
    saved:   { text:"已保存", color:"#57534E", bg:"transparent", icon:Check },
  }[status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ fontSize:10.5, background:cfg.bg, color:cfg.color, fontFamily:"JetBrains Mono, monospace" }}>
      <Icon size={10.5} className={cfg.spin ? "spin" : ""}/>
      <span>{cfg.text}</span>
      {status === "pending" && action && <span style={{ opacity:0.7 }}>· {action}</span>}
    </div>
  );
}

function ChartToolbarBtn({ title, icon:Icon, onClick, active }) {
  return (
    <button title={title} onClick={onClick} className="w-6 h-6 flex items-center justify-center rounded transition hover:opacity-70"
      style={{ background: active?"rgba(15,118,110,0.1)":"transparent", color: active?"#0F766E":"#78716C" }}>
      <Icon size={12}/>
    </button>
  );
}

// ───────────────────────────────────────────────────────────
//  RIGHT PANEL (tabbed)
// ───────────────────────────────────────────────────────────

function RightPanel({ tab, setTab, messages, input, setInput, submitPrompt, generating, setSelectedId, onFinalize, onExport, activePalette, setActivePalette, onRestore }) {
  return (
    <aside className="flex flex-col border-l overflow-hidden" style={{ borderColor:"#E7E0D1", background:"rgba(255,253,249,0.5)" }}>
      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor:"#E7E0D1" }}>
        {[
          { id:"chat", icon:MessageSquare, label:"对话" },
          { id:"history", icon:History, label:"历史" },
          { id:"palette", icon:Palette, label:"配色" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 transition"
            style={{ fontSize:12, fontWeight: tab===t.id?500:400, color: tab===t.id?"#1C1917":"#78716C",
              borderBottom: tab===t.id?"2px solid #1C1917":"2px solid transparent", marginBottom:-1 }}>
            <t.icon size={12}/>{t.label}
          </button>
        ))}
      </div>

      {tab === "chat" && <ChatTab messages={messages} input={input} setInput={setInput} submitPrompt={submitPrompt} generating={generating} setSelectedId={setSelectedId} onFinalize={onFinalize} onExport={onExport}/>}
      {tab === "history" && <HistoryTab onRestore={onRestore}/>}
      {tab === "palette" && <PaletteTab activePalette={activePalette} setActivePalette={setActivePalette}/>}
    </aside>
  );
}

function ChatTab({ messages, input, setInput, submitPrompt, generating, setSelectedId, onFinalize, onExport }) {
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, generating]);

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2">
        {messages.map((msg, i) => (
          <div key={i} className="mb-3 slide-in">
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 rounded-lg" style={{ fontSize:12.5, lineHeight:1.5, background:"#1C1917", color:"#F5F1EA" }}>{msg.text}</div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: msg.inherit?"rgba(180,83,9,0.15)":"#F5F1EA", border:`1px solid ${msg.inherit?"rgba(180,83,9,0.3)":"#E7E0D1"}` }}>
                  {msg.inherit ? <FolderOpen size={9} color="#B45309"/> : <Sparkles size={10} color="#78716C"/>}
                </div>
                <div className="flex-1">
                  <div style={{ fontSize:12.5, lineHeight:1.5, color: msg.inherit?"#78350F":"#44403C" }}>{msg.text}</div>
                  {msg.versionId && !msg.inherit && (
                    <button onClick={() => setSelectedId(msg.versionId)} className="mt-1 font-mono underline" style={{ fontSize:10.5, color:"#0F766E" }}>
                      跳到 {msg.versionId} →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {generating && (
          <div className="flex items-start gap-2 slide-in">
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background:"#F5F1EA", border:"1px solid #E7E0D1" }}>
              <Sparkles size={10} color="#78716C" className="pulse-soft"/>
            </div>
            <div className="flex gap-1 mt-1.5">
              {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full pulse-soft" style={{ background:"#A8A29E", animationDelay:`${i*0.15}s` }}/>)}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-2 pb-2 border-t" style={{ borderColor:"#F1ECE0" }}>
        <div className="flex flex-wrap gap-1.5">
          {[{i:Palette,l:"换色"},{i:BarChart3,l:"改类型"},{i:Grid3x3,l:"网格"},{i:Sigma,l:"加公式"},{i:Ruler,l:"尺寸"},{i:Languages,l:"字体"}].map(c => (
            <button key={c.l} onClick={() => setInput(c.l)} className="flex items-center gap-1 px-2 py-1 rounded-md transition hover:opacity-80"
              style={{ fontSize:11, background:"#FAF6ED", border:"1px solid #E7E0D1", color:"#57534E" }}>
              <c.i size={10.5}/>{c.l}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t" style={{ borderColor:"#F1ECE0", background:"#FAF6ED" }}>
        <div className="flex items-end gap-2 rounded-lg px-3 py-2" style={{ background:"#FFFFFF", border:"1px solid #E7E0D1" }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key==="Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitPrompt(input); } }}
            placeholder="描述想要的调整…" rows={2}
            className="flex-1 resize-none outline-none bg-transparent" style={{ fontSize:12.5 }}/>
          <button onClick={() => submitPrompt(input)} disabled={!input.trim() || generating}
            className="flex items-center justify-center w-7 h-7 rounded-md transition"
            style={{ background: input.trim()&&!generating?"#1C1917":"#E7E0D1", color: input.trim()&&!generating?"#F5F1EA":"#A8A29E" }}>
            <Send size={13}/>
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 font-mono" style={{ fontSize:10, color:"#A8A29E" }}>
          <span>⌘↵ 发送</span><span>每条消息生成新版本</span>
        </div>
      </div>

      <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor:"#E7E0D1", background:"rgba(245,241,234,0.6)" }}>
        <button onClick={onFinalize} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-medium transition hover:opacity-90"
          style={{ fontSize:12, background:"#B45309", color:"#FFFBEB" }}>
          <Star size={12} fill="#FFFBEB"/>定稿
        </button>
        <button onClick={onExport} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md transition hover:opacity-80"
          style={{ fontSize:12, border:"1px solid #D6CFC2", color:"#44403C" }}>
          <Download size={12}/>PDF
        </button>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────
//  HISTORY TAB (Overleaf-style)
// ───────────────────────────────────────────────────────────

function HistoryTab({ onRestore }) {
  const [selectedHash, setSelectedHash] = useState(null);
  const typeStyle = {
    finalize: { color:"#B45309", bg:"rgba(180,83,9,0.1)", label:"FINAL" },
    claude:   { color:"#0F766E", bg:"rgba(15,118,110,0.1)", label:"AI" },
    direct:   { color:"#1C1917", bg:"rgba(28,25,23,0.08)", label:"EDIT" },
    style:    { color:"#7C3AED", bg:"rgba(124,58,237,0.1)", label:"STYLE" },
    plot:     { color:"#0F766E", bg:"rgba(15,118,110,0.1)", label:"PLOT" },
    data:     { color:"#57534E", bg:"rgba(87,83,78,0.08)", label:"DATA" },
  };

  return (
    <>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor:"#F1ECE0" }}>
        <div>
          <div className="font-mono" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#A8A29E" }}>CURRENT BRANCH</div>
          <div className="mt-0.5 font-mono flex items-center gap-1.5" style={{ fontSize:12, color:"#1C1917", fontWeight:500 }}>
            <GitBranch size={11}/> main
            <span style={{ color:"#A8A29E", fontWeight:400 }}>· {gitHistory.length} commits</span>
          </div>
        </div>
        <button className="w-7 h-7 flex items-center justify-center rounded-md transition hover:opacity-70" title="新建分支" style={{ color:"#78716C" }}>
          <GitBranch size={13}/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative px-4 py-3">
          <div className="absolute left-[22px] top-3 bottom-3 w-px" style={{ background:"#E7E0D1" }}/>
          {gitHistory.map((c, i) => {
            const ts = typeStyle[c.author] || typeStyle[c.type] || typeStyle.plot;
            const isSelected = selectedHash === c.hash;
            const isCurrent = i === 0;
            return (
              <button key={c.hash} onClick={() => setSelectedHash(c.hash)}
                className="w-full flex items-start gap-3 py-2 px-2 rounded-md transition text-left"
                style={{ background: isSelected ? "rgba(28,25,23,0.05)" : "transparent" }}>
                <div className="relative flex-shrink-0 mt-0.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center" style={{ background: isCurrent?"#1C1917":"#FFFFFF", borderColor:"#1C1917" }}>
                    {isCurrent && <div className="w-1 h-1 rounded-full bg-white"/>}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize:9, fontWeight:500, background:ts.bg, color:ts.color }}>{ts.label}</span>
                    <span className="font-mono" style={{ fontSize:10, color:"#A8A29E" }}>{c.hash.slice(0,7)}</span>
                    <span className="font-mono ml-auto" style={{ fontSize:10, color:"#A8A29E" }}>{c.time}</span>
                  </div>
                  <div style={{ fontSize:12, lineHeight:1.4, color: isCurrent?"#1C1917":"#44403C", fontWeight: isCurrent?500:400 }}>
                    {c.msg}
                  </div>
                  {isSelected && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); onRestore(c.hash.slice(0,7)); }}
                        className="flex items-center gap-1 px-2 py-1 rounded transition" style={{ fontSize:10.5, background:"#1C1917", color:"#F5F1EA" }}>
                        <RotateCcw size={9}/>恢复到此
                      </button>
                      <button className="flex items-center gap-1 px-2 py-1 rounded transition" style={{ fontSize:10.5, border:"1px solid #D6CFC2", color:"#57534E" }}>
                        <ArrowLeftRight size={9}/>对比
                      </button>
                      <button className="flex items-center gap-1 px-2 py-1 rounded transition" style={{ fontSize:10.5, color:"#78716C" }}>
                        <FileText size={9}/>diff
                      </button>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor:"#E7E0D1", background:"rgba(245,241,234,0.6)" }}>
        <div className="font-mono" style={{ fontSize:10, color:"#A8A29E" }}>自动提交 · 1.2s 防抖</div>
        <button className="flex items-center gap-1 px-2 py-1 rounded transition hover:opacity-80" style={{ fontSize:11, color:"#44403C" }}>
          <Lock size={11}/>打标签
        </button>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────
//  PALETTE TAB
// ───────────────────────────────────────────────────────────

function PaletteTab({ activePalette, setActivePalette }) {
  return (
    <>
      <div className="px-4 py-3 border-b" style={{ borderColor:"#F1ECE0" }}>
        <div className="font-mono" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#A8A29E" }}>ACTIVE PALETTE</div>
        <div className="flex items-center gap-2 mt-1">
          <div style={{ fontSize:13, fontFamily:"Fraunces, serif", fontWeight:500 }}>{Object.values(academicPalettes).flat().find(p => p.id === activePalette.id)?.name || "自定义"}</div>
          <div className="flex gap-0.5 ml-auto">
            {activePalette.colors.slice(0,8).map((c,i) => <div key={i} className="w-4 h-4 rounded-sm" style={{ background:c, border:"1px solid rgba(0,0,0,0.1)" }}/>)}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {Object.entries(academicPalettes).map(([cat, items]) => (
          <div key={cat} className="px-4 pt-3 pb-1">
            <div className="font-mono mb-2" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>{cat}</div>
            {items.map(p => {
              const isActive = p.id === activePalette.id;
              return (
                <button key={p.id} onClick={() => setActivePalette({ id:p.id, colors:p.colors })}
                  className="w-full flex items-center gap-3 py-2 px-2 rounded-md transition text-left mb-1"
                  style={{ background: isActive?"rgba(15,118,110,0.08)":"transparent", border: isActive?"1px solid rgba(15,118,110,0.3)":"1px solid transparent" }}>
                  <div className="flex h-6 rounded overflow-hidden flex-shrink-0" style={{ width:70, border:"1px solid rgba(0,0,0,0.06)" }}>
                    {p.colors.slice(0,7).map((c,i) => <div key={i} className="flex-1" style={{ background:c }}/>)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize:12, fontWeight: isActive?500:400, color:"#1C1917" }}>{p.name}</div>
                    <div style={{ fontSize:10.5, color:"#78716C" }}>{p.desc}</div>
                  </div>
                  {isActive && <Check size={12} style={{ color:"#0F766E" }}/>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor:"#E7E0D1", background:"rgba(245,241,234,0.6)" }}>
        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md transition hover:opacity-80"
          style={{ fontSize:11.5, border:"1px solid #D6CFC2", color:"#44403C" }}>
          <Plus size={11}/>保存当前配色
        </button>
        <button className="flex items-center justify-center gap-1 px-2 py-2 rounded-md transition hover:opacity-80"
          style={{ fontSize:11.5, border:"1px solid #D6CFC2", color:"#44403C" }} title="灰度预览">
          <EyeOff size={11}/>
        </button>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────
//  LATEX EDITOR (floating popup)
// ───────────────────────────────────────────────────────────

function LatexEditor({ initial, target, onClose, onApply }) {
  const [value, setValue] = useState(initial);
  const [fontFamily, setFontFamily] = useState("Cormorant");
  const [fontSize, setFontSize] = useState(19);
  const insertSymbol = (sym) => setValue(v => v + sym);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 slide-in" style={{ background:"rgba(28,25,23,0.35)", backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div className="rounded-xl w-full max-w-lg mx-6" style={{ background:"#FAF6ED", border:"1px solid #E7E0D1", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor:"#E7E0D1" }}>
          <div className="flex items-center gap-2">
            <Sigma size={14} style={{ color:"#B45309" }}/>
            <div className="font-mono" style={{ fontSize:10.5, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>编辑 · {target}</div>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded transition hover:opacity-70"><X size={13}/></button>
        </div>

        {/* LaTeX source */}
        <div className="px-5 pt-4">
          <label className="font-mono block mb-1.5" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>LaTeX 源</label>
          <textarea value={value} onChange={(e) => setValue(e.target.value)}
            rows={2} autoFocus
            className="w-full px-3 py-2 rounded-md outline-none resize-none"
            style={{ fontSize:13, fontFamily:"JetBrains Mono, monospace", background:"#FFFFFF", border:"1px solid #E7E0D1", color:"#1C1917" }}/>
        </div>

        {/* Rendered preview */}
        <div className="px-5 pt-3">
          <label className="font-mono block mb-1.5" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>渲染预览</label>
          <div className="rounded-md px-4 py-4 flex items-center justify-center min-h-[72px]" style={{ background:"#FFFFFF", border:"1px solid #E7E0D1" }}>
            <div className="latex-text" style={{ fontSize:fontSize, color:"#1C1917" }} dangerouslySetInnerHTML={{ __html: renderLatex(value) }}/>
          </div>
        </div>

        {/* Symbols */}
        <div className="px-5 pt-4">
          <label className="font-mono block mb-1.5" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>常用符号</label>
          <div className="space-y-2">
            {latexSymbols.map(group => (
              <div key={group.cat}>
                <div style={{ fontSize:10, color:"#A8A29E" }}>{group.cat}</div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {group.items.map(it => (
                    <button key={it.l} onClick={() => insertSymbol(it.l)} title={it.l}
                      className="flex items-center justify-center rounded transition hover:opacity-80"
                      style={{ minWidth:28, height:24, padding:"0 6px", fontSize:12, background:"#FFFFFF", border:"1px solid #E7E0D1" }}>
                      <span className="latex-text" style={{ color:"#1C1917" }} dangerouslySetInnerHTML={{ __html: renderLatex(it.s) }}/>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Font controls */}
        <div className="px-5 pt-4 pb-4 flex items-center gap-3">
          <div className="flex-1">
            <label className="font-mono block mb-1" style={{ fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"#78716C" }}>字体</label>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md outline-none" style={{ fontSize:12, background:"#FFFFFF", border:"1px solid #E7E0D1" }}>
              <option>Cormorant</option><option>Computer Modern</option><option>Times New Roman</option><option>Helvetica</option>
            </select>
          </div>
          <div style={{ width:90 }}>
            <label className="font-mono block mb-1" style={{ fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"#78716C" }}>字号</label>
            <input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full px-2 py-1.5 rounded-md outline-none" style={{ fontSize:12, fontFamily:"JetBrains Mono, monospace", background:"#FFFFFF", border:"1px solid #E7E0D1" }}/>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-md transition" style={{ fontSize:12.5, border:"1px solid #D6CFC2", color:"#57534E" }}>取消</button>
          <button onClick={() => onApply(value)} className="flex-1 px-3 py-2 rounded-md font-medium transition" style={{ fontSize:12.5, background:"#1C1917", color:"#F5F1EA" }}>应用</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
//  PROJECT SIDEBAR
// ───────────────────────────────────────────────────────────

function ProjectSidebar({ expanded, setExpanded, project, activeChartId, setActiveChartId, onNewChart }) {
  if (!expanded) {
    return (
      <div className="flex flex-col items-center border-r py-3 gap-2.5" style={{ borderColor:"#E7E0D1", background:"rgba(255,253,249,0.4)" }}>
        <button onClick={() => setExpanded(true)} className="w-8 h-8 flex items-center justify-center rounded-md transition hover:bg-white" title="展开">
          <ChevronRight size={14} style={{ color:"#78716C" }}/>
        </button>
        <div className="w-8 h-8 flex items-center justify-center rounded-md" style={{ background:"#1C1917" }}>
          <FolderOpen size={13} color="#F5F1EA"/>
        </div>
        <div className="w-6 h-px" style={{ background:"#E7E0D1" }}/>
        {projectCharts.slice(0,5).map(c => (
          <button key={c.id} onClick={() => setActiveChartId(c.id)}
            className="w-8 h-8 flex items-center justify-center rounded-md transition"
            style={{ background: c.id===activeChartId?"#FFFFFF":"transparent", border: c.id===activeChartId?"1px solid #E7E0D1":"1px solid transparent" }} title={c.name}>
            <span className="font-mono" style={{ fontSize:10, color: c.id===activeChartId?"#1C1917":"#A8A29E" }}>{c.id}</span>
          </button>
        ))}
        <button onClick={onNewChart} className="w-8 h-8 flex items-center justify-center rounded-md transition hover:bg-white" title="新建图表">
          <Plus size={14} style={{ color:"#78716C" }}/>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col border-r overflow-hidden" style={{ borderColor:"#E7E0D1", background:"rgba(255,253,249,0.4)" }}>
      <div className="px-3 pt-4 pb-3 border-b" style={{ borderColor:"#F1ECE0" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-mono mb-1" style={{ fontSize:10, letterSpacing:"0.15em", color:"#A8A29E" }}>PROJECT</div>
            <h2 className="truncate" style={{ fontSize:13, lineHeight:1.2, fontFamily:"Fraunces, serif", fontWeight:500 }}>{project.name}</h2>
          </div>
          <button onClick={() => setExpanded(false)} className="w-6 h-6 flex items-center justify-center rounded transition hover:opacity-70 flex-shrink-0" title="收起" style={{ color:"#78716C" }}>
            <ChevronLeft size={13}/>
          </button>
        </div>
        <div className="flex items-center gap-1 mt-2">
          {project.palette.map((c,i) => <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background:c, border:"1px solid rgba(0,0,0,0.08)" }}/>)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-2">
        <div className="flex items-center justify-between px-1.5 py-1" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#A8A29E" }}>
          <span>图表 · {projectCharts.length}</span>
          <Clock size={10}/>
        </div>
        {projectCharts.map(c => (
          <button key={c.id} onClick={() => setActiveChartId(c.id)}
            className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-md transition text-left"
            style={{ background: c.id===activeChartId?"#FFFFFF":"transparent", border: c.id===activeChartId?"1px solid #E7E0D1":"1px solid transparent" }}>
            <div className="w-7 h-7 rounded overflow-hidden flex-shrink-0" style={{ background:"#FAFAF8", border:"1px solid #F1ECE0" }}>
              <div className="w-full h-full p-0.5"><ChartMock style={c.style}/></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-mono" style={{ fontSize:9, color:"#A8A29E" }}>{c.id}</span>
                {c.starred && <Star size={8} fill="#F59E0B" color="#F59E0B"/>}
                {!c.final && <div className="w-1 h-1 rounded-full" style={{ background:"#F59E0B" }}/>}
              </div>
              <div className="truncate" style={{ fontSize:11, color: c.id===activeChartId?"#1C1917":"#44403C", fontWeight: c.id===activeChartId?500:400 }}>{c.name}</div>
              <div className="font-mono" style={{ fontSize:9, color:"#A8A29E" }}>{c.versions}v · {c.lastModified}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="px-2 py-2 border-t flex flex-col gap-1.5" style={{ borderColor:"#E7E0D1" }}>
        <button onClick={onNewChart} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition hover:opacity-90" style={{ fontSize:11.5, background:"#1C1917", color:"#F5F1EA" }}>
          <Plus size={12}/>新建图表
        </button>
        <button className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-md transition hover:opacity-70" style={{ fontSize:10.5, color:"#78716C" }}>
          <Settings size={10}/>项目设置
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
//  MODALS
// ───────────────────────────────────────────────────────────

function NewChartModal({ project, onClose, onCreate }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 slide-in" style={{ background:"rgba(28,25,23,0.4)", backdropFilter:"blur(6px)" }} onClick={onClose}>
      <div className="rounded-xl p-6 max-w-lg w-full mx-6" style={{ background:"#FAF6ED", border:"1px solid #E7E0D1", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="font-mono mb-1" style={{ fontSize:10, letterSpacing:"0.15em", color:"#A8A29E" }}>新建图表</div>
            <h3 style={{ fontSize:18, fontWeight:500, fontFamily:"Fraunces, serif" }}>继承自 <em style={{ fontStyle:"italic" }}>{project.name}</em></h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded transition hover:opacity-70"><X size={15}/></button>
        </div>

        <div className="mb-4 mt-3">
          <label className="font-mono block mb-1.5" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>图表名称</label>
          <input defaultValue="Fig.5 补充数据" className="w-full px-3 py-2 rounded-md outline-none" style={{ fontSize:13, background:"#FFFFFF", border:"1px solid #E7E0D1" }}/>
        </div>

        <div className="mb-4">
          <label className="font-mono block mb-2" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>继承项目样式</label>
          <div className="space-y-1.5">
            <ModalOption checked label="配色方案" desc={
              <span className="inline-flex items-center gap-1 mt-0.5">
                {project.palette.map((c,i) => <span key={i} className="inline-block w-3 h-3 rounded-sm" style={{ background:c }}/>)}
              </span>
            }/>
            <ModalOption checked label="字体与字号" desc={project.fontFamily}/>
            <ModalOption checked label="LaTeX 设置" desc="PGF 后端 · Times 字体对齐正文"/>
            <ModalOption checked label="尺寸与 DPI" desc="88mm 单栏 · 300 DPI"/>
            <ModalOption label="参考具体图表" desc="从项目中选一张作为 few-shot"/>
          </div>
        </div>

        <div className="mb-5">
          <label className="font-mono block mb-1.5" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>数据</label>
          <div className="rounded-md border-2 border-dashed p-4 text-center cursor-pointer transition hover:opacity-80" style={{ borderColor:"#D6CFC2", background:"rgba(255,255,255,0.5)" }}>
            <Clipboard size={16} className="mx-auto mb-1.5" style={{ color:"#A8A29E" }}/>
            <div style={{ fontSize:12, color:"#57534E" }}>从 Excel 粘贴 · 或上传</div>
            <div className="mt-0.5" style={{ fontSize:10.5, color:"#A8A29E" }}>也可稍后添加</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-md transition" style={{ fontSize:12.5, border:"1px solid #D6CFC2", color:"#57534E" }}>取消</button>
          <button onClick={onCreate} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-medium transition" style={{ fontSize:12.5, background:"#1C1917", color:"#F5F1EA" }}>
            <Sparkles size={12}/>创建并生成
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProjectModal({ projects, onClose, onCreate }) {
  const [mode, setMode] = useState("blank"); // blank | copy
  const [sourceId, setSourceId] = useState(projects[0].id);
  const source = projects.find(p => p.id === sourceId);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 slide-in" style={{ background:"rgba(28,25,23,0.4)", backdropFilter:"blur(6px)" }} onClick={onClose}>
      <div className="rounded-xl p-6 max-w-lg w-full mx-6" style={{ background:"#FAF6ED", border:"1px solid #E7E0D1", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="font-mono mb-1" style={{ fontSize:10, letterSpacing:"0.15em", color:"#A8A29E" }}>新建项目</div>
            <h3 style={{ fontSize:18, fontWeight:500, fontFamily:"Fraunces, serif" }}>创建图表工作空间</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded transition hover:opacity-70"><X size={15}/></button>
        </div>

        <div className="mb-4 mt-3">
          <label className="font-mono block mb-1.5" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>项目名称</label>
          <input defaultValue="New Paper 2026" className="w-full px-3 py-2 rounded-md outline-none" style={{ fontSize:13, background:"#FFFFFF", border:"1px solid #E7E0D1" }}/>
        </div>

        <div className="mb-4">
          <label className="font-mono block mb-2" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>起始方式</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode("blank")}
              className="flex flex-col items-start p-3 rounded-md transition text-left"
              style={{ background: mode==="blank"?"rgba(15,118,110,0.08)":"#FFFFFF", border: mode==="blank"?"1.5px solid #0F766E":"1px solid #E7E0D1" }}>
              <FileText size={14} style={{ color:"#0F766E", marginBottom:6 }}/>
              <div style={{ fontSize:12.5, fontWeight:500, color:"#1C1917" }}>空白项目</div>
              <div style={{ fontSize:10.5, color:"#78716C", marginTop:2 }}>从零开始</div>
            </button>
            <button onClick={() => setMode("copy")}
              className="flex flex-col items-start p-3 rounded-md transition text-left"
              style={{ background: mode==="copy"?"rgba(15,118,110,0.08)":"#FFFFFF", border: mode==="copy"?"1.5px solid #0F766E":"1px solid #E7E0D1" }}>
              <Copy size={14} style={{ color:"#0F766E", marginBottom:6 }}/>
              <div style={{ fontSize:12.5, fontWeight:500, color:"#1C1917" }}>复制已有</div>
              <div style={{ fontSize:10.5, color:"#78716C", marginTop:2 }}>继承样式与设置</div>
            </button>
          </div>
        </div>

        {mode === "copy" && (
          <div className="mb-4 slide-in">
            <label className="font-mono block mb-1.5" style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#78716C" }}>源项目</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-3 py-2 rounded-md outline-none mb-3" style={{ fontSize:13, background:"#FFFFFF", border:"1px solid #E7E0D1" }}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="space-y-1.5">
              <ModalOption checked label="复制样式" desc={
                <span className="inline-flex items-center gap-1 mt-0.5">
                  {source.palette.map((c,i) => <span key={i} className="inline-block w-3 h-3 rounded-sm" style={{ background:c }}/>)}
                  <span className="ml-1">· {source.fontFamily}</span>
                </span>
              }/>
              <ModalOption checked label="复制 _shared/ 模块" desc="公共 Python 函数与模板"/>
              <ModalOption label="复制图表作为模板" desc={`${source.chartCount} 张图作为 few-shot 示例`}/>
              <ModalOption label="复制数据" desc="通常不建议"/>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-md transition" style={{ fontSize:12.5, border:"1px solid #D6CFC2", color:"#57534E" }}>取消</button>
          <button onClick={onCreate} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-medium transition" style={{ fontSize:12.5, background:"#1C1917", color:"#F5F1EA" }}>
            <Plus size={12}/>创建项目
          </button>
        </div>
        <div className="mt-3 text-center font-mono" style={{ fontSize:10, color:"#A8A29E" }}>
          将在 ~/plotsmith/projects/ 创建新 git 仓库
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
//  SHARED
// ───────────────────────────────────────────────────────────

function SectionHeader({ num, title, subtitle, right }) {
  return (
    <div className="px-5 pt-4 pb-3 flex items-baseline gap-3" style={{ borderBottom:"1px solid #F1ECE0" }}>
      <span className="font-mono" style={{ fontSize:10, letterSpacing:"0.15em", color:"#A8A29E" }}>{num}</span>
      <h2 style={{ fontSize:15, fontFamily:"Fraunces, serif", fontWeight:500, fontStyle:"italic" }}>{title}</h2>
      <span style={{ fontSize:11, color:"#A8A29E" }}>{subtitle}</span>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

function IconBtn({ icon:Icon, title, active, onClick }) {
  return (
    <button title={title} onClick={onClick} className="w-7 h-7 flex items-center justify-center rounded-md transition hover:opacity-70"
      style={{ background: active?"rgba(245,158,11,0.15)":"transparent", color: active?"#B45309":"#78716C" }}>
      <Icon size={13} fill={active?"#F59E0B":"none"}/>
    </button>
  );
}

function ModalOption({ label, desc, checked:initialChecked }) {
  const [checked, setChecked] = useState(initialChecked);
  return (
    <label className="flex items-start gap-2.5 p-2.5 rounded-md cursor-pointer transition"
      style={{ background: checked?"rgba(180,83,9,0.06)":"transparent", border: checked?"1px solid rgba(180,83,9,0.2)":"1px solid transparent" }}>
      <button type="button" onClick={() => setChecked(!checked)}
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition"
        style={{ background: checked?"#B45309":"transparent", border: checked?"1px solid #B45309":"1px solid #D6CFC2" }}>
        {checked && <Check size={10} color="#FFFBEB" strokeWidth={3}/>}
      </button>
      <div className="flex-1">
        <div style={{ fontSize:12.5, fontWeight:500, color:"#1C1917" }}>{label}</div>
        <div className="mt-0.5" style={{ fontSize:11, color:"#78716C" }}>{desc}</div>
      </div>
    </label>
  );
}
