const columns = [
  { id: 'to-do', title: 'To Do' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' },
]

export default function App() {
  return (
    <main>
      <header className="board-header">
        <p className="eyebrow">A little progress, every day</p>
        <h1>Kanban board</h1>
        <p>See your work from start to finish.</p>
      </header>
      <div className="board">
        {columns.map(column => (
          <section className="column" key={column.id} aria-labelledby={`${column.id}-heading`}>
            <h2 id={`${column.id}-heading`}>{column.title}</h2>
            <p className="empty-state">No items yet.</p>
          </section>
        ))}
      </div>
    </main>
  )
}
