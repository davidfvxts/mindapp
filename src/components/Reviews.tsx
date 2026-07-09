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
    <div className="fade">
      <h1>Reviews</h1>
      <p className="sub">Zoom out from events to patterns.</p>

      <div className="section">
        <h3>Weekly</h3>
        <h2>The week in review</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          A structured review of energy, creativity, product and relationships — built from your
          daily entries, ending in an intention for next week.
        </p>

        {weeklyOpen ? (
          <button className="btn" onClick={onMint} disabled={thinking}>
            {thinking ? 'Mira is reading your week…' : 'Mint this week’s Insight Card'}
          </button>
        ) : (
          <>
            <div className="bar-track">
              <i style={{ width: `${(thisWeek / WEEKLY_UNLOCK) * 100}%` }} />
            </div>
            <div className="bar-meta">
              <span>Unlocks at {WEEKLY_UNLOCK} reflections</span>
              <span>{thisWeek}/{WEEKLY_UNLOCK}</span>
            </div>
            <div className="spacer" />
            <button className="btn ghost" onClick={onGoToday}>Reflect today</button>
          </>
        )}
      </div>

      <div className="section">
        <h3>Monthly</h3>
        <h2>The monthly arc</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          Trajectory, values alignment and fear-setting — with Mira drafting your summary from
          your own words. You set next month’s theme.
        </p>
        {monthlyOpen ? (
          <button className="btn ghost" onClick={onGoToday}>Begin monthly arc</button>
        ) : (
          <>
            <div className="bar-track">
              <i style={{ width: `${(cardCount / MONTHLY_UNLOCK) * 100}%` }} />
            </div>
            <div className="bar-meta">
              <span>Unlocks after {MONTHLY_UNLOCK} weekly reviews</span>
              <span>{cardCount}/{MONTHLY_UNLOCK}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
