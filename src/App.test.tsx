import { act, cleanup, createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const fetchMock = vi.fn<typeof fetch>()

function dragData() {
  const values = new Map<string, string>()
  return {
    effectAllowed: 'all',
    dropEffect: 'none',
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
    get types() { return [...values.keys()] },
  }
}

const BETH_IMAGE = 'https://rickandmortyapi.com/api/character/avatar/41.jpeg'
const BIRDPERSON_IMAGE = 'https://rickandmortyapi.com/api/character/avatar/72.jpeg'
const boardCharacters = [
  { id: '41', name: 'Beth Smith', image: BETH_IMAGE },
  { id: '72', name: 'Birdperson', image: BIRDPERSON_IMAGE },
]

// Review intake and Send reminder are assigned to character 41; Prepare visit to character 72.
async function renderBoardWithItems(characters: { id: string; name: string; image?: string }[] = boardCharacters) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({
    data: { characters: { results: characters } },
  }), { status: 200 }))
  render(<App />)
  await screen.findByRole('option', { name: 'Beth Smith' })
  for (const [title, characterId] of [['Review intake', '41'], ['Prepare visit', '72'], ['Send reminder', '41']]) {
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: title } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Character' }), { target: { value: characterId } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
  }
}

function boardColumn(name: string) {
  return screen.getByRole('region', { name })
}

function boardCard(title: string) {
  return screen.getAllByRole('listitem').find(card => within(card).queryByRole('heading', { name: title }))!
}

/** The character portrait is a permanent, decorative part of the card itself. */
function expectCardPortrait(title: string, image?: string) {
  const portraits = boardCard(title).querySelectorAll('img')
  if (image) {
    expect(portraits).toHaveLength(1)
    expect(portraits[0].getAttribute('src')).toBe(image)
    expect(portraits[0].getAttribute('alt')).toBe('')
  } else {
    expect(portraits).toHaveLength(0)
  }
}

function columnTitles(name: string) {
  return within(boardColumn(name)).queryAllByRole('listitem')
    .map(card => within(card).getByRole('heading').textContent)
}

function moveCard(title: string, destination: string) {
  const card = boardCard(title)
  expect(card.draggable).toBe(true)
  const dataTransfer = dragData()
  fireEvent.dragStart(card, { dataTransfer })
  expect(fireEvent.dragOver(boardColumn(destination), { dataTransfer })).toBe(false)
  fireEvent.drop(boardColumn(destination), { dataTransfer })
  fireEvent.dragEnd(card, { dataTransfer })
}

function dropOnCard(sourceTitle: string, targetTitle: string, half: 'before' | 'after') {
  const source = boardCard(sourceTitle)
  const target = boardCard(targetTitle)
  const bounds = vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 100, top: 100, bottom: 200, left: 0, right: 300, width: 300, height: 100,
    toJSON: () => ({}),
  })
  const dataTransfer = dragData()
  fireEvent.dragStart(source, { dataTransfer })
  const dragOver = createEvent.dragOver(target, { dataTransfer })
  Object.defineProperty(dragOver, 'clientY', { value: half === 'before' ? 125 : 175 })
  expect(fireEvent(target, dragOver)).toBe(false)
  const drop = createEvent.drop(target, { dataTransfer })
  Object.defineProperty(drop, 'clientY', { value: half === 'before' ? 125 : 175 })
  fireEvent(target, drop)
  fireEvent.dragEnd(source, { dataTransfer })
  bounds.mockRestore()
}

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
    expect(body.query).toMatch(/\bimage\b/)
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
      data: { characters: { results: [{ id: '41', name: 'Beth Smith', image: BETH_IMAGE }, { id: '72', name: 'Birdperson' }] } },
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
    expectCardPortrait('Schedule follow-up', BETH_IMAGE)
    expect(within(boardColumn('To Do')).getAllByRole('listitem')).toHaveLength(1)
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
    expectCardPortrait('Review intake', BETH_IMAGE)
    expectCardPortrait('Prepare visit')
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

describe('Moving items between columns', () => {
  it('moves a card through empty columns and back, preserving its assignment', async () => {
    await renderBoardWithItems()
    for (const destination of ['Doing', 'Done', 'To Do']) {
      moveCard('Review intake', destination)
      expect(within(boardColumn(destination)).getAllByText('Review intake')).toHaveLength(1)
      expect(within(boardCard('Review intake')).getByText('Beth Smith')).toBeTruthy()
      expectCardPortrait('Review intake', BETH_IMAGE)
      expect(screen.getAllByText('Review intake')).toHaveLength(1)
      for (const other of ['To Do', 'Doing', 'Done'].filter(name => name !== destination)) {
        expect(within(boardColumn(other)).queryByText('Review intake')).toBeNull()
      }
    }
    expect(columnTitles('To Do')).toEqual(['Prepare visit', 'Send reminder', 'Review intake'])
    expect(within(boardColumn('Doing')).getByText('No items yet.')).toBeTruthy()
    expect(within(boardColumn('Done')).getByText('No items yet.')).toBeTruthy()
  })

  it('appends to an occupied destination and restores the source empty state', async () => {
    await renderBoardWithItems()
    moveCard('Prepare visit', 'Done')
    moveCard('Review intake', 'Done')
    moveCard('Send reminder', 'Done')

    expect(columnTitles('Done')).toEqual(['Prepare visit', 'Review intake', 'Send reminder'])
    expect(within(boardCard('Prepare visit')).getByText('Birdperson')).toBeTruthy()
    expect(within(boardCard('Review intake')).getByText('Beth Smith')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(within(boardColumn('To Do')).getByText('No items yet.')).toBeTruthy()
    expect(within(boardColumn('Done')).queryByText('No items yet.')).toBeNull()
  })

  it('keeps the board unchanged after an outside drop, cancellation, or same-column drop', async () => {
    await renderBoardWithItems()
    const card = boardCard('Review intake')
    const dataTransfer = dragData()
    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.drop(screen.getByRole('heading', { level: 1 }), { dataTransfer })
    fireEvent.dragEnd(card, { dataTransfer })
    expect(columnTitles('To Do')).toEqual(['Review intake', 'Prepare visit', 'Send reminder'])

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragEnd(card, { dataTransfer })
    expect(columnTitles('To Do')).toEqual(['Review intake', 'Prepare visit', 'Send reminder'])
    moveCard('Review intake', 'To Do')
    expect(columnTitles('To Do')).toEqual(['Review intake', 'Prepare visit', 'Send reminder'])
    expect(columnTitles('Doing')).toEqual([])
    expect(columnTitles('Done')).toEqual([])
  })

  it('ignores external data and stale data from a canceled drag', async () => {
    await renderBoardWithItems()
    const external = dragData()
    external.setData('text/plain', 'unknown-item')
    fireEvent.dragOver(boardColumn('Doing'), { dataTransfer: external })
    fireEvent.drop(boardColumn('Doing'), { dataTransfer: external })

    const card = boardCard('Review intake')
    const stale = dragData()
    fireEvent.dragStart(card, { dataTransfer: stale })
    fireEvent.dragEnd(card, { dataTransfer: stale })
    fireEvent.drop(boardColumn('Done'), { dataTransfer: stale })

    expect(columnTitles('To Do')).toEqual(['Review intake', 'Prepare visit', 'Send reminder'])
    expect(columnTitles('Doing')).toEqual([])
    expect(columnTitles('Done')).toEqual([])
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})

describe('Reordering items within columns', () => {
  it.each([
    ['Review intake', 'Send reminder', 'after', ['Prepare visit', 'Send reminder', 'Review intake']],
    ['Send reminder', 'Review intake', 'before', ['Send reminder', 'Review intake', 'Prepare visit']],
    ['Prepare visit', 'Send reminder', 'after', ['Review intake', 'Send reminder', 'Prepare visit']],
    ['Prepare visit', 'Review intake', 'before', ['Prepare visit', 'Review intake', 'Send reminder']],
  ] as const)('places %s %s (%s target half) without losing cards', async (source, target, half, expected) => {
    await renderBoardWithItems()
    dropOnCard(source, target, half)

    expect(columnTitles('To Do')).toEqual(expected)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(within(boardCard('Review intake')).getByText('Beth Smith')).toBeTruthy()
    expect(within(boardCard('Prepare visit')).getByText('Birdperson')).toBeTruthy()
    expect(within(boardCard('Send reminder')).getByText('Beth Smith')).toBeTruthy()
    expectCardPortrait('Review intake', BETH_IMAGE)
    expectCardPortrait('Prepare visit', BIRDPERSON_IMAGE)
    expectCardPortrait('Send reminder', BETH_IMAGE)
    expect(columnTitles('Doing')).toEqual([])
    expect(columnTitles('Done')).toEqual([])
  })

  it.each(['Doing', 'Done'])('reorders in %s without changing a populated neighboring column', async destination => {
    await renderBoardWithItems()
    moveCard('Review intake', destination)
    moveCard('Prepare visit', destination)
    dropOnCard('Prepare visit', 'Review intake', 'before')

    expect(columnTitles(destination)).toEqual(['Prepare visit', 'Review intake'])
    expect(columnTitles('To Do')).toEqual(['Send reminder'])
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(within(boardCard('Prepare visit')).getByText('Birdperson')).toBeTruthy()
    expect(within(boardCard('Review intake')).getByText('Beth Smith')).toBeTruthy()
  })

  it('keeps order on self-drop or when a drag over another card is canceled', async () => {
    await renderBoardWithItems()
    dropOnCard('Prepare visit', 'Prepare visit', 'after')
    expect(columnTitles('To Do')).toEqual(['Review intake', 'Prepare visit', 'Send reminder'])

    const source = boardCard('Review intake')
    const target = boardCard('Send reminder')
    const dataTransfer = dragData()
    fireEvent.dragStart(source, { dataTransfer })
    const dragOver = createEvent.dragOver(target, { dataTransfer })
    Object.defineProperty(dragOver, 'clientY', { value: 175 })
    fireEvent(target, dragOver)
    fireEvent.dragEnd(source, { dataTransfer })
    expect(columnTitles('To Do')).toEqual(['Review intake', 'Prepare visit', 'Send reminder'])
  })

  it('still appends cross-column drops even when targeting the top half of an existing card', async () => {
    await renderBoardWithItems()
    moveCard('Send reminder', 'Doing')
    dropOnCard('Send reminder', 'Review intake', 'before')

    expect(columnTitles('To Do')).toEqual(['Review intake', 'Prepare visit', 'Send reminder'])
    expect(columnTitles('Doing')).toEqual([])
    expect(within(boardColumn('Doing')).getByText('No items yet.')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})

describe('Portal celebration', () => {
  let prefersReducedMotion = false

  function inColumnPortals() {
    return screen.queryAllByTestId('portal')
  }

  function arrivalPortals() {
    return screen.queryAllByTestId('arrival-portal')
  }

  function arrivingElements() {
    return Array.from(document.querySelectorAll('[data-arriving="true"]'))
  }

  function portraitsOutsideCards() {
    return Array.from(document.querySelectorAll('img')).filter(img => img.closest('li') === null)
  }

  function statuses() {
    return screen.queryAllByRole('status')
  }

  function expectNoCelebration() {
    expect(inColumnPortals()).toHaveLength(0)
    expect(arrivalPortals()).toHaveLength(0)
    expect(arrivingElements()).toHaveLength(0)
    expect(statuses()).toHaveLength(0)
  }

  function expectDoneColumnPortal() {
    const portals = inColumnPortals()
    expect(portals).toHaveLength(1)
    const portal = portals[0]
    expect(within(boardColumn('Done')).getByTestId('portal')).toBe(portal)
    expect(portal.getAttribute('aria-hidden')).toBe('true')
    expect(portal.tagName).not.toBe('LI')
    expect(portal.closest('li')).toBeNull()
    expect(portal.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')).toHaveLength(0)
    expect(within(boardColumn('Done')).getByRole('heading', { level: 2, name: 'Done' })).toBeTruthy()
  }

  function expectAnnouncementFor(title: string) {
    const announced = statuses()
    expect(announced).toHaveLength(1)
    // A single text node: no nested elements such as <strong>.
    expect(announced[0].children).toHaveLength(0)
    expect(announced[0].textContent).toMatch(new RegExp(title))
    expect(announced[0].textContent).toMatch(/done/i)
  }

  function expectArrivalFor(title: string, image?: string) {
    expect(inColumnPortals()).toHaveLength(0)
    const arrivals = arrivalPortals()
    expect(arrivals).toHaveLength(1)
    expect(arrivals[0].getAttribute('aria-hidden')).toBe('true')
    expect(arrivals[0].closest('ul')).toBeNull()
    expect(arrivals[0].closest('li')).toBeNull()

    const card = boardCard(title)
    expect(arrivingElements()).toEqual([card])
    expect(card.getAttribute('data-arriving')).toBe('true')
    // The card drops as it is: its own portrait, never a second one added for the arrival.
    expectCardPortrait(title, image)
    expect(portraitsOutsideCards()).toHaveLength(0)
    expectAnnouncementFor(title)
  }

  function stubImagePrefetch() {
    const sources: string[] = []
    class RecordingImage {
      private source = ''
      onload: unknown = null
      onerror: unknown = null
      decoding = 'auto'
      get src() { return this.source }
      set src(value: string) {
        this.source = value
        sources.push(value)
      }
      setAttribute(name: string, value: string) {
        if (name === 'src') this.src = value
      }
      decode() { return Promise.resolve() }
    }
    vi.stubGlobal('Image', RecordingImage)
    return sources
  }

  function advance(ms: number) {
    act(() => { vi.advanceTimersByTime(ms) })
  }

  beforeEach(() => {
    prefersReducedMotion = false
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: prefersReducedMotion && /prefers-reduced-motion:\s*reduce/.test(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens a decorative portal inside Done when a To Do card starts dragging', async () => {
    await renderBoardWithItems()
    expectNoCelebration()

    fireEvent.dragStart(boardCard('Review intake'), { dataTransfer: dragData() })

    expectDoneColumnPortal()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(columnTitles('To Do')).toEqual(['Review intake', 'Prepare visit', 'Send reminder'])
    expect(columnTitles('Done')).toEqual([])
    expect(arrivalPortals()).toHaveLength(0)
    expect(statuses()).toHaveLength(0)
  })

  it('opens the portal when a Doing card starts dragging', async () => {
    await renderBoardWithItems()
    moveCard('Review intake', 'Doing')
    expectNoCelebration()

    fireEvent.dragStart(boardCard('Review intake'), { dataTransfer: dragData() })

    expectDoneColumnPortal()
    expect(columnTitles('Doing')).toEqual(['Review intake'])
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('opens no portal when a card already in Done starts dragging', async () => {
    await renderBoardWithItems()
    vi.useFakeTimers()
    moveCard('Review intake', 'Done')
    advance(2000)
    expectNoCelebration()

    const card = boardCard('Review intake')
    const dataTransfer = dragData()
    fireEvent.dragStart(card, { dataTransfer })
    expect(inColumnPortals()).toHaveLength(0)
    fireEvent.dragEnd(card, { dataTransfer })
    expectNoCelebration()
  })

  it.each([
    ['To Do', 'Review intake', BETH_IMAGE],
    ['Doing', 'Prepare visit', BIRDPERSON_IMAGE],
  ])('prefetches the character image when a %s card starts dragging', async (column, title, image) => {
    await renderBoardWithItems()
    if (column === 'Doing') moveCard(title, 'Doing')
    const prefetched = stubImagePrefetch()

    fireEvent.dragStart(boardCard(title), { dataTransfer: dragData() })

    expect(prefetched).toContain(image)
  })

  it('prefetches nothing and still opens the portal when the character has no image', async () => {
    await renderBoardWithItems([
      { id: '41', name: 'Beth Smith', image: BETH_IMAGE },
      { id: '72', name: 'Birdperson' },
    ])
    const prefetched = stubImagePrefetch()

    expect(() => fireEvent.dragStart(boardCard('Prepare visit'), { dataTransfer: dragData() })).not.toThrow()

    expect(prefetched).toEqual([])
    expectDoneColumnPortal()
  })

  it('closes the portal when a drag is cancelled or dropped outside any column', async () => {
    await renderBoardWithItems()
    const card = boardCard('Review intake')
    const dataTransfer = dragData()

    fireEvent.dragStart(card, { dataTransfer })
    expectDoneColumnPortal()
    fireEvent.dragEnd(card, { dataTransfer })
    expectNoCelebration()

    fireEvent.dragStart(card, { dataTransfer })
    expectDoneColumnPortal()
    fireEvent.drop(screen.getByRole('heading', { level: 1 }), { dataTransfer })
    fireEvent.dragEnd(card, { dataTransfer })
    expectNoCelebration()
    expect(columnTitles('To Do')).toEqual(['Review intake', 'Prepare visit', 'Send reminder'])
    expect(columnTitles('Done')).toEqual([])
  })

  it('swaps the column portal for an arrival portal and drops the card with its character portrait', async () => {
    await renderBoardWithItems()
    const card = boardCard('Review intake')
    const dataTransfer = dragData()

    fireEvent.dragStart(card, { dataTransfer })
    expectDoneColumnPortal()
    expect(fireEvent.dragOver(boardColumn('Done'), { dataTransfer })).toBe(false)
    expectDoneColumnPortal()
    fireEvent.drop(boardColumn('Done'), { dataTransfer })

    expectArrivalFor('Review intake', BETH_IMAGE)
    expect(columnTitles('Done')).toEqual(['Review intake'])
    expect(columnTitles('To Do')).toEqual(['Prepare visit', 'Send reminder'])
    expect(columnTitles('Doing')).toEqual([])
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(within(boardCard('Review intake')).getByText('Beth Smith')).toBeTruthy()

    fireEvent.dragEnd(boardCard('Review intake'), { dataTransfer })
    expectArrivalFor('Review intake', BETH_IMAGE)
  })

  it('celebrates a Doing card dropped into Done', async () => {
    await renderBoardWithItems()
    moveCard('Prepare visit', 'Doing')
    expectNoCelebration()

    moveCard('Prepare visit', 'Done')

    expectArrivalFor('Prepare visit', BIRDPERSON_IMAGE)
    expect(columnTitles('Done')).toEqual(['Prepare visit'])
    expect(columnTitles('Doing')).toEqual([])
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('dismisses the arrival on its own and leaves the card in Done', async () => {
    await renderBoardWithItems()
    vi.useFakeTimers()

    moveCard('Review intake', 'Done')
    expectArrivalFor('Review intake', BETH_IMAGE)
    advance(500)
    expectArrivalFor('Review intake', BETH_IMAGE)

    advance(1500)
    expectNoCelebration()
    expect(columnTitles('Done')).toEqual(['Review intake'])
    expect(columnTitles('To Do')).toEqual(['Prepare visit', 'Send reminder'])
    expect(within(boardCard('Review intake')).getByText('Beth Smith')).toBeTruthy()
    expectCardPortrait('Review intake', BETH_IMAGE)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('does not celebrate a move from To Do to Doing', async () => {
    await renderBoardWithItems()
    moveCard('Review intake', 'Doing')

    expect(columnTitles('Doing')).toEqual(['Review intake'])
    expectNoCelebration()
  })

  it('does not celebrate reordering cards already in Done', async () => {
    await renderBoardWithItems()
    vi.useFakeTimers()
    moveCard('Review intake', 'Done')
    moveCard('Prepare visit', 'Done')
    advance(2000)
    expectNoCelebration()

    dropOnCard('Prepare visit', 'Review intake', 'before')

    expect(columnTitles('Done')).toEqual(['Prepare visit', 'Review intake'])
    expectNoCelebration()
  })

  it('does not celebrate a card moved out of Done', async () => {
    await renderBoardWithItems()
    vi.useFakeTimers()
    moveCard('Review intake', 'Done')
    advance(2000)
    expectNoCelebration()

    moveCard('Review intake', 'Doing')

    expect(columnTitles('Doing')).toEqual(['Review intake'])
    expect(columnTitles('Done')).toEqual([])
    expectNoCelebration()
  })

  it('ends the arrival when its card is dragged back out of Done before the arrival is dismissed', async () => {
    await renderBoardWithItems()
    vi.useFakeTimers()
    moveCard('Review intake', 'Done')
    expectArrivalFor('Review intake', BETH_IMAGE)

    moveCard('Review intake', 'Doing')

    const card = boardCard('Review intake')
    expect(card.hasAttribute('data-arriving')).toBe(false)
    expectCardPortrait('Review intake', BETH_IMAGE)
    expect(within(card).getByText('Beth Smith')).toBeTruthy()
    expect(columnTitles('Doing')).toEqual(['Review intake'])
    expect(columnTitles('Done')).toEqual([])
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expectNoCelebration()
  })

  it('replaces a showing arrival when another card reaches Done', async () => {
    await renderBoardWithItems()
    moveCard('Review intake', 'Done')
    expectArrivalFor('Review intake', BETH_IMAGE)

    moveCard('Prepare visit', 'Done')

    expectArrivalFor('Prepare visit', BIRDPERSON_IMAGE)
    expect(statuses()[0].textContent).not.toMatch(/Review intake/)
    expect(boardCard('Review intake').hasAttribute('data-arriving')).toBe(false)
    expectCardPortrait('Review intake', BETH_IMAGE)
    expect(columnTitles('Done')).toEqual(['Review intake', 'Prepare visit'])
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('announces the arrival and shows the portrait without portals when the user prefers reduced motion', async () => {
    prefersReducedMotion = true
    await renderBoardWithItems()
    vi.useFakeTimers()
    const card = boardCard('Review intake')
    const dataTransfer = dragData()

    fireEvent.dragStart(card, { dataTransfer })
    expect(inColumnPortals()).toHaveLength(0)
    expect(fireEvent.dragOver(boardColumn('Done'), { dataTransfer })).toBe(false)
    fireEvent.drop(boardColumn('Done'), { dataTransfer })
    fireEvent.dragEnd(boardCard('Review intake'), { dataTransfer })

    expect(inColumnPortals()).toHaveLength(0)
    expect(arrivalPortals()).toHaveLength(0)
    expect(arrivingElements()).toHaveLength(0)
    expectAnnouncementFor('Review intake')
    expectCardPortrait('Review intake', BETH_IMAGE)
    expect(portraitsOutsideCards()).toHaveLength(0)
    expect(columnTitles('Done')).toEqual(['Review intake'])

    advance(2000)
    expectNoCelebration()
    expect(columnTitles('Done')).toEqual(['Review intake'])
    expectCardPortrait('Review intake', BETH_IMAGE)
  })

  it('still runs the arrival without a portrait when the character has no image', async () => {
    await renderBoardWithItems([
      { id: '41', name: 'Beth Smith', image: BETH_IMAGE },
      { id: '72', name: 'Birdperson' },
    ])

    moveCard('Prepare visit', 'Done')

    expectArrivalFor('Prepare visit')
    expect(within(boardCard('Prepare visit')).getByText('Birdperson')).toBeTruthy()
    expectCardPortrait('Review intake', BETH_IMAGE)
    expect(columnTitles('Done')).toEqual(['Prepare visit'])
  })
})
