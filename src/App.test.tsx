import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('Kanban board', () => {
  it('renders a page heading and the workflow columns in order', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBeTruthy()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['To Do', 'Doing', 'Done'])
  })

  it('provides a clear empty state in each labeled column', () => {
    render(<App />)

    for (const name of ['To Do', 'Doing', 'Done']) {
      const column = screen.getByRole('region', { name })
      expect(within(column).getByRole('heading', { level: 2, name })).toBeTruthy()
      expect(within(column).getByText('No items yet.')).toBeTruthy()
    }
  })
})
