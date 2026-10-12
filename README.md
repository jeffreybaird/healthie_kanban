# Healthie Kanban

Session 2 of the Healthie full stack pairing interview: a frontend-only Kanban
board in React and TypeScript. Items are assigned a Rick and Morty character
from the public GraphQL API, dragged between To Do, Doing and Done, and dropped
through a portal when they reach Done.

Deployed at https://healthie-kanban.jeffreybaird.com. Session 1, the Rails data
model, lives in [healthie_rails_journal](https://github.com/jeffreybaird/healthie_rails_journal).

## Running it

Node 24 (see `.node-version`). No environment variables, no backend.

```sh
npm ci          # install the committed lockfile
npm run dev     # http://localhost:5173
npm test        # Vitest + React Testing Library, 46 tests
npm run build   # tsc --noEmit, then a production build into dist/
```

`npm run preview` serves whatever is already in `dist/`, so run `npm run build`
first or you will be looking at a stale build.

## What it does

- Loads characters from `https://rickandmortyapi.com/graphql` on mount, with
  loading, error and empty states and a retry button.
- Creates items through a form. A title and a character are both required.
- Drags items between columns and reorders them within a column using the
  native HTML5 drag and drop API.
- Starting a drag from To Do or Doing covers the Done column with a portal.
  Dropping there opens a second portal above the column and the card falls out
  of it into place, with a short announcement for screen readers.
- Honours `prefers-reduced-motion`: no portals and no fall, the announcement
  still appears.

## How it is put together

```
src/
  main.tsx              mounts <App /> in StrictMode
  App.tsx               board state, the form, columns, cards, drag handlers
  CharacterSelect.tsx   fetches characters, owns its load state, renders the <select>
  Portal.tsx            the SVG portal swirl and the arrival overlay
  style.css             all styling, plain CSS
  App.test.tsx          component tests
```

`App` owns all board state. Items are a flat array; each item has a column id
and its position in the array is its order within that column. Moving and
reordering go through one pure function, `moveItemInList`, which returns a new
array or the same array when nothing changed. `App` compares the item's column
before and after to decide whether to celebrate.

The drag source lives in a ref, not state, so dragover events do not re-render
the board. The drop indicator and the portal flag are state because they render.

`CharacterSelect` is self-contained: it fetches, aborts on unmount, and reports
the chosen character upward. `App` never sees the loading state.

The portal is a procedurally generated SVG, seven ragged rings in three greens
with specks, each rotating at its own speed. The geometry is generated once from
a seeded generator so renders are deterministic, and the component is memoised
so a drag's continuous dragover events never rebuild it. No show artwork is
embedded.

## Libraries

React 19, TypeScript, Vite, Vitest, React Testing Library, jsdom. Nothing else.
Drag and drop, animation and the portal are hand-written: the brief is small
enough that a drag library or a confetti package would have been more code to
explain than it saved.

## Tests

`src/App.test.tsx` renders the whole app with `fetch` stubbed and exercises it
the way a user would: filling the form, firing drag events with a fake
`dataTransfer`, and checking what is in each column afterwards. Timed behaviour
uses fake timers. There are no snapshot tests and nothing asserts on internal
state.

## Known limitations

- Only the first page of characters is loaded, 20 of 826. There is no search
  or pagination in the selector.
- Native drag and drop has no keyboard path and does not work on touch devices.
  A library like dnd-kit would fix both at the cost of a dependency.
- Cross-column drops always append to the end of the destination; you cannot
  drop at a position in another column.
- Nothing persists. Reload and the board is empty. Item ids come from an
  in-memory counter, so persistence would need stable ids first.
- Reordering a card inside Done while its arrival animation is still playing
  restarts the fall from a slightly wrong offset. Cosmetic.

## Deployment

Pushing to `main` runs `npm ci`, `npm test` and `npm run build` in GitHub
Actions and publishes `dist/` to a Caddy static site with retained releases.
Tests do not run on pull requests yet; they gate the deploy, not the merge.
`infra/` holds the Terraform for the host and `deploy/` the publish scripts;
neither is needed to run the app locally.
