import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'

// Custom warm-sand theme matching the project UI
const THEME_NAME = 'openplot-light'

function defineTheme(monaco) {
  monaco.editor.defineTheme(THEME_NAME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '',              foreground: '1C1917' },
      { token: 'comment',      foreground: 'A8A29E', fontStyle: 'italic' },
      { token: 'keyword',      foreground: '0072B2', fontStyle: 'bold' },
      { token: 'string',       foreground: '009E73' },
      { token: 'number',       foreground: 'D55E00' },
      { token: 'delimiter',    foreground: '78716C' },
      { token: 'type',         foreground: '7C3AED' },
      { token: 'variable',     foreground: '1C1917' },
      { token: 'function',     foreground: 'E69F00' },
      { token: 'constant',     foreground: 'CC79A7' },
    ],
    colors: {
      'editor.background':                '#FDFAF4',
      'editor.foreground':                '#1C1917',
      'editor.lineHighlightBackground':   '#F5F1EA',
      'editor.selectionBackground':       '#26A69A33',
      'editor.inactiveSelectionBackground': '#26A69A1A',
      'editorLineNumber.foreground':      '#C4BEB7',
      'editorLineNumber.activeForeground':'#78716C',
      'editorCursor.foreground':          '#1C1917',
      'editorWhitespace.foreground':      '#E7E0D1',
      'editorIndentGuide.background1':    '#E7E0D1',
      'editorIndentGuide.activeBackground1': '#C4BEB7',
      'editor.wordHighlightBackground':   '#E69F0033',
      'editor.wordHighlightBorder':       '#E69F0066',
      'editor.wordHighlightStrongBackground': '#E69F0055',
      'editor.findMatchBackground':       '#E69F0044',
      'editor.findMatchHighlightBackground': '#E69F0022',
      'editor.findMatchBorder':           '#E69F00AA',
      'editorBracketMatch.background':    '#0F766E22',
      'editorBracketMatch.border':        '#0F766E66',
      'scrollbarSlider.background':       '#E7E0D180',
      'scrollbarSlider.hoverBackground':  '#D6CFC2AA',
      'editorWidget.background':          '#FAF6ED',
      'editorWidget.border':              '#E7E0D1',
      'input.background':                 '#FFFFFF',
      'input.border':                     '#D6CFC2',
      'input.foreground':                 '#1C1917',
      'inputOption.activeBorder':         '#1C1917',
      'list.hoverBackground':             '#F5F1EA',
      'list.activeSelectionBackground':   '#1C191708',
    },
  })
}

// Monaco options shared across all instances
const EDITOR_OPTIONS = {
  language: 'python',
  theme: THEME_NAME,
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
  // Occurrence highlighting: on by default in Monaco when cursor is on a word
  occurrencesHighlight: 'singleFile',
  selectionHighlight: true,
  padding: { top: 12, bottom: 12 },
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    useShadows: false,
  },
}

export function CodeEditor({ value, onChange, onSave }) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const onSaveRef = useRef(onSave)

  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  function handleBeforeMount(monaco) {
    monacoRef.current = monaco
    defineTheme(monaco)
  }

  function handleMount(editor, monaco) {
    editorRef.current = editor

    // Ctrl/Cmd+S → save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current?.()
    })

    // Focus the editor immediately
    editor.focus()
  }

  return (
    <Editor
      height="100%"
      defaultLanguage="python"
      value={value ?? ''}
      onChange={(val) => onChange?.(val ?? '')}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={EDITOR_OPTIONS}
      loading={
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: '#A8A29E',
          fontFamily: 'JetBrains Mono, monospace',
          background: '#FDFAF4',
        }}>
          加载编辑器…
        </div>
      }
    />
  )
}
