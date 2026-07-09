import { MONTHLY_UNLOCK, WEEKLY_UNLOCK } from '../lib/game'

interface Props {
  thisWeek: number
  cardCount: number
  thinking: boolean
  onMint: () => void
  onGoToday: () => void
}

export function Reviews({ thisWeek, cardCount, thinking, onMint, onGoToday }: Props) {
  const weeklyOpen = thisWeek >= WEEKLY_UNLOCK
  const monthlyOpen = cardCount >= MONTHLY_UNLOCK

  return (
    <div className="develop">
      <h1>Reviews</h1>
      <p className="sub">Zoom out from nights to patterns.</p>

      <div className="section">
        <span className="ambient">Weekly</span>
        <h2 style={{ marginTop: 'var(--s-3)' }}>The week in review</h2>
        <p className="secondary" style={{ marginBottom: 'var(--s-5)' }}>
          Coach reads your nights and hands back one thing you couldn’t see yourself —
          then you set an intention for the week ahead.
        </p>

        {weeklyOpen ? (
          <button className="btn" onClick={onMint} disabled={thinking}>
            {thinking ? 'Coach is reading your week…' : 'Read my week'}
          </button>
        ) : (
          <>
            <p className="secondary">A week’s read comes after a few nights. Keep going.</p>
            <div className="spacer" />
            <button className="btn ghost" onClick={onGoToday}>Reflect tonight</button>
          </>
        )}
      </div>

      <div className="section">
        <span className="ambient">Monthly</span>
        <h2 style={{ marginTop: 'var(--s-3)' }}>The monthly arc</h2>
        <p className="secondary" style={{ marginBottom: 'var(--s-5)' }}>
          Trajectory and what you’re building toward — drafted from your own words.
          You set next month’s theme.
        </p>
        {monthlyOpen ? (
          <button className="btn ghost" onClick={onGoToday}>Begin the monthly arc</button>
        ) : (
          <p className="secondary">Opens once you’ve gathered a few weekly reads.</p>
        )}
      </div>
    </div>
  )
}
