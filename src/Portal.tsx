import { memo, useEffect } from 'react'

const ARRIVAL_DURATION_MS = 1500

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Deterministic linear congruential generator so the swirl renders identically every time. */
function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

const LIME = '#a4d14a'
const MID = '#4faf4e'
const DARK = '#1d8f3f'
const SPECK = '#f2f6e8'

type Ring = {
  radius: number
  color: string
  points: number
  ragged: number
  specks: number
  /** Crescent tendrils drawn inside the band, drifting inward to suggest a spiral. */
  streaks: number
  streakColor: string
}

// Outermost first; each ring is painted over the previous one, leaving a ragged band.
const RINGS: Ring[] = [
  { radius: 96, color: LIME, points: 40, ragged: 0.12, specks: 34, streaks: 4, streakColor: MID },
  { radius: 84, color: MID, points: 40, ragged: 0.16, specks: 20, streaks: 4, streakColor: LIME },
  { radius: 72, color: LIME, points: 36, ragged: 0.2, specks: 8, streaks: 3, streakColor: MID },
  { radius: 64, color: DARK, points: 36, ragged: 0.18, specks: 0, streaks: 5, streakColor: MID },
  { radius: 49, color: MID, points: 32, ragged: 0.24, specks: 0, streaks: 4, streakColor: LIME },
  { radius: 38, color: DARK, points: 30, ragged: 0.24, specks: 0, streaks: 4, streakColor: LIME },
  { radius: 22, color: LIME, points: 26, ragged: 0.3, specks: 0, streaks: 2, streakColor: MID },
]

const fmt = (n: number) => n.toFixed(1)

/** Radius of ring `index` at `angle`: a lopsided circle (offset per ring, so the bands read as a spiral). */
function ringShape(index: number, angle: number) {
  const ring = RINGS[index]
  const twist = index * 0.9
  return ring.radius * (1 + 0.09 * Math.sin(angle + twist) + 0.04 * Math.sin(3 * angle - twist))
}

function ringPath(index: number, random: () => number) {
  const ring = RINGS[index]
  const points = Array.from({ length: ring.points }, (_, i) => {
    const angle = (i / ring.points) * Math.PI * 2
    // Occasional deep notches give the bands their torn, dripping edge.
    const roll = random()
    const notch = roll < 0.22 ? -ring.ragged * 1.8 * random() : roll > 0.9 ? ring.ragged * random() : 0
    const r = ringShape(index, angle) * (1 + ring.ragged * (random() - 0.5) + notch)
    return [100 + r * Math.cos(angle), 100 + r * Math.sin(angle)]
  })
  return smoothClosedPath(points)
}

/** Crescents that taper at both ends and creep inward along their sweep. */
function ringStreaks(index: number, random: () => number) {
  const ring = RINGS[index]
  const inner = RINGS[index + 1]?.radius ?? ring.radius * 0.35
  const steps = 8
  return Array.from({ length: ring.streaks }, (_, n) => {
    const start = ((n + random() * 0.6) / ring.streaks) * Math.PI * 2
    const sweep = 0.7 + random() * 0.9
    const depth = inner + (ring.radius - inner) * (0.35 + random() * 0.45)
    const width = (ring.radius - inner) * (0.12 + random() * 0.14)
    const outer: number[][] = []
    const innerEdge: number[][] = []
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      const angle = start + sweep * t
      const centre = depth * (1 - 0.14 * t) * (ringShape(index, angle) / ring.radius)
      const half = width * Math.sin(Math.PI * t) * (0.8 + random() * 0.4)
      outer.push([100 + (centre + half) * Math.cos(angle), 100 + (centre + half) * Math.sin(angle)])
      innerEdge.unshift([100 + (centre - half) * Math.cos(angle), 100 + (centre - half) * Math.sin(angle)])
    }
    return smoothClosedPath([...outer, ...innerEdge.slice(1, -1)])
  })
}

/** Closed curve through the midpoints of the given polygon, using its vertices as control points. */
function smoothClosedPath(points: number[][]) {
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(points[points.length - 1], points[0])
  const curves = points.map((point, i) => {
    const end = mid(point, points[(i + 1) % points.length])
    return `Q${fmt(point[0])} ${fmt(point[1])} ${fmt(end[0])} ${fmt(end[1])}`
  })
  return `M${fmt(start[0])} ${fmt(start[1])}${curves.join('')}Z`
}

function ringSpecks(index: number, random: () => number) {
  const ring = RINGS[index]
  const inner = RINGS[index + 1]?.radius ?? 0
  return Array.from({ length: ring.specks }, () => {
    const angle = random() * Math.PI * 2
    const band = inner * 1.12 + (ring.radius * 0.9 - inner * 1.12) * random()
    const r = band * (ringShape(index, angle) / ring.radius)
    return {
      cx: fmt(100 + r * Math.cos(angle)),
      cy: fmt(100 + r * Math.sin(angle)),
      rx: fmt(2.8 + random() * 2.6),
      ry: fmt(2.2 + random() * 1.8),
      rotate: Math.round(random() * 180),
    }
  })
}

// Generated once at module load: the swirl never re-computes during a drag.
const SWIRL = (() => {
  const random = seededRandom(20240917)
  return RINGS.map((ring, index) => ({
    color: ring.color,
    streakColor: ring.streakColor,
    path: ringPath(index, random),
    streaks: ringStreaks(index, random),
    specks: ringSpecks(index, random),
  }))
})()

/** Original procedurally drawn green portal; each band churns at its own speed and direction. */
const PortalSwirl = memo(function PortalSwirl({ squashed = false }: { squashed?: boolean }) {
  return (
    <svg
      className="portal-swirl"
      viewBox="0 0 200 200"
      preserveAspectRatio={squashed ? 'none' : 'xMidYMid meet'}
      focusable="false"
    >
      {SWIRL.map((ring, index) => (
        <g key={index} className={`portal-ring portal-ring-${index}`}>
          <path d={ring.path} fill={ring.color} />
          {ring.streaks.map((streak, i) => <path key={i} d={streak} fill={ring.streakColor} />)}
          {ring.specks.map((speck, i) => (
            <ellipse
              key={i}
              cx={speck.cx}
              cy={speck.cy}
              rx={speck.rx}
              ry={speck.ry}
              fill={SPECK}
              transform={`rotate(${speck.rotate} ${speck.cx} ${speck.cy})`}
            />
          ))}
        </g>
      ))}
    </svg>
  )
})

/** Decorative swirl that covers the Done column while a card is being dragged toward it. */
export const DonePortal = memo(function DonePortal() {
  return (
    <div data-testid="portal" aria-hidden="true" className="portal">
      <PortalSwirl />
    </div>
  )
})

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
      {showPortal && (
        <div data-testid="arrival-portal" aria-hidden="true" className="arrival-portal">
          <PortalSwirl squashed />
        </div>
      )}
      <p className="celebration-message" role="status">{`${title} is done!`}</p>
    </>
  )
}
