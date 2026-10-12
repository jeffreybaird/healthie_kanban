# Healthie Kanban project guidance

## Purpose

This repository is the React Kanban board for a pairing interview. Keep the code
small, readable and easy to explain. It should support a walkthrough of the
component structure and state ownership, followed by pairing on a small feature
such as filtering, persistence or a UI improvement.

These app-specific rules take precedence over generic scaffold examples. Let the
interview requirements drive the design. This file is preserved by agent-docs.sh
updates.

## Requirements

Frontend-only board, React and TypeScript, built with Vite:

- Three columns in order: To Do, Doing, Done.
- Load characters from the Rick and Morty GraphQL API
  (`https://rickandmortyapi.com/graphql`) with a `fetch` call. Show loading,
  error and empty states, and let the user retry a failed request.
- Items are created through a form. Every item has a title and exactly one
  assigned character; the form cannot submit without both.
- Items are draggable between columns and reorderable within a column.
- When an item is moved into Done, show something delightful (confetti or a
  small animation). Respect `prefers-reduced-motion`.
- No backend. State lives in the browser; persistence, if added, uses browser
  storage and is per browser only.

## Component structure and state

Keep `src/App.tsx` as the owner of board state. Prefer a flat list of items,
each with a column id, ordered by position in the list. Keep the move and
reorder logic in a pure function so it can be unit tested and reused if
persistence is added. Extract Column and Card components once they carry
their own markup or handlers; do not extract before that point.

Drag and drop uses the native HTML5 API. Be ready to explain the tradeoff
against a library (keyboard and touch support, insertion indicators) and what
a keyboard alternative would look like.

Item ids must survive a reload if persistence is added; do not rely on an
in-memory counter for persisted items.

The character query currently loads one page. Note this in the README and be
ready to discuss pagination or search.

## Tests and verification

Use Vitest and React Testing Library. Exercise user interactions, not
implementation details: form submission with and without a character, every
character-loading state and retry, moves between columns, reorders within a
column (both halves of the target card, self-drop, cancellation), and the Done
celebration. Assert resulting order, not just counts.

Follow [agent-workflow.md](agent-workflow.md) for source/test ownership and
[react.md](react.md) for conventions. `npm test` and `npm run build` must pass
before any push; CI runs both before publishing.

## README and local setup

Include the Node version, `npm ci`, `npm run dev`, `npm test` and
`npm run build`. Describe the component structure and state shape, name the
libraries used and why, link to the deployed site, and note any incomplete work
honestly. Point to the companion Rails repository for Session 1. Keep the README
focused on what someone needs to run, understand and extend this exercise.
