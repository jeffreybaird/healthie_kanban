import { useEffect, useId, useState } from 'react'

type Character = { id: string; name: string }
type CharacterResponse = {
  data?: { characters?: { results?: (Character | null)[] } }
  errors?: unknown[]
}
type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; characters: Character[] }

export default function CharacterSelect({ value, onChange }: {
  value: string
  onChange: (characterId: string) => void
}) {
  const id = useId()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function loadCharacters() {
      try {
        const response = await fetch('https://rickandmortyapi.com/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ characters(page: 1) { results { id name } } }' }),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Character request failed')
        const payload = await response.json() as CharacterResponse
        const results = payload.data?.characters?.results
        if (payload.errors?.length || !Array.isArray(results)) {
          throw new Error('Invalid character response')
        }
        const characters = results.filter((character): character is Character =>
          character !== null && typeof character.id === 'string' && typeof character.name === 'string',
        )
        if (!controller.signal.aborted) setState({ status: 'ready', characters })
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }

    void loadCharacters()
    return () => controller.abort()
  }, [])

  const characters = state.status === 'ready' ? state.characters : []

  return (
    <div className="character-field">
      <label htmlFor={id}>Character</label>
      <select
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={state.status !== 'ready' || characters.length === 0}
        aria-describedby={state.status !== 'ready' || characters.length === 0 ? `${id}-feedback` : undefined}
      >
        <option value="">Choose a character</option>
        {characters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
      </select>
      {state.status === 'loading' && <p id={`${id}-feedback`} role="status">Loading characters…</p>}
      {state.status === 'error' && <p id={`${id}-feedback`} role="alert">Could not load characters.</p>}
      {state.status === 'ready' && characters.length === 0 && (
        <p id={`${id}-feedback`} role="status">No characters available.</p>
      )}
    </div>
  )
}
