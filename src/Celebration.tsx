import { useEffect, type CSSProperties } from 'react'

export const CELEBRATION_DURATION_MS = 1500
const CONFETTI_PIECE_COUNT = 16
const confettiColors = ['#14576a', '#b77b24', '#397c68', '#30616d', '#82929d']

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

type CelebrationProps = { title: string; onDismiss: () => void }

export default function Celebration({ title, onDismiss }: CelebrationProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, CELEBRATION_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [onDismiss])

  return (
    <>
      {!prefersReducedMotion() && (
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: CONFETTI_PIECE_COUNT }, (_, index) => (
            <span
              key={index}
              className="confetti-piece"
              data-testid="confetti-piece"
              style={{
                '--confetti-left': `${((index * 37) % 100) + 0.5}%`,
                '--confetti-delay': `${(index % 5) * 60}ms`,
                '--confetti-spin': `${index % 2 === 0 ? 1 : -1}turn`,
                background: confettiColors[index % confettiColors.length],
              } as CSSProperties}
            />
          ))}
        </div>
      )}
      <p className="celebration-message" role="status">{`${title} is done!`}</p>
    </>
  )
}
