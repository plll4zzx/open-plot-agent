import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { useStore } from '../store'

// ── Theme definitions ─────────────────────────────────────────
// Token `foreground` values must NOT include a `#` prefix (Monaco API quirk).

export const EDITOR_THEMES = [
  {
    id: 'openplot-light',
    label: 'OpenPlot Light',
    dark: false,
    bg: '#F5FAFF',
    swatchColors: ['1A7DC4', '2E8B57', '7A99AE'],
  },
  {
    id: 'github-light',
    label: 'GitHub Light',
    dark: false,
    bg: '#FFFFFF',
    swatchColors: ['D73A49', '032F62', '6A737D'],
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    dark: false,
    bg: '#FDF6E3',
    swatchColors: ['859900', '2AA198', '93A1A1'],
  },
  {
    id: 'one-dark-pro',
    label: 'One Dark Pro',
    dark: true,
    bg: '#282C34',
    swatchColors: ['C678DD', '98C379', '5C6370'],
  },
  {
    id: 'dracula',
    label: 'Dracula',
    dark: true,
    bg: '#282A36',
    swatchColors: ['FF79C6', 'F1FA8C', '6272A4'],
  },
  {
    id: 'nord',
    label: 'Nord',
    dark: true,
    bg: '#2E3440',
    swatchColors: ['81A1C1', 'A3BE8C', '4C566A'],
  },
  {
    id: 'monokai',
    label: 'Monokai',
    dark: true,
    bg: '#272822',
    swatchColors: ['F92672', 'E6DB74', '75715E'],
  },
]

const THEME_DEFS = {
  'openplot-light': {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '',           foreground: '1A2B3C' },
      { token: 'comment',   foreground: '7A99AE', fontStyle: 'italic' },
      { token: 'keyword',   foreground: '1A7DC4', fontStyle: 'bold' },
      { token: 'string',    foreground: '2E8B57' },
      { token: 'number',    foreground: 'D07020' },
      { token: 'delimiter', foreground: '4A6478' },
      { token: 'type',      foreground: '7C3AED' },
      { token: 'variable',  foreground: '1A2B3C' },
      { token: 'function',  foreground: '1668A8' },
      { token: 'constant',  foreground: '6366F1' },
    ],
    colors: {
      'editor.background':                  '#F5FAFF',
      'editor.foreground':                  '#1A2B3C',
      'editor.lineHighlightBackground':     '#EBF4FA',
      'editor.selectionBackground':         '#1A7DC433',
      'editor.inactiveSelectionBackground': '#1A7DC41A',
      'editorLineNumber.foreground':        '#9DB5C7',
      'editorLineNumber.activeForeground':  '#4A6478',
      'editorCursor.foreground':            '#1A7DC4',
      'editorWhitespace.foreground':        '#CFE0ED',
      'editorIndentGuide.background1':      '#CFE0ED',
      'editorIndentGuide.activeBackground1':'#9DB5C7',
      'editor.wordHighlightBackground':     '#1A7DC422',
      'editor.wordHighlightBorder':         '#1A7DC466',
      'editor.findMatchBackground':         '#1A7DC444',
      'editor.findMatchHighlightBackground':'#1A7DC422',
      'editor.findMatchBorder':             '#1A7DC4AA',
      'editorBracketMatch.background':      '#1A7DC422',
      'editorBracketMatch.border':          '#1A7DC466',
      'scrollbarSlider.background':         '#CFE0ED80',
      'scrollbarSlider.hoverBackground':    '#BDCFDFAA',
      'editorWidget.background':            '#F0F7FC',
      'editorWidget.border':               '#CFE0ED',
      'input.background':                  '#FFFFFF',
      'input.border':                      '#BDCFDF',
      'input.foreground':                  '#1A2B3C',
      'list.hoverBackground':              '#EBF4FA',
      'list.activeSelectionBackground':    '#1A7DC410',
    },
  },

  'github-light': {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '',           foreground: '24292E' },
      { token: 'comment',   foreground: '6A737D', fontStyle: 'italic' },
      { token: 'keyword',   foreground: 'D73A49' },
      { token: 'string',    foreground: '032F62' },
      { token: 'number',    foreground: '005CC5' },
      { token: 'delimiter', foreground: '24292E' },
      { token: 'type',      foreground: '6F42C1' },
      { token: 'variable',  foreground: 'E36209' },
      { token: 'function',  foreground: '6F42C1' },
      { token: 'constant',  foreground: '005CC5' },
    ],
    colors: {
      'editor.background':                  '#FFFFFF',
      'editor.foreground':                  '#24292E',
      'editor.lineHighlightBackground':     '#F6F8FA',
      'editor.selectionBackground':         '#0366D625',
      'editor.inactiveSelectionBackground': '#0366D615',
      'editorLineNumber.foreground':        '#959DA5',
      'editorLineNumber.activeForeground':  '#24292E',
      'editorCursor.foreground':            '#044289',
      'editor.findMatchBackground':         '#FFDF5D55',
      'editor.findMatchHighlightBackground':'#FFDF5D30',
      'scrollbarSlider.background':         '#959DA580',
      'editorWidget.background':            '#F6F8FA',
      'editorWidget.border':               '#E1E4E8',
      'input.background':                  '#FFFFFF',
      'input.border':                      '#E1E4E8',
      'input.foreground':                  '#24292E',
      'list.hoverBackground':              '#F6F8FA',
      'list.activeSelectionBackground':    '#F6F8FA',
    },
  },

  'solarized-light': {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '',           foreground: '657B83' },
      { token: 'comment',   foreground: '93A1A1', fontStyle: 'italic' },
      { token: 'keyword',   foreground: '859900' },
      { token: 'string',    foreground: '2AA198' },
      { token: 'number',    foreground: 'D33682' },
      { token: 'delimiter', foreground: '657B83' },
      { token: 'type',      foreground: 'B58900' },
      { token: 'variable',  foreground: '657B83' },
      { token: 'function',  foreground: '268BD2' },
      { token: 'constant',  foreground: 'CB4B16' },
    ],
    colors: {
      'editor.background':                  '#FDF6E3',
      'editor.foreground':                  '#657B83',
      'editor.lineHighlightBackground':     '#EEE8D5',
      'editor.selectionBackground':         '#EEE8D5',
      'editor.inactiveSelectionBackground': '#EEE8D580',
      'editorLineNumber.foreground':        '#93A1A1',
      'editorLineNumber.activeForeground':  '#657B83',
      'editorCursor.foreground':            '#657B83',
      'editor.findMatchBackground':         '#268BD244',
      'editor.findMatchHighlightBackground':'#268BD222',
      'scrollbarSlider.background':         '#93A1A180',
      'editorWidget.background':            '#EEE8D5',
      'editorWidget.border':               '#D3CBB5',
      'input.background':                  '#FDF6E3',
      'input.border':                      '#D3CBB5',
      'input.foreground':                  '#657B83',
      'list.hoverBackground':              '#EEE8D5',
      'list.activeSelectionBackground':    '#EEE8D5',
    },
  },

  'one-dark-pro': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '',           foreground: 'ABB2BF' },
      { token: 'comment',   foreground: '5C6370', fontStyle: 'italic' },
      { token: 'keyword',   foreground: 'C678DD' },
      { token: 'string',    foreground: '98C379' },
      { token: 'number',    foreground: 'D19A66' },
      { token: 'delimiter', foreground: 'ABB2BF' },
      { token: 'type',      foreground: 'E5C07B' },
      { token: 'variable',  foreground: 'ABB2BF' },
      { token: 'function',  foreground: '61AFEF' },
      { token: 'constant',  foreground: 'D19A66' },
    ],
    colors: {
      'editor.background':                  '#282C34',
      'editor.foreground':                  '#ABB2BF',
      'editor.lineHighlightBackground':     '#2C313A',
      'editor.selectionBackground':         '#3E4451',
      'editor.inactiveSelectionBackground': '#3A3F4B',
      'editorLineNumber.foreground':        '#4B5263',
      'editorLineNumber.activeForeground':  '#ABB2BF',
      'editorCursor.foreground':            '#528BFF',
      'editorWhitespace.foreground':        '#3B4048',
      'editor.findMatchBackground':         '#42557B',
      'editor.findMatchHighlightBackground':'#314365',
      'scrollbarSlider.background':         '#4E566880',
      'editorWidget.background':            '#21252B',
      'editorWidget.border':               '#181A1F',
      'input.background':                  '#1B1D23',
      'input.border':                      '#181A1F',
      'input.foreground':                  '#ABB2BF',
      'list.hoverBackground':              '#2C313A',
      'list.activeSelectionBackground':    '#2C313A',
    },
  },

  'dracula': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '',           foreground: 'F8F8F2' },
      { token: 'comment',   foreground: '6272A4', fontStyle: 'italic' },
      { token: 'keyword',   foreground: 'FF79C6' },
      { token: 'string',    foreground: 'F1FA8C' },
      { token: 'number',    foreground: 'BD93F9' },
      { token: 'delimiter', foreground: 'F8F8F2' },
      { token: 'type',      foreground: '8BE9FD', fontStyle: 'italic' },
      { token: 'variable',  foreground: 'F8F8F2' },
      { token: 'function',  foreground: '50FA7B' },
      { token: 'constant',  foreground: 'BD93F9' },
    ],
    colors: {
      'editor.background':                  '#282A36',
      'editor.foreground':                  '#F8F8F2',
      'editor.lineHighlightBackground':     '#44475A',
      'editor.selectionBackground':         '#44475A',
      'editor.inactiveSelectionBackground': '#44475A80',
      'editorLineNumber.foreground':        '#6272A4',
      'editorLineNumber.activeForeground':  '#F8F8F2',
      'editorCursor.foreground':            '#F8F8F0',
      'editor.findMatchBackground':         '#FFB86C55',
      'editor.findMatchHighlightBackground':'#FFFFFF30',
      'scrollbarSlider.background':         '#44475A80',
      'editorWidget.background':            '#21222C',
      'editorWidget.border':               '#6272A4',
      'input.background':                  '#282A36',
      'input.foreground':                  '#F8F8F2',
      'list.hoverBackground':              '#44475A',
      'list.activeSelectionBackground':    '#44475A',
    },
  },

  'nord': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '',           foreground: 'D8DEE9' },
      { token: 'comment',   foreground: '4C566A', fontStyle: 'italic' },
      { token: 'keyword',   foreground: '81A1C1' },
      { token: 'string',    foreground: 'A3BE8C' },
      { token: 'number',    foreground: 'B48EAD' },
      { token: 'delimiter', foreground: 'ECEFF4' },
      { token: 'type',      foreground: '8FBCBB' },
      { token: 'variable',  foreground: 'D8DEE9' },
      { token: 'function',  foreground: '88C0D0' },
      { token: 'constant',  foreground: 'B48EAD' },
    ],
    colors: {
      'editor.background':                  '#2E3440',
      'editor.foreground':                  '#D8DEE9',
      'editor.lineHighlightBackground':     '#3B4252',
      'editor.selectionBackground':         '#434C5E',
      'editor.inactiveSelectionBackground': '#3B425280',
      'editorLineNumber.foreground':        '#4C566A',
      'editorLineNumber.activeForeground':  '#D8DEE9',
      'editorCursor.foreground':            '#D8DEE9',
      'editor.findMatchBackground':         '#88C0D055',
      'editor.findMatchHighlightBackground':'#88C0D030',
      'scrollbarSlider.background':         '#4C566A80',
      'editorWidget.background':            '#3B4252',
      'editorWidget.border':               '#4C566A',
      'input.background':                  '#2E3440',
      'input.foreground':                  '#D8DEE9',
      'list.hoverBackground':              '#3B4252',
      'list.activeSelectionBackground':    '#3B4252',
    },
  },

  'monokai': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '',           foreground: 'F8F8F2' },
      { token: 'comment',   foreground: '75715E', fontStyle: 'italic' },
      { token: 'keyword',   foreground: 'F92672' },
      { token: 'string',    foreground: 'E6DB74' },
      { token: 'number',    foreground: 'AE81FF' },
      { token: 'delimiter', foreground: 'F8F8F2' },
      { token: 'type',      foreground: '66D9E8' },
      { token: 'variable',  foreground: 'F8F8F2' },
      { token: 'function',  foreground: 'A6E22E' },
      { token: 'constant',  foreground: 'AE81FF' },
    ],
    colors: {
      'editor.background':                  '#272822',
      'editor.foreground':                  '#F8F8F2',
      'editor.lineHighlightBackground':     '#3E3D32',
      'editor.selectionBackground':         '#49483E',
      'editor.inactiveSelectionBackground': '#49483E80',
      'editorLineNumber.foreground':        '#75715E',
      'editorLineNumber.activeForeground':  '#F8F8F2',
      'editorCursor.foreground':            '#F8F8F0',
      'editor.findMatchBackground':         '#FFE79240',
      'editor.findMatchHighlightBackground':'#FFE79220',
      'scrollbarSlider.background':         '#75715E80',
      'editorWidget.background':            '#1E1F1C',
      'editorWidget.border':               '#49483E',
      'input.background':                  '#272822',
      'input.foreground':                  '#F8F8F2',
      'list.hoverBackground':              '#3E3D32',
      'list.activeSelectionBackground':    '#49483E',
    },
  },
}

function defineAllThemes(monaco) {
  for (const [id, def] of Object.entries(THEME_DEFS)) {
    monaco.editor.defineTheme(id, def)
  }
}

// Monaco options shared across all instances (theme applied separately)
const BASE_OPTIONS = {
  language: 'python',
  fontSize: 12,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontLigatures: true,
  lineHeight: 20,
  minimap: { enabled: true, scale: 1, renderCharacters: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  renderLineHighlight: 'line',
  lineNumbers: 'on',
  glyphMargin: false,
  folding: true,
  wordWrap: 'off',
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: true, indentation: true },
  suggest: { showWords: false },
  quickSuggestions: { other: true, comments: false, strings: false },
  parameterHints: { enabled: true },
  formatOnPaste: false,
  formatOnType: false,
  occurrencesHighlight: 'singleFile',
  selectionHighlight: true,
  padding: { top: 12, bottom: 12 },
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    useShadows: false,
  },
}

export function CodeEditor({ value, onChange, onSave, onSelectionChange }) {
  const editorRef = useRef(null)
  const onSaveRef = useRef(onSave)
  const editorTheme = useStore(s => s.editorTheme)

  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  function handleBeforeMount(monaco) {
    defineAllThemes(monaco)
  }

  function handleMount(editor, monaco) {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current?.()
    })
    editor.focus()
    editor.onDidChangeCursorSelection(() => {
      const sel = editor.getSelection()
      const model = editor.getModel()
      const text = (sel && model && !sel.isEmpty()) ? model.getValueInRange(sel) : ''
      onSelectionChange?.(text)
    })
  }

  const themeMeta = EDITOR_THEMES.find(t => t.id === editorTheme) || EDITOR_THEMES[0]
  const loadingBg = THEME_DEFS[editorTheme]?.colors?.['editor.background'] || '#F5FAFF'
  const loadingFg = themeMeta.dark ? '#8899AA' : '#7A99AE'

  return (
    <Editor
      height="100%"
      defaultLanguage="python"
      value={value ?? ''}
      onChange={(val) => onChange?.(val ?? '')}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{ ...BASE_OPTIONS, theme: editorTheme }}
      loading={
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: loadingFg,
          fontFamily: 'JetBrains Mono, monospace',
          background: loadingBg,
        }}>
          加载编辑器…
        </div>
      }
    />
  )
}
