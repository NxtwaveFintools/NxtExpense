// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'

import { mswServer } from '@/test/msw/server'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { toast } from 'sonner'
import { CsvExportButton } from '@/components/ui/csv-export-button'

describe('CsvExportButton', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
  })

  afterEach(() => {
    clickSpy.mockRestore()
  })

  it('renders the idle label', () => {
    render(
      <CsvExportButton
        exportType="my-claims"
        href="/claims/export?claimStatus=approved"
        label="Export CSV"
      />
    )

    expect(screen.getByRole('button', { name: 'Export CSV' })).not.toBeNull()
  })

  it('posts to /api/exports/start with the export type and query, then downloads and returns to idle', async () => {
    let capturedBody: unknown = null

    mswServer.use(
      http.post('*/api/exports/start', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ ok: true })
      })
    )

    render(
      <CsvExportButton
        exportType="my-claims"
        href="/claims/export?claimStatus=approved"
        label="Export CSV"
      />
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Export CSV' }).click()
    })

    expect(capturedBody).toEqual({
      exportType: 'my-claims',
      query: '?claimStatus=approved',
    })
    expect(clickSpy).toHaveBeenCalledTimes(1)

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.href).toContain('claimStatus=approved')

    expect(screen.getByRole('button').textContent).toContain('Export CSV')
  })

  it('shows an error toast and never downloads when the preflight fails', async () => {
    mswServer.use(
      http.post('*/api/exports/start', () =>
        HttpResponse.json(
          { error: 'Finance access is required.' },
          { status: 403 }
        )
      )
    )

    render(
      <CsvExportButton
        exportType="finance-history"
        href="/finance/export"
        label="Export CSV"
      />
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Export CSV' }).click()
    })

    expect(toast.error).toHaveBeenCalledWith('Finance access is required.')
    expect(clickSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('button').textContent).toContain('Export CSV')
  })

  it('shows a generic error toast and returns to idle on a network failure', async () => {
    mswServer.use(http.post('*/api/exports/start', () => HttpResponse.error()))

    render(
      <CsvExportButton
        exportType="my-claims"
        href="/claims/export"
        label="Export CSV"
      />
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Export CSV' }).click()
    })

    expect(toast.error).toHaveBeenCalledWith('Unable to start export.')
    expect(clickSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('button').textContent).toContain('Export CSV')
  })
})
