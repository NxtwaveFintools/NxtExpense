import type { FinanceExportProfile } from '@/lib/services/finance-export-config-service'
import type { FinanceHistoryItem } from '@/features/finance/types'
import { CLAIM_ITEM_TYPES } from '@/lib/constants/claim-expense'
import { getCanonicalExportAccountItemType } from '@/features/finance/utils/export-item-type-mapping'

export type ClaimExpenseItemRow = {
  claim_id: string
  item_type: string
  amount: number
}

export const BC_EXPENSE_CSV_HEADERS = [
  'Posting Date',
  'Document No.',
  'Account Type',
  'Account No.',
  'Employee Transaction Type',
  'Amount',
  'Description',
  'Bal. Account Type',
  'Bal. Account No.',
  'Program Code',
  'Sub product Code',
  'Responsible dep Code',
  'Beneficiary dep Code',
  'Region Code',
]

function escapeCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export function toCsvLine(cells: string[]): string {
  return cells.map((cell) => escapeCsvCell(cell)).join(',')
}

function formatNegativeAmount(amount: number): string {
  const normalized = -Math.abs(amount)
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(2)
}

type BuildRowsInput = {
  historyRows: FinanceHistoryItem[]
  claimItemsByClaimId: Map<string, ClaimExpenseItemRow[]>
  balAccountNoByItemType: Map<string, string>
  postingDate: string
  exportProfile: FinanceExportProfile
}

function toNormalizedAmount(value: number | string | null | undefined): number {
  const numericValue =
    typeof value === 'number' ? value : value ? Number(value) : 0

  return Number.isFinite(numericValue) ? numericValue : 0
}

function toRoundedCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

function resolveFallbackBalAccountNo(
  exportProfile: FinanceExportProfile,
  balAccountNoByItemType: Map<string, string>
): string | null {
  const profileBalAccountNo = exportProfile.bal_account_no?.trim()

  if (profileBalAccountNo) {
    return profileBalAccountNo
  }

  const fuelBalAccountNo = balAccountNoByItemType.get(CLAIM_ITEM_TYPES.FUEL)

  if (fuelBalAccountNo) {
    return fuelBalAccountNo
  }

  const foodBalAccountNo = balAccountNoByItemType.get(CLAIM_ITEM_TYPES.FOOD)

  if (foodBalAccountNo) {
    return foodBalAccountNo
  }

  const firstMapping = balAccountNoByItemType.values().next()

  return firstMapping.done ? null : firstMapping.value
}

export function buildBcExpenseRows({
  historyRows,
  claimItemsByClaimId,
  balAccountNoByItemType,
  postingDate,
  exportProfile,
}: BuildRowsInput): string[][] {
  const rows: string[][] = []
  const fallbackBalAccountNo = resolveFallbackBalAccountNo(
    exportProfile,
    balAccountNoByItemType
  )

  for (const historyRow of historyRows) {
    const claimItems = claimItemsByClaimId.get(historyRow.claim.id) ?? []
    let mappedTotal = 0

    for (const claimItem of claimItems) {
      const canonicalItemType = getCanonicalExportAccountItemType(
        claimItem.item_type
      )
      const balAccountNo =
        balAccountNoByItemType.get(canonicalItemType) ??
        balAccountNoByItemType.get(claimItem.item_type)

      if (!balAccountNo) {
        continue
      }

      mappedTotal += claimItem.amount

      rows.push([
        postingDate,
        exportProfile.default_document_no,
        exportProfile.account_type,
        historyRow.owner.employee_id,
        exportProfile.employee_transaction_type,
        formatNegativeAmount(claimItem.amount),
        historyRow.claim.claim_number,
        exportProfile.bal_account_type,
        balAccountNo,
        exportProfile.program_code,
        exportProfile.sub_product_code,
        exportProfile.responsible_dep_code,
        exportProfile.beneficiary_dep_code,
        historyRow.claim.expense_region_code ?? '',
      ])
    }

    const claimTotal = toNormalizedAmount(historyRow.claim.total_amount)
    const reconciliationAmount = toRoundedCurrency(claimTotal - mappedTotal)

    if (Math.abs(reconciliationAmount) < 0.01) {
      continue
    }

    if (!fallbackBalAccountNo) {
      throw new Error(
        `BC export is missing an active Bal. Account mapping for claim ${historyRow.claim.claim_number}.`
      )
    }

    rows.push([
      postingDate,
      exportProfile.default_document_no,
      exportProfile.account_type,
      historyRow.owner.employee_id,
      exportProfile.employee_transaction_type,
      formatNegativeAmount(reconciliationAmount),
      historyRow.claim.claim_number,
      exportProfile.bal_account_type,
      fallbackBalAccountNo,
      exportProfile.program_code,
      exportProfile.sub_product_code,
      exportProfile.responsible_dep_code,
      exportProfile.beneficiary_dep_code,
      historyRow.claim.expense_region_code ?? '',
    ])
  }

  return rows
}
