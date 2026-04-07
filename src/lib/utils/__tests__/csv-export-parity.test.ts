import { describe, expect, it } from 'vitest'

import {
  buildMyClaimsCsv,
  mapMyClaimToCsvRow,
  MY_CLAIMS_CSV_HEADERS,
} from '@/features/claims/utils/filters'
import {
  buildApprovalHistoryCsv,
  mapApprovalHistoryToCsvRow,
  APPROVAL_HISTORY_CSV_HEADERS,
} from '@/features/approvals/utils/history-filters'
import {
  buildFinanceHistoryCsv,
  mapFinanceHistoryToCsvRow,
  FINANCE_HISTORY_CSV_HEADERS,
} from '@/features/finance/utils/filters'
import { createStreamingCsvResponse } from '@/lib/utils/streaming-export'
import type { ApprovalHistoryRecord } from '@/features/approvals/types'
import type { Claim } from '@/features/claims/types'
import type { FinanceHistoryItem } from '@/features/finance/types'

async function buildStreamingCsv<T>(
  rows: T[],
  headers: string[],
  mapRow: (row: T) => string[]
): Promise<string> {
  const response = createStreamingCsvResponse<T>({
    fetcher: async () => ({
      data: rows,
      hasNextPage: false,
      nextCursor: null,
    }),
    headers,
    mapRow,
    filename: 'all.csv',
  })

  return response.text()
}

describe('CSV sanitization parity across page and all exports', () => {
  it('keeps claims CSV formula sanitization identical for page and streaming exports', async () => {
    const claim = {
      claim_number: '=1+1',
      claim_date: '2026-03-06',
      work_location: 'Office / WFH',
      total_amount: 120,
      statusName: 'Submitted',
      submitted_at: '2026-03-06T10:30:00.000Z',
    } as unknown as Claim

    const pageCsv = buildMyClaimsCsv([claim])
    const allCsv = await buildStreamingCsv(
      [claim],
      MY_CLAIMS_CSV_HEADERS,
      mapMyClaimToCsvRow
    )

    expect(pageCsv).toContain('"\'=1+1"')
    expect(allCsv).toContain('"\'=1+1"')
  })

  it('keeps approvals CSV formula sanitization identical for page and streaming exports', async () => {
    const row = {
      claimNumber: 'CLAIM-260306-001',
      ownerEmployeeId: 'NXT-EMP-1001',
      ownerName: 'Employee Name',
      ownerEmail: '@evil.com',
      ownerDesignation: 'Student Relationship Officer',
      claimDate: '2026-03-06',
      workLocation: 'Office / WFH',
      totalAmount: 120,
      action: 'rejected',
      actedAt: '2026-03-06T11:00:00.000Z',
      actorEmail: '@attacker',
      actorDesignation: 'State Business Head',
      hodApprovedAt: null,
      financeApprovedAt: null,
      claimStatusName: 'Rejected',
    } as unknown as ApprovalHistoryRecord

    const pageCsv = buildApprovalHistoryCsv([row])
    const allCsv = await buildStreamingCsv(
      [row],
      APPROVAL_HISTORY_CSV_HEADERS,
      mapApprovalHistoryToCsvRow
    )

    expect(pageCsv).toContain('"\'@attacker"')
    expect(allCsv).toContain('"\'@attacker"')
  })

  it('keeps finance CSV formula sanitization identical for page and streaming exports', async () => {
    const row = {
      claim: {
        claim_number: 'CLAIM-260306-002',
        claim_date: '2026-03-06',
        work_location: 'Office / WFH',
        total_amount: 420,
        statusName: 'Finance Approved',
      },
      owner: {
        employee_id: 'NXT-EMP-1002',
        employee_name: 'Finance Owner',
        employee_email: 'owner@nxtwave.co.in',
        designations: { designation_name: 'Program Manager' },
      },
      action: {
        action: 'finance_approved',
        actor_email: '+SUM(A1:A2)',
        acted_at: '2026-03-06T12:00:00.000Z',
      },
    } as unknown as FinanceHistoryItem

    const pageCsv = buildFinanceHistoryCsv([row])
    const allCsv = await buildStreamingCsv(
      [row],
      FINANCE_HISTORY_CSV_HEADERS,
      mapFinanceHistoryToCsvRow
    )

    expect(pageCsv).toContain('"\'+SUM(A1:A2)"')
    expect(allCsv).toContain('"\'+SUM(A1:A2)"')
  })
})
