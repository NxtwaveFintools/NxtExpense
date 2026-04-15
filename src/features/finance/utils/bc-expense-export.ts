import type { FinanceExportProfile } from '@/lib/services/finance-export-config-service'
import type { FinanceHistoryItem } from '@/features/finance/types'

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

export function buildBcExpenseRows({
  historyRows,
  claimItemsByClaimId,
  balAccountNoByItemType,
  postingDate,
  exportProfile,
}: BuildRowsInput): string[][] {
  const rows: string[][] = []

  for (const historyRow of historyRows) {
    const claimItems = claimItemsByClaimId.get(historyRow.claim.id) ?? []

    for (const claimItem of claimItems) {
      const balAccountNo = balAccountNoByItemType.get(claimItem.item_type)

      if (!balAccountNo) {
        continue
      }

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
  }

  return rows
}
