import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getEmployeeByEmail: vi.fn(),
  getExportProgress: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/lib/services/employee-service', () => ({
  getEmployeeByEmail: mocks.getEmployeeByEmail,
}))

vi.mock('@/lib/utils/export-progress-registry', () => ({
  getExportProgress: mocks.getExportProgress,
}))

import { GET } from '@/app/api/exports/status/route'

describe('GET /api/exports/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: 'a@nxtwave.co.in' } } }),
      },
    })
    mocks.getEmployeeByEmail.mockResolvedValue({ id: 'emp-1' })
  })

  it('returns 400 when requestId is missing', async () => {
    const response = await GET(
      new Request('http://localhost:3000/api/exports/status')
    )
    expect(response.status).toBe(400)
  })

  it('returns 401 when there is no authenticated user', async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const response = await GET(
      new Request('http://localhost:3000/api/exports/status?requestId=x')
    )
    expect(response.status).toBe(401)
  })

  it('returns 404 when the progress entry is not found or belongs to another employee', async () => {
    mocks.getExportProgress.mockReturnValue(null)

    const response = await GET(
      new Request('http://localhost:3000/api/exports/status?requestId=x')
    )
    expect(response.status).toBe(404)
  })

  it('returns the progress entry fields on success', async () => {
    mocks.getExportProgress.mockReturnValue({
      employeeId: 'emp-1',
      status: 'streaming',
      rowsSent: 12,
      estimatedTotalRows: 100,
      errorMessage: null,
      updatedAt: Date.now(),
    })

    const response = await GET(
      new Request('http://localhost:3000/api/exports/status?requestId=x')
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'streaming',
      rowsSent: 12,
      estimatedTotalRows: 100,
      errorMessage: null,
    })
    expect(mocks.getExportProgress).toHaveBeenCalledWith('x', 'emp-1')
  })
})
