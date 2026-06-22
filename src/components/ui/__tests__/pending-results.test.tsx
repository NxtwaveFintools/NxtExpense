// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PendingResults } from '@/components/ui/pending-results'

vi.mock('@/components/ui/filter-navigation', () => ({
  useFilterNavigation: vi.fn(),
}))

import { useFilterNavigation } from '@/components/ui/filter-navigation'

const mockUseFilterNavigation = vi.mocked(useFilterNavigation)

describe('PendingResults', () => {
  it('renders children when not pending', () => {
    mockUseFilterNavigation.mockReturnValue({
      isPending: false,
      navigate: vi.fn(),
    })

    render(
      <PendingResults skeleton={<div>loading</div>}>
        <div>results</div>
      </PendingResults>
    )

    expect(screen.queryByText('results')).not.toBeNull()
    expect(screen.queryByText('loading')).toBeNull()
  })

  it('renders the skeleton when pending', () => {
    mockUseFilterNavigation.mockReturnValue({
      isPending: true,
      navigate: vi.fn(),
    })

    render(
      <PendingResults skeleton={<div>loading</div>}>
        <div>results</div>
      </PendingResults>
    )

    expect(screen.queryByText('loading')).not.toBeNull()
    expect(screen.queryByText('results')).toBeNull()
  })
})
