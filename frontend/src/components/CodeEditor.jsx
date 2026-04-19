import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import {
  syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentUnit,
} from '@codemirror/language'

const theme = EditorView.theme({
  '&': {
    fontSize: '11.5px',
    fontFamily: 'JetBrains Mono, monospace',
    backgroundColor: 'transparent',
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily: 'JetBrains Mono, monospace',
    lineHeight: '1.6',
  },
  '.cm-content': { caretColor: '#1C1917', padding: '12px 0' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#C4BEB7',
    paddingRight: '8px',
  },
  '.cm-lineNumbers .cm-gutterElement': { fontSize: '10.5px', paddingLeft: '12px' },
  '.cm-activeLine': { backgroundColor: 'rgba(28,25,23,0.03)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#78716C' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(15,118,110,0.15) !important',
  },
  '.cm-cursor': { borderLeftColor: '#1C1917', borderLeftWidth: '1.5px' },
}, { dark: false })

export function CodeEditor({ value, onChange, onSave }) {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  // Create view once
  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: value ?? '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        indentUnit.of('    '),
        syntaxHighlighting(defaultHighlightStyle),
        python(),
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => { onSaveRef.current?.(); return true },
          },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of(u => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString())
        }),
        theme,
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes (e.g. reload on task switch)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value ?? '' },
      })
    }
  }, [value])

  return <div ref={hostRef} style={{ flex: 1, overflow: 'auto', minHeight: 0 }} />
}
