import type { FinanceHistoryItem } from '@/features/finance/types'
import type { FinanceExportProfile } from '@/lib/services/finance-export-config-service'

export const PAYMENT_JOURNALS_CSV_HEADERS = [
  'Posting Date',
  'Document Type',
  'Document No.',
  'External Document No.',
  'Account Type',
  'Account No.',
  'Vendor Balance',
  'Employee Balance',
  'Employee Transaction Type',
  'Cash Flow Options',
  'Type Of Payment',
  'Credit Memo No',
  'Amount Excl. GST',
  'Description',
  'Payment Method Code',
  'Amount',
  'Bal. Account Type',
  'Bal. Account No.',
  'Program Code',
  'Sub product Code',
  'Responsible dep Code',
  'Beneficiary dep Code',
]

function escapeCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export function toCsvLine(cells: string[]): string {
  return cells.map((cell) => escapeCsvCell(cell)).join(',')
}

function toAmountString(amount: number): string {
  return Math.abs(amount).toFixed(2)
}

type PaymentJournalsDefaults = {
  documentType: string
  accountType: string
  employeeTransactionType: string
  cashFlowOptions: string
  typeOfPayment: string
  description: string
  paymentMethodCode: string
  balAccountType: string
  balAccountNo: string
  programCode: string
  subProductCode: string
  responsibleDepCode: string
  beneficiaryDepCode: string
}

type EmployeeTotalMap = Map<string, number>

function normalizeRequired(
  value: string | null | undefined,
  fieldLabel: string
): string {
  const normalized = value?.trim() ?? ''

  if (!normalized) {
    throw new Error(`Payment Journals export profile is missing ${fieldLabel}.`)
  }

  return normalized
}

export function resolvePaymentJournalsDefaults(
  profile: FinanceExportProfile
): PaymentJournalsDefaults {
  return {
    documentType: normalizeRequired(profile.document_type, 'document type'),
    accountType: normalizeRequired(profile.account_type, 'account type'),
    employeeTransactionType: normalizeRequired(
      profile.employee_transaction_type,
      'employee transaction type'
    ),
    cashFlowOptions: normalizeRequired(
      profile.cash_flow_options,
      'cash flow options'
    ),
    typeOfPayment: normalizeRequired(
      profile.type_of_payment,
      'type of payment'
    ),
    description: normalizeRequired(profile.description, 'description'),
    paymentMethodCode: normalizeRequired(
      profile.payment_method_code,
      'payment method code'
    ),
    balAccountType: normalizeRequired(
      profile.bal_account_type,
      'bal. account type'
    ),
    balAccountNo: normalizeRequired(profile.bal_account_no, 'bal. account no.'),
    programCode: normalizeRequired(profile.program_code, 'program code'),
    subProductCode: normalizeRequired(
      profile.sub_product_code,
      'sub product code'
    ),
    responsibleDepCode: normalizeRequired(
      profile.responsible_dep_code,
      'responsible dep code'
    ),
    beneficiaryDepCode: normalizeRequired(
      profile.beneficiary_dep_code,
      'beneficiary dep code'
    ),
  }
}

type BuildRowsInput = {
  totalsByEmployeeId: EmployeeTotalMap
  defaults: PaymentJournalsDefaults
}

type AccumulateEmployeeTotalsInput = {
  historyRows: FinanceHistoryItem[]
  seenClaimIds: Set<string>
  totalsByEmployeeId: EmployeeTotalMap
}

function addEmployeeTotal(
  totalsByEmployeeId: EmployeeTotalMap,
  employeeId: string,
  amount: number
) {
  const existingAmount = totalsByEmployeeId.get(employeeId) ?? 0
  totalsByEmployeeId.set(employeeId, existingAmount + amount)
}

function toNormalizedAmount(value: number | string | null | undefined): number {
  const numericValue =
    typeof value === 'number' ? value : value ? Number(value) : 0

  return Number.isFinite(numericValue) ? numericValue : 0
}

export function accumulatePaymentJournalsEmployeeTotals({
  historyRows,
  seenClaimIds,
  totalsByEmployeeId,
}: AccumulateEmployeeTotalsInput) {
  for (const historyRow of historyRows) {
    const claimId = historyRow.claim.id

    if (seenClaimIds.has(claimId)) {
      continue
    }

    seenClaimIds.add(claimId)
    const claimTotal = toNormalizedAmount(historyRow.claim.total_amount)

    addEmployeeTotal(
      totalsByEmployeeId,
      historyRow.owner.employee_id,
      claimTotal
    )
  }
}

export function buildPaymentJournalsRows({
  totalsByEmployeeId,
  defaults,
}: BuildRowsInput): string[][] {
  return [...totalsByEmployeeId.entries()]
    .sort(([firstEmployeeId], [secondEmployeeId]) =>
      firstEmployeeId.localeCompare(secondEmployeeId)
    )
    .map(([employeeId, totalAmount]) => [
      '',
      defaults.documentType,
      '',
      '',
      defaults.accountType,
      employeeId,
      '0',
      '0',
      defaults.employeeTransactionType,
      defaults.cashFlowOptions,
      defaults.typeOfPayment,
      '',
      '0',
      defaults.description,
      defaults.paymentMethodCode,
      toAmountString(totalAmount),
      defaults.balAccountType,
      defaults.balAccountNo,
      defaults.programCode,
      defaults.subProductCode,
      defaults.responsibleDepCode,
      defaults.beneficiaryDepCode,
    ])
}
