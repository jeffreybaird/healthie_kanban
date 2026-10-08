import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

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

describe('Character selection', () => {
  it('loads character IDs and names from the GraphQL API with a disabled labeled selector', () => {
    render(<App />)

    const selector = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Character' })
    expect(selector.disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toMatch(/loading characters/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://rickandmortyapi.com/graphql')
    expect(options?.method).toBe('POST')
    expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json')
    const body = JSON.parse(String(options?.body)) as { query: string }
    expect(body.query).toMatch(/\bcharacters\b/)
    expect(body.query).toMatch(/\bresults\s*\{/)
    expect(body.query).toMatch(/\bid\b/)
    expect(body.query).toMatch(/\bname\b/)
  })

  it('replaces loading feedback with API options and lets the user select a character by ID', async () => {
    let resolveRequest!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>(resolve => { resolveRequest = resolve }))
    render(<App />)

    await act(async () => {
      resolveRequest(new Response(JSON.stringify({
        data: { characters: { results: [{ id: '41', name: 'Beth Smith' }, { id: '72', name: 'Birdperson' }] } },
      }), { status: 200 }))
    })

    const selector = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Character' })
    expect(selector.disabled).toBe(false)
    expect(selector.value).toBe('')
    expect(within(selector).getByRole<HTMLOptionElement>('option', { name: 'Choose a character' }).value).toBe('')
    expect(within(selector).getAllByRole('option').map(option => option.textContent))
      .toEqual(['Choose a character', 'Beth Smith', 'Birdperson'])
    expect(within(selector).getByRole<HTMLOptionElement>('option', { name: 'Beth Smith' }).value).toBe('41')
    expect(within(selector).getByRole<HTMLOptionElement>('option', { name: 'Birdperson' }).value).toBe('72')
    expect(screen.queryByText(/loading characters/i)).toBeNull()

    fireEvent.change(selector, { target: { value: '72' } })
    expect(selector.value).toBe('72')
  })

  it.each([
    ['HTTP failure', () => Promise.resolve(new Response('{}', { status: 503 }))],
    ['GraphQL errors', () => Promise.resolve(new Response(JSON.stringify({ errors: [{ message: 'Unavailable' }] }), { status: 200 }))],
    ['network failure', () => Promise.reject(new Error('Offline'))],
  ])('shows failure feedback and keeps selection disabled after %s', async (_name, response) => {
    fetchMock.mockImplementation(response)
    render(<App />)

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not load characters/i)
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Character' }).disabled).toBe(true)
    expect(screen.queryByText(/loading characters/i)).toBeNull()
  })

  it('explains an empty character response and keeps selection disabled', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { characters: { results: [] } } }), { status: 200 }))
    render(<App />)

    expect(await screen.findByText('No characters available.')).toBeTruthy()
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Character' }).disabled).toBe(true)
    expect(screen.queryByText(/loading characters/i)).toBeNull()
  })
})
