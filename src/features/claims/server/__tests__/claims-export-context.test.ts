import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEmployeeByEmail: vi.fn(),
  canAccessEmployeeClaims: vi.fn(),
  canDownloadClaimsCsv: vi.fn(),
  getMyClaimsTotalCount: vi.fn(),
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/features/employees/permissions', () => ({
  canAccessEmployeeClaims: mocks.canAccessEmployeeClaims,
}))

vi.mock('@/features/claims/utils/export-permissions', () => ({
  canDownloadClaimsCsv: mocks.canDownloadClaimsCsv,
}))

vi.mock('@/features/claims/data/repositories/claims.repository', () => ({
  getMyClaimsTotalCount: mocks.getMyClaimsTotalCount,
}))

import {
  resolveMyClaimsExportContext,
  resolveMyClaimsExportPreflight,
} from '@/features/claims/server/claims-export-context'

const supabase = {} as import('@supabase/supabase-js').SupabaseClient

describe('resolveMyClaimsExportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-1',
      employee_email: 'employee@nxtwave.co.in',
      designations: { designation_name: 'Student Relationship Officer' },
    })
    mocks.canAccessEmployeeClaims.mockResolvedValue(true)
    mocks.canDownloadClaimsCsv.mockReturnValue(true)
  })

  it('returns 401 when there is no authenticated user', async () => {
    const result = await resolveMyClaimsExportContext(
      supabase,
      null,
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: false,
      status: 401,
      message: 'Unauthorized request.',
    })
  })

  it('returns 403 when the employee lacks claims access', async () => {
    mocks.canAccessEmployeeClaims.mockResolvedValue(false)

    const result = await resolveMyClaimsExportContext(
      supabase,
      { email: 'employee@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'Claims access is required.',
    })
  })

  it('returns 403 when the designation cannot download CSV', async () => {
    mocks.canDownloadClaimsCsv.mockReturnValue(false)

    const result = await resolveMyClaimsExportContext(
      supabase,
      { email: 'employee@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'CSV export is not available for your designation.',
    })
  })

  it('returns the employee and normalized filters on success', async () => {
    const statusId = '11111111-1111-4111-8111-111111111111'
    const result = await resolveMyClaimsExportContext(
      supabase,
      { email: 'employee@nxtwave.co.in' },
      new URLSearchParams({ claimStatus: statusId, workLocation: 'wl-1' })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.context.employee.id).toBe('emp-1')
    expect(result.context.filters.claimStatus).toBe(statusId)
    expect(result.context.filters.workLocation).toBe('wl-1')
  })
})

describe('resolveMyClaimsExportPreflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeByEmail.mockResolvedValue({
      id: 'emp-1',
      employee_email: 'employee@nxtwave.co.in',
      designations: { designation_name: 'Student Relationship Officer' },
    })
    mocks.canAccessEmployeeClaims.mockResolvedValue(true)
    mocks.canDownloadClaimsCsv.mockReturnValue(true)
    mocks.getMyClaimsTotalCount.mockResolvedValue(42)
  })

  it('propagates a context failure without calling the count query', async () => {
    mocks.canAccessEmployeeClaims.mockResolvedValue(false)

    const result = await resolveMyClaimsExportPreflight(
      supabase,
      { email: 'employee@nxtwave.co.in' },
      new URLSearchParams()
    )

    expect(result).toEqual({
      ok: false,
      status: 403,
      message: 'Claims access is required.',
    })
    expect(mocks.getMyClaimsTotalCount).not.toHaveBeenCalled()
  })

  it('returns employeeId and the estimated total row count on success', async () => {
    const statusId = '11111111-1111-4111-8111-111111111111'
    const result = await resolveMyClaimsExportPreflight(
      supabase,
      { email: 'employee@nxtwave.co.in' },
      new URLSearchParams({ claimStatus: statusId })
    )

    expect(result).toEqual({
      ok: true,
      employeeId: 'emp-1',
      estimatedTotalRows: 42,
    })
    expect(mocks.getMyClaimsTotalCount).toHaveBeenCalledWith(
      supabase,
      'emp-1',
      expect.objectContaining({ claimStatus: statusId })
    )
  })
})
