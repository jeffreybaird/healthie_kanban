import { useEffect } from 'react'

const ARRIVAL_DURATION_MS = 1500

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Decorative swirl that covers the Done column while a card is being dragged toward it. */
export function DonePortal() {
  return <div data-testid="portal" aria-hidden="true" className="portal" />
}

type ArrivalProps = { title: string; showPortal: boolean; onDismiss: () => void }

/**
 * Announces a card reaching Done and, unless motion is reduced, opens a portal
 * above the column for the card to fall out of. Dismisses itself on a timer;
 * give it a `key` per arrival so a replacement restarts the timer.
 */
export function Arrival({ title, showPortal, onDismiss }: ArrivalProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, ARRIVAL_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [onDismiss])

  return (
    <>
      {showPortal && <div data-testid="arrival-portal" aria-hidden="true" className="arrival-portal" />}
      <p className="celebration-message" role="status">{`${title} is done!`}</p>
    </>
  )
}
