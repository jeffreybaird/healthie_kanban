import { useCallback, useRef, useState, type DragEvent, type FormEvent } from 'react'
import Celebration from './Celebration'
import CharacterSelect, { type Character } from './CharacterSelect'

type ColumnId = 'to-do' | 'doing' | 'done'
type Item = { id: number; title: string; character: Character; columnId: ColumnId }
type Placement = 'before' | 'after'

function dropPlacement(event: DragEvent<HTMLLIElement>): Placement {
  const bounds = event.currentTarget.getBoundingClientRect()
  return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
}

function moveItemInList(
  items: Item[],
  itemId: number,
  columnId: ColumnId,
  targetId?: number,
  placement?: Placement,
): Item[] {
  const item = items.find(candidate => candidate.id === itemId)
  if (!item) return items
  const remaining = items.filter(candidate => candidate.id !== itemId)
  if (item.columnId !== columnId) return [...remaining, { ...item, columnId }]
  if (targetId === undefined || targetId === itemId) return items
  const targetIndex = remaining.findIndex(candidate => candidate.id === targetId && candidate.columnId === columnId)
  if (targetIndex === -1) return items
  const insertIndex = targetIndex + (placement === 'after' ? 1 : 0)
  return [...remaining.slice(0, insertIndex), item, ...remaining.slice(insertIndex)]
}

function enteredDone(previous: Item[], next: Item[], itemId: number) {
  const before = previous.find(item => item.id === itemId)
  const after = next.find(item => item.id === itemId)
  return before !== undefined && after !== undefined && before.columnId !== 'done' && after.columnId === 'done'
}

const columns: { id: ColumnId; title: string }[] = [
  { id: 'to-do', title: 'To Do' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' },
]

export default function App() {
  const [title, setTitle] = useState('')
  const [character, setCharacter] = useState<Character | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const nextItemId = useRef(1)
  const draggedItemId = useRef<number | null>(null)
  const [insertion, setInsertion] = useState<{ itemId: number; placement: Placement } | null>(null)
  const [celebration, setCelebration] = useState<{ id: number; title: string } | null>(null)
  const nextCelebrationId = useRef(1)
  const dismissCelebration = useCallback(() => setCelebration(null), [])

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !character) return

    const item: Item = { id: nextItemId.current++, title: trimmedTitle, character, columnId: 'to-do' }
    setItems(previous => [...previous, item])
    setTitle('')
    setCharacter(null)
  }

  function moveItem(columnId: ColumnId, targetId?: number, placement?: Placement) {
    const itemId = draggedItemId.current
    draggedItemId.current = null
    setInsertion(null)
    if (itemId === null) return

    const nextItems = moveItemInList(items, itemId, columnId, targetId, placement)
    if (nextItems === items) return
    setItems(nextItems)
    if (enteredDone(items, nextItems, itemId)) {
      const movedItem = nextItems.find(item => item.id === itemId)!
      setCelebration({ id: nextCelebrationId.current++, title: movedItem.title })
    }
  }

  return (
    <main>
      <header className="board-header">
        <p className="eyebrow">A little progress, every day</p>
        <h1>Kanban board</h1>
        <p>See your work from start to finish.</p>
      </header>
      <form className="item-form" onSubmit={addItem}>
        <div className="title-field">
          <label htmlFor="item-title">Title</label>
          <input
            id="item-title"
            value={title}
            onChange={event => {
              event.target.setCustomValidity(event.target.value.trim() ? '' : 'Enter a title containing more than spaces.')
              setTitle(event.target.value)
            }}
            required
          />
        </div>
        <CharacterSelect value={character?.id ?? ''} onChange={setCharacter} />
        <button type="submit" disabled={!character}>Add item</button>
      </form>
      <div className="board">
        {columns.map(column => {
          const columnItems = items.filter(item => item.columnId === column.id)
          return (
          <section
            className="column"
            key={column.id}
            aria-labelledby={`${column.id}-heading`}
            onDragOver={event => {
              if (draggedItemId.current === null) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setInsertion(null)
            }}
            onDrop={event => {
              if (draggedItemId.current === null) return
              event.preventDefault()
              moveItem(column.id)
            }}
          >
            <h2 id={`${column.id}-heading`}>{column.title}</h2>
            {columnItems.length > 0 ? (
              <ul className="item-list">
                {columnItems.map(item => (
                  <li
                    className="item-card"
                    key={item.id}
                    draggable
                    data-insertion={insertion?.itemId === item.id ? insertion.placement : undefined}
                    onDragStart={event => {
                      draggedItemId.current = item.id
                      setInsertion(null)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', String(item.id))
                    }}
                    onDragOver={event => {
                      const source = items.find(candidate => candidate.id === draggedItemId.current)
                      if (!source || source.id === item.id || source.columnId !== item.columnId) return
                      event.preventDefault()
                      event.stopPropagation()
                      event.dataTransfer.dropEffect = 'move'
                      setInsertion({ itemId: item.id, placement: dropPlacement(event) })
                    }}
                    onDragLeave={event => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInsertion(null)
                    }}
                    onDrop={event => {
                      if (draggedItemId.current === null) return
                      event.preventDefault()
                      event.stopPropagation()
                      moveItem(column.id, item.id, dropPlacement(event))
                    }}
                    onDragEnd={() => {
                      draggedItemId.current = null
                      setInsertion(null)
                    }}
                  >
                    <h3>{item.title}</h3>
                    <p>{item.character.name}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="empty-state">No items yet.</p>}
          </section>
          )
        })}
      </div>
      {celebration && (
        <Celebration key={celebration.id} title={celebration.title} onDismiss={dismissCelebration} />
      )}
    </main>
  )
}
