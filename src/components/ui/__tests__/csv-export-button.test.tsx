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
    vi.useFakeTimers()
  })

  afterEach(() => {
    clickSpy.mockRestore()
    vi.useRealTimers()
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

  it('posts to /api/exports/start with the export type and query, then downloads with the returned requestId', async () => {
    let capturedBody: unknown = null

    mswServer.use(
      http.post('*/api/exports/start', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ requestId: 'req-1' })
      }),
      http.get('*/api/exports/status', () =>
        HttpResponse.json({
          status: 'streaming',
          rowsSent: 0,
          estimatedTotalRows: 10,
          errorMessage: null,
        })
      )
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
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(capturedBody).toEqual({
      exportType: 'my-claims',
      query: '?claimStatus=approved',
    })
    expect(clickSpy).toHaveBeenCalledTimes(1)

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.href).toContain('claimStatus=approved')
    expect(anchor.href).toContain('requestId=req-1')
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
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(toast.error).toHaveBeenCalledWith('Finance access is required.')
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('updates progress from streaming polls, then resets after done', async () => {
    let pollCount = 0

    mswServer.use(
      http.post('*/api/exports/start', () =>
        HttpResponse.json({ requestId: 'req-2' })
      ),
      http.get('*/api/exports/status', () => {
        pollCount += 1
        if (pollCount === 1) {
          return HttpResponse.json({
            status: 'streaming',
            rowsSent: 5,
            estimatedTotalRows: 10,
            errorMessage: null,
          })
        }
        return HttpResponse.json({
          status: 'done',
          rowsSent: 10,
          estimatedTotalRows: 10,
          errorMessage: null,
        })
      })
    )

    render(
      <CsvExportButton
        exportType="my-claims"
        href="/claims/export"
        label="Export CSV"
      />
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Export CSV' }).click()
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750)
    })
    expect(screen.getByRole('button').textContent).toContain('Exporting 50%')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750)
    })
    expect(screen.getByRole('button').textContent).toContain('Done')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.getByRole('button').textContent).toContain('Export CSV')
  })

  it('shows the incomplete-file toast and resets when polling reports an error', async () => {
    mswServer.use(
      http.post('*/api/exports/start', () =>
        HttpResponse.json({ requestId: 'req-3' })
      ),
      http.get('*/api/exports/status', () =>
        HttpResponse.json({
          status: 'error',
          rowsSent: 3,
          estimatedTotalRows: 10,
          errorMessage: 'DB connection lost.',
        })
      )
    )

    render(
      <CsvExportButton
        exportType="my-claims"
        href="/claims/export"
        label="Export CSV"
      />
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Export CSV' }).click()
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750)
    })

    expect(toast.error).toHaveBeenCalledWith(
      'Export failed partway through — the downloaded file may be incomplete. Please delete it and retry.'
    )
    expect(screen.getByRole('button').textContent).toContain('Export CSV')
  })
})
