import { useRef, useState, type FormEvent } from 'react'
import CharacterSelect, { type Character } from './CharacterSelect'

type Item = { id: number; title: string; character: Character }

const columns = [
  { id: 'to-do', title: 'To Do' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' },
]

export default function App() {
  const [title, setTitle] = useState('')
  const [character, setCharacter] = useState<Character | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const nextItemId = useRef(1)

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !character) return

    const item = { id: nextItemId.current++, title: trimmedTitle, character }
    setItems(previous => [...previous, item])
    setTitle('')
    setCharacter(null)
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
        {columns.map(column => (
          <section className="column" key={column.id} aria-labelledby={`${column.id}-heading`}>
            <h2 id={`${column.id}-heading`}>{column.title}</h2>
            {column.id === 'to-do' && items.length > 0 ? (
              <ul className="item-list">
                {items.map(item => (
                  <li className="item-card" key={item.id}>
                    <h3>{item.title}</h3>
                    <p>{item.character.name}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="empty-state">No items yet.</p>}
          </section>
        ))}
      </div>
    </main>
  )
}
