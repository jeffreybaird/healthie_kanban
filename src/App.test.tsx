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

describe('Item creation', () => {
  async function renderWithCharacters() {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: { characters: { results: [{ id: '41', name: 'Beth Smith' }, { id: '72', name: 'Birdperson' }] } },
    }), { status: 200 }))
    render(<App />)
    await screen.findByRole('option', { name: 'Beth Smith' })
  }

  function titleInput() {
    return screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' })
  }

  function characterSelect() {
    return screen.getByRole<HTMLSelectElement>('combobox', { name: 'Character' })
  }

  function submitForm() {
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Add item' })
    expect(button.type).toBe('submit')
    expect(button.form).not.toBeNull()
    expect(titleInput().form).toBe(button.form)
    expect(characterSelect().form).toBe(button.form)
    // Exercise the form submission path shared by clicking submit and pressing Enter.
    fireEvent.submit(button.form!)
  }

  function expectEmptyBoard() {
    for (const name of ['To Do', 'Doing', 'Done']) {
      expect(within(screen.getByRole('region', { name })).getByText('No items yet.')).toBeTruthy()
    }
  }

  it('creates one assigned item in To Do using a trimmed title and resets the form', async () => {
    await renderWithCharacters()
    fireEvent.change(titleInput(), { target: { value: '  Schedule follow-up  ' } })
    fireEvent.change(characterSelect(), { target: { value: '41' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))

    const toDo = within(screen.getByRole('region', { name: 'To Do' }))
    expect(toDo.getAllByText('Schedule follow-up', { normalizer: text => text })).toHaveLength(1)
    expect(toDo.getAllByText('Beth Smith')).toHaveLength(1)
    expect(toDo.queryByText('Birdperson')).toBeNull()
    expect(toDo.queryByText('No items yet.')).toBeNull()
    for (const name of ['Doing', 'Done']) {
      const column = within(screen.getByRole('region', { name }))
      expect(column.getByText('No items yet.')).toBeTruthy()
      expect(column.queryByText('Schedule follow-up')).toBeNull()
      expect(column.queryByText('Beth Smith')).toBeNull()
    }
    expect(titleInput().value).toBe('')
    expect(characterSelect().value).toBe('')
  })

  it('submits through the form and preserves previous items and their assignments', async () => {
    await renderWithCharacters()
    fireEvent.change(titleInput(), { target: { value: 'Review intake' } })
    fireEvent.change(characterSelect(), { target: { value: '41' } })
    submitForm()

    const toDo = within(screen.getByRole('region', { name: 'To Do' }))
    expect(toDo.getAllByText('Review intake')).toHaveLength(1)
    expect(toDo.getAllByText('Beth Smith')).toHaveLength(1)
    expect(titleInput().value).toBe('')
    expect(characterSelect().value).toBe('')

    fireEvent.change(titleInput(), { target: { value: 'Prepare visit' } })
    fireEvent.change(characterSelect(), { target: { value: '72' } })
    submitForm()

    for (const text of ['Review intake', 'Beth Smith', 'Prepare visit', 'Birdperson']) {
      expect(toDo.getAllByText(text)).toHaveLength(1)
    }
    expect(titleInput().value).toBe('')
    expect(characterSelect().value).toBe('')
  })

  it.each(['', '   \t  '])('rejects an empty or whitespace-only title (%j)', async title => {
    await renderWithCharacters()
    fireEvent.change(titleInput(), { target: { value: title } })
    fireEvent.change(characterSelect(), { target: { value: '41' } })
    submitForm()

    expectEmptyBoard()
    expect(within(screen.getByRole('region', { name: 'To Do' })).queryByText('Beth Smith')).toBeNull()
  })

  it('rejects a title without a selected character', async () => {
    await renderWithCharacters()
    fireEvent.change(titleInput(), { target: { value: 'Needs an assignee' } })
    submitForm()

    expectEmptyBoard()
    expect(within(screen.getByRole('region', { name: 'To Do' })).queryByText('Needs an assignee')).toBeNull()
  })

  it.each(['loading', 'error', 'empty'])('cannot create an item while characters are %s', async state => {
    if (state === 'error') fetchMock.mockResolvedValue(new Response('{}', { status: 503 }))
    if (state === 'empty') {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { characters: { results: [] } } }), { status: 200 }))
    }
    render(<App />)
    if (state === 'error') await screen.findByRole('alert')
    if (state === 'empty') await screen.findByText('No characters available.')

    fireEvent.change(titleInput(), { target: { value: 'Unavailable assignment' } })
    submitForm()

    expectEmptyBoard()
    expect(within(screen.getByRole('region', { name: 'To Do' })).queryByText('Unavailable assignment')).toBeNull()
  })
})

describe('Character loading recovery', () => {
  it('retries a failure without submitting or losing the title, then allows item creation', async () => {
    let resolveRetry!: (response: Response) => void
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveRetry = resolve }))
    render(<App />)
    await screen.findByRole('alert')

    const title = screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' })
    const selector = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Character' })
    const addItem = screen.getByRole<HTMLButtonElement>('button', { name: 'Add item' })
    fireEvent.change(title, { target: { value: 'Keep my draft' } })
    const retry = screen.getByRole<HTMLButtonElement>('button', { name: 'Retry' })
    expect(retry.type).toBe('button')
    expect(retry.form).toBe(addItem.form)
    expect(retry.form).not.toBeNull()
    expect(addItem.disabled).toBe(true)
    fireEvent.click(retry)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe('https://rickandmortyapi.com/graphql')
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST')
    expect(screen.getByRole('status').textContent).toMatch(/loading characters/i)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(selector.disabled).toBe(true)
    expect(addItem.disabled).toBe(true)
    expect(title.value).toBe('Keep my draft')
    for (const name of ['To Do', 'Doing', 'Done']) {
      const column = within(screen.getByRole('region', { name }))
      expect(column.getByText('No items yet.')).toBeTruthy()
      expect(column.queryByText('Keep my draft')).toBeNull()
    }

    await act(async () => {
      resolveRetry(new Response(JSON.stringify({
        data: { characters: { results: [{ id: '72', name: 'Birdperson' }] } },
      }), { status: 200 }))
    })

    expect(selector.disabled).toBe(false)
    expect(within(selector).getByRole<HTMLOptionElement>('option', { name: 'Birdperson' }).value).toBe('72')
    expect(screen.queryByText(/loading characters/i)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(title.value).toBe('Keep my draft')
    fireEvent.change(selector, { target: { value: '72' } })
    expect(addItem.disabled).toBe(false)
    fireEvent.click(addItem)
    const toDo = within(screen.getByRole('region', { name: 'To Do' }))
    expect(toDo.getAllByText('Keep my draft')).toHaveLength(1)
    expect(toDo.getAllByText('Birdperson')).toHaveLength(1)
  })

  it('offers another retry when the retried request also fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: 'Unavailable' }] }), { status: 200 }))
    render(<App />)
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not load characters/i)
    const retry = screen.getByRole<HTMLButtonElement>('button', { name: 'Retry' })
    expect(retry.disabled).toBe(false)
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Character' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add item' }).disabled).toBe(true)
    fireEvent.click(retry)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('status').textContent).toMatch(/loading characters/i)
  })

  it('allows recovery from an empty result while keeping creation disabled until selection', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { characters: { results: [] } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { characters: { results: [{ id: '41', name: 'Beth Smith' }] } },
      }), { status: 200 }))
    render(<App />)
    expect(await screen.findByText('No characters available.')).toBeTruthy()
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Character' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add item' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('option', { name: 'Beth Smith' })).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('No characters available.')).toBeNull()
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Character' }).disabled).toBe(false)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add item' }).disabled).toBe(true)
  })
})
