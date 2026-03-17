type TableTextAlign = 'left' | 'right' | 'center'
type TableTextWeight = 'normal' | 'medium' | 'semibold'

type TableHeadCellOptions = {
  align?: TableTextAlign
  nowrap?: boolean
  weight?: TableTextWeight
}

type TableBodyCellOptions = {
  align?: TableTextAlign
  muted?: boolean
  mono?: boolean
  nowrap?: boolean
  weight?: TableTextWeight
}

const ALIGN_CLASS: Record<TableTextAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

const WEIGHT_CLASS: Record<TableTextWeight, string> = {
  normal: '',
  medium: 'font-medium',
  semibold: 'font-semibold',
}

function joinClassNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ')
}

export const DATA_TABLE_SECTION_CLASS =
  'rounded-lg border border-border bg-surface'
export const DATA_TABLE_HEADER_BAR_CLASS = 'border-b border-border px-6 py-4'
export const DATA_TABLE_PAGINATION_SLOT_CLASS = 'px-6 pt-4'
export const DATA_TABLE_SCROLL_WRAPPER_CLASS = 'overflow-x-auto px-2 pb-2'
export const DATA_TABLE_CLASS = 'w-full text-sm'
export const DATA_TABLE_HEAD_ROW_CLASS = 'border-b border-border'
export const DATA_TABLE_BODY_CLASS = 'divide-y divide-border'
export const DATA_TABLE_ROW_CLASS = 'transition-colors hover:bg-muted/50'

export function getDataTableHeadCellClass(options: TableHeadCellOptions = {}) {
  const { align = 'left', nowrap = false, weight = 'medium' } = options

  return joinClassNames(
    'px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground',
    ALIGN_CLASS[align],
    WEIGHT_CLASS[weight],
    nowrap && 'whitespace-nowrap'
  )
}

export function getDataTableCellClass(options: TableBodyCellOptions = {}) {
  const {
    align = 'left',
    muted = false,
    mono = false,
    nowrap = false,
    weight = 'normal',
  } = options

  return joinClassNames(
    'px-4 py-3.5',
    ALIGN_CLASS[align],
    muted && 'text-muted-foreground',
    mono && 'font-mono',
    WEIGHT_CLASS[weight],
    nowrap && 'whitespace-nowrap'
  )
}
