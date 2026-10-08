import { useRef, useState, type FormEvent } from 'react'
import CharacterSelect, { type Character } from './CharacterSelect'

type ColumnId = 'to-do' | 'doing' | 'done'
type Item = { id: number; title: string; character: Character; columnId: ColumnId }

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

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !character) return

    const item: Item = { id: nextItemId.current++, title: trimmedTitle, character, columnId: 'to-do' }
    setItems(previous => [...previous, item])
    setTitle('')
    setCharacter(null)
  }

  function moveItem(columnId: ColumnId) {
    const itemId = draggedItemId.current
    draggedItemId.current = null
    if (itemId === null) return

    setItems(previous => {
      const item = previous.find(candidate => candidate.id === itemId)
      if (!item || item.columnId === columnId) return previous
      return [...previous.filter(candidate => candidate.id !== itemId), { ...item, columnId }]
    })
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
                    onDragStart={event => {
                      draggedItemId.current = item.id
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', String(item.id))
                    }}
                    onDragEnd={() => { draggedItemId.current = null }}
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
    </main>
  )
}
