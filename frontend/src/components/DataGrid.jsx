import { useCallback, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { themeQuartz, ModuleRegistry, AllCommunityModule } from 'ag-grid-community'

ModuleRegistry.registerModules([AllCommunityModule])

const gridTheme = themeQuartz.withParams({
  backgroundColor: '#FFFFFF',
  headerBackgroundColor: '#F0F7FC',
  headerTextColor: '#2E4A5E',
  headerFontWeight: 600,
  borderColor: '#CFE0ED',
  rowBorder: { color: '#EBF4FA', width: 1 },
  cellTextColor: '#1A2B3C',
  fontSize: 11.5,
  headerFontSize: 11,
  fontFamily: '"JetBrains Mono", monospace',
  accentColor: '#1A7DC4',
  selectedRowBackgroundColor: 'rgba(26,125,196,0.08)',
  rowHoverColor: 'rgba(26,125,196,0.03)',
  cellHorizontalPaddingScale: 0.75,
  rowHeight: 28,
  headerHeight: 34,
  wrapperBorder: false,
  columnBorder: { color: '#EBF4FA', width: 1 },
})

function TypeHeader({ displayName, type }) {
  return (
    <div style={{ lineHeight: 1.2 }}>
      <div style={{ fontWeight: 600, fontSize: 11 }}>{displayName}</div>
      {type && (
        <div style={{ fontSize: 9, color: '#7A99AE', fontWeight: 400, marginTop: 1 }}>
          {type}
        </div>
      )}
    </div>
  )
}

export function DataGrid({ rows, onChange, types }) {
  const gridRef = useRef(null)
  const headers = rows[0] ?? []

  const columnDefs = useMemo(() => {
    const isNum = (ti) => types?.[ti] === 'f64'
    return headers.map((h, ci) => ({
      field: String(ci),
      headerName: h || `col_${ci}`,
      headerComponent: types?.[ci] ? TypeHeader : undefined,
      headerComponentParams: types?.[ci] ? { type: types[ci] } : undefined,
      editable: true,
      resizable: true,
      sortable: true,
      filter: true,
      minWidth: 80,
      flex: 1,
      cellStyle: isNum(ci)
        ? { color: '#1A7DC4', textAlign: 'right' }
        : { textAlign: 'left' },
    }))
  }, [headers, types])

  const rowData = useMemo(
    () => rows.slice(1).map(row =>
      Object.fromEntries(headers.map((_, ci) => [String(ci), row[ci] ?? '']))
    ),
    [rows, headers],
  )

  const onCellValueChanged = useCallback(() => {
    if (!gridRef.current?.api) return
    const newBody = []
    gridRef.current.api.forEachNode(node => {
      newBody.push(headers.map((_, ci) => node.data[String(ci)] ?? ''))
    })
    onChange([headers, ...newBody])
  }, [headers, onChange])

  return (
    <div style={{ height: '100%', width: '100%', flex: 1, minWidth: 0 }}>
      <AgGridReact
        ref={gridRef}
        theme={gridTheme}
        columnDefs={columnDefs}
        rowData={rowData}
        onCellValueChanged={onCellValueChanged}
        defaultColDef={{ editable: true, resizable: true, sortable: true, filter: true }}
        singleClickEdit={false}
        enableCellTextSelection
        stopEditingWhenCellsLoseFocus
      />
    </div>
  )
}
